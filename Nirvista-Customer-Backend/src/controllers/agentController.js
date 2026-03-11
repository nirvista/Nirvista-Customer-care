import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import { created, success, badRequest, notFound, serverError } from "../utils/responseMessages.js";
import { reassignAgentTickets } from "../services/ticketAssignmentService.js";

// Create a new agent
const createAgent = async (req, res) => {
    try {
        const { email, name, password, companyID } = req.body;
        
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return badRequest(res, `User with email ${email} already exists`);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAgent = new User({
            email: email.toLowerCase(),
            name,
            password: hashedPassword,
            role: "agent",
            companyID
        });
        
        await newAgent.save();
        created(res, { id: newAgent._id, email: newAgent.email, name: newAgent.name, companyID: newAgent.companyID }, "Agent created successfully");
    } catch (error) {
        serverError(res);
    }
};

// Get all agents
const getAllAgents = async (req, res) => {
    try {
        const agents = await User.find({ role: "agent" }).select("-password");
        success(res, agents, "Agents retrieved successfully");
    } catch (error) {
        serverError(res);
    }
};

// Get single agent by ID
const getAgentById = async (req, res) => {
    try {
        const agent = await User.findOne({ _id: req.params.id, role: "agent" }).select("-password");
        if (!agent) {
            return notFound(res, "Agent not found");
        }
        success(res, agent, "Agent retrieved successfully");
    } catch (error) {
        serverError(res);
    }
};

// Update agent
const updateAgent = async (req, res) => {
    try {
        const { email, name, password, companyID, isActive } = req.body;
        const updateData = {};

        if (email) updateData.email = email.toLowerCase();
        if (name) updateData.name = name;
        if (companyID) updateData.companyID = companyID;
        if (password) updateData.password = await bcrypt.hash(password, 10);
        if (typeof isActive === "boolean") updateData.isActive = isActive;

        // Check if agent is being deactivated
        const wasDeactivated = typeof isActive === "boolean" && isActive === false;

        const agent = await User.findOneAndUpdate(
            { _id: req.params.id, role: "agent" },
            updateData,
            { returnDocument: 'after' }
        ).select("-password");

        if (!agent) {
            return notFound(res, "Agent not found");
        }

        // AUTO-REASSIGN: If agent was deactivated, reassign their tickets
        if (wasDeactivated) {
            try {
                const reassignResult = await reassignAgentTickets(req.params.id);
                console.log(`Agent deactivated: Reassigned ${reassignResult.reassigned}/${reassignResult.total} tickets`);
            } catch (error) {
                console.error("Error reassigning tickets after deactivation:", error);
            }
        }

        success(res, agent, "Agent updated successfully");
    } catch (error) {
        serverError(res);
    }
};

// Delete agent
const deleteAgent = async (req, res) => {
    try {
        const agentId = req.params.id;

        // AUTO-REASSIGN: Reassign all tickets before deleting the agent
        try {
            const reassignResult = await reassignAgentTickets(agentId);
            console.log(`Agent deletion: Reassigned ${reassignResult.reassigned}/${reassignResult.total} tickets`);
        } catch (error) {
            console.error("Error reassigning tickets before deletion:", error);
        }
        const agent = await User.findOneAndDelete({ _id: agentId, role: "agent" });
        if (!agent) {
            return notFound(res, "Agent not found");
        }
        success(res, null, "Agent deleted successfully");
    } catch (error) {
        serverError(res);
    }
};

export { createAgent, getAllAgents, getAgentById, updateAgent, deleteAgent };