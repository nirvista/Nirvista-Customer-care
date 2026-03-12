import mongoose from "mongoose";
import User from "../models/userModel.js";
import Ticket from "../models/ticketModel.js";

// Priority order for processing tickets (higher priority first)
const PRIORITY_ORDER = {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4
};

/**
 * Find the best agent to assign a ticket to
 * @param {string} companyID - The company ID to find agents for
 * @returns {Object|null} - The selected agent or null if none available
 */

const MAX_TICKETS_PER_AGENT = 2; // Configurable limit
// Lock mechanism to prevent race conditions
const assignmentLocks = new Map();

const acquireLock = async (companyID, timeout = 5000) => {
    const startTime = Date.now();
    while (assignmentLocks.get(companyID)) {
        if (Date.now() - startTime > timeout) {
            throw new Error("Assignment lock timeout");
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    assignmentLocks.set(companyID, true);
};

const releaseLock = (companyID) => {
    assignmentLocks.delete(companyID);
};

const findBestAgent = async (companyID) => {
    // Get all agents for the company
    const agents = await User.find({ 
        role: "agent", 
        companyID: companyID,
        isActive: true 
    }).lean();

    if (agents.length === 0) {
        return null;
    }
    // Filter out agents who have reached their limit
    const availableAgents = agents.filter(
        agent => agent.activeTicketCount < MAX_TICKETS_PER_AGENT
    );

    if (availableAgents.length === 0) {
        console.log(`All agents at capacity for company ${companyID}`);
        return null; // All agents at max capacity
    }
    // Separate idle and busy agents
    const idleAgents = availableAgents.filter(agent => agent.isIdle === true);

    if (idleAgents.length === 1) {
        // Only one idle agent - assign to them
        return idleAgents[0];
    } else if (idleAgents.length > 1) {
        // Multiple idle agents - assign to the one least recently assigned
        // Agents with null lastAssignedAt are prioritized (never assigned before)
        idleAgents.sort((a, b) => {
            if (!a.lastAssignedAt && !b.lastAssignedAt) return 0;
            if (!a.lastAssignedAt) return -1;
            if (!b.lastAssignedAt) return 1;
            return new Date(a.lastAssignedAt) - new Date(b.lastAssignedAt);
        });
        return idleAgents[0];
    } else {
        // No idle agents - assign to the one with least tickets
        availableAgents.sort((a, b) => {
            // First sort by active ticket count
            if (a.activeTicketCount !== b.activeTicketCount) {
                return a.activeTicketCount - b.activeTicketCount;
            }
            // If same count, sort by last assigned time (least recent first)
            if (!a.lastAssignedAt && !b.lastAssignedAt) return 0;
            if (!a.lastAssignedAt) return -1;
            if (!b.lastAssignedAt) return 1;
            return new Date(a.lastAssignedAt) - new Date(b.lastAssignedAt);
        });
        return availableAgents[0];
    }
};

/**
 * Assign a single ticket to the best available agent
 * @param {Object} ticket - The ticket to assign
 * @returns {Object} - Result of the assignment
 */
const assignTicketToAgent = async (ticket) => {
    const agent = await findBestAgent(ticket.companyID);

    if (!agent) {
        console.log(`No agents available for company ${ticket.companyID}`);
        return { success: false, reason: "No agents available" };
    }

    // Use atomic update to prevent race conditions
    const updateResult = await User.findOneAndUpdate(
        { 
            _id: agent._id,
            activeTicketCount: { $lt: MAX_TICKETS_PER_AGENT }
        },
        {
            $set: { 
                lastAssignedAt: new Date(),
                isIdle: false
            },
            $inc: { activeTicketCount: 1 }
        },
        { returnDocument: 'after' }
    );

    if (!updateResult) {
        return { success: false, reason: "Agent no longer available, retry needed" };
    }

    // FIX: Handle both ObjectId and string for ticket._id
    const ticketId = ticket._id ? ticket._id : ticket.id;

    // Update the ticket with the assigned agent
    await Ticket.findByIdAndUpdate(ticketId, {
        assignedAgentId: agent._id,
        status: ticket.status === "new" ? "open" : ticket.status
    });

    console.log(`Ticket ${ticket.ticketId} assigned to agent ${agent.name} (${agent.email})`);

    return { 
        success: true, 
        agentId: agent._id, 
        agentName: agent.name,
        agentEmail: agent.email
    };
};

/**
 * Auto-assign a newly created ticket
 * @param {Object} ticket - The newly created ticket document
 * @returns {Object} - Result of the assignment
 */

const autoAssignNewTicket = async (ticket, retries = 3) => {
    try {
        await acquireLock(ticket.companyID);
        const result = await assignTicketToAgent(ticket);
        if (!result.success && result.reason && result.reason.includes("retry") && retries > 0) {
            releaseLock(ticket.companyID);
            return autoAssignNewTicket(ticket, retries - 1);
        }
        return result;
    } catch (error) {
        console.error("Error in auto-assignment:", error);
        return { success: false, reason: error.message };
    } finally {
        releaseLock(ticket.companyID);
    }
};

/**
 * Process all unassigned tickets by priority
 * This can be called periodically or on-demand
 */
const processUnassignedTickets = async () => {
    try {
        // Get all unassigned tickets that are not closed/resolved
        const unassignedTickets = await Ticket.find({
            assignedAgentId: null,
            status: { $in: ["new", "open", "pending"] }
        }).lean();

        if (unassignedTickets.length === 0) {
            console.log("No unassigned tickets to process");
            return { processed: 0, assigned: 0 };
        }

        // Sort tickets by priority
        unassignedTickets.sort((a, b) => {
            return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        });

        let assignedCount = 0;

        for (const ticket of unassignedTickets) {
            const result = await assignTicketToAgent(ticket);
            if (result.success) {
                assignedCount++;
            }
        }

        console.log(`Processed ${unassignedTickets.length} tickets, assigned ${assignedCount}`);
        return { processed: unassignedTickets.length, assigned: assignedCount };

    } catch (error) {
        console.error("Error processing unassigned tickets:", error);
        throw error;
    }
};

/**
 * Update agent idle status based on their active tickets
 * Call this when a ticket is resolved/closed
 * @param {string} agentId - The agent's ID
 */
const updateAgentStatus = async (agentId) => {
    try {
        if (!agentId) {
            console.log("No agent ID provided for status update");
            return null;
        }
        // Count active tickets for the agent
        const activeTickets = await Ticket.countDocuments({
            assignedAgentId: agentId,
            status: { $in: ["new", "open", "pending"] }
        });

        // Update agent status
        const updatedAgent = await User.findByIdAndUpdate(
            agentId,
            {
                activeTicketCount: activeTickets,
                isIdle: activeTickets === 0
            },
            { new: true }
        );

        if (!updatedAgent) {
            console.log(`Agent ${agentId} not found`);
            return null;
        }

        // AUTO-TRIGGER: If agent has capacity, process unassigned tickets
        if (activeTickets < MAX_TICKETS_PER_AGENT && updatedAgent.companyID) {
            console.log(`Agent ${updatedAgent.name} has capacity, processing unassigned tickets for company ${updatedAgent.companyID}...`);
            try {
                const result = await processUnassignedTicketsForCompany(updatedAgent.companyID);
                console.log(`[AUTO-ASSIGN] Completed:`, result);
            } catch (error) {
                console.error("[AUTO-ASSIGN] Error:", error);
            }
        }
        
        return { activeTickets, isIdle: activeTickets === 0 };
    } catch (error) {
        console.error("Error updating agent status:", error);
        throw error;
    }
};

/**
 * Process unassigned tickets for a specific company
 * @param {string} companyID - The company to process tickets for
 */
const processUnassignedTicketsForCompany = async (companyID) => {
    try {
        // Get unassigned tickets for THIS company only
        const unassignedTickets = await Ticket.find({
            companyID: companyID,  // Filter by company
            assignedAgentId: null,
            status: { $in: ["new", "open", "pending"] }
        }).lean();

        if (unassignedTickets.length === 0) {
            console.log(`No unassigned tickets for company ${companyID}`);
            return { processed: 0, assigned: 0 };
        }

        // Sort tickets by priority
        unassignedTickets.sort((a, b) => {
            return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        });

        let assignedCount = 0;

        for (const ticket of unassignedTickets) {
            const result = await assignTicketToAgent(ticket);
            if (result.success) {
                assignedCount++;
            } else {
                // No more agents available, stop trying
                if (result.reason === "No agents available") {
                    console.log(`No more agents available for company ${companyID}, stopping`);
                    break;
                }
            }
        }

        console.log(`Company ${companyID}: Processed ${unassignedTickets.length} tickets, assigned ${assignedCount}`);
        return { processed: unassignedTickets.length, assigned: assignedCount };

    } catch (error) {
        console.error(`Error processing unassigned tickets for company ${companyID}:`, error);
        throw error;
    }
};

/**
 * Recalculate all agents' active ticket counts
 * Useful for data consistency
 */
const recalculateAllAgentStats = async () => {
    try {
        const agents = await User.find({ role: "agent" });

        for (const agent of agents) {
            await updateAgentStatus(agent._id);
        }

        console.log(`Recalculated stats for ${agents.length} agents`);
        return { agentsUpdated: agents.length };
    } catch (error) {
        console.error("Error recalculating agent stats:", error);
        throw error;
    }
};

/**
 * Reassign tickets when an agent is removed or deactivated
 * @param {string} agentId - The agent's ID being removed
 */
const reassignAgentTickets = async (agentId) => {
    try {
        const agent = await User.findById(agentId);
        if (!agent) return { reassigned: 0 };

        // Find all active tickets assigned to this agent
        const tickets = await Ticket.find({
            assignedAgentId: agentId,
            status: { $in: ["new", "open", "pending"] }
        });

        // Unassign all tickets first
        await Ticket.updateMany(
            { assignedAgentId: agentId, status: { $in: ["new", "open", "pending"] } },
            { $set: { assignedAgentId: null } }
        );

        // Re-run assignment for these tickets
        let reassignedCount = 0;
        for (const ticket of tickets) {
            ticket.assignedAgentId = null;
            const result = await assignTicketToAgent(ticket);
            if (result.success) reassignedCount++;
        }

        return { reassigned: reassignedCount, total: tickets.length };
    } catch (error) {
        console.error("Error reassigning agent tickets:", error);
        throw error;
    }
};

export { 
    autoAssignNewTicket, 
    processUnassignedTickets,
    processUnassignedTicketsForCompany, 
    updateAgentStatus,
    recalculateAllAgentStats,
    findBestAgent,
    reassignAgentTickets
};
