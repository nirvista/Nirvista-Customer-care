import Ticket from "../models/ticketModel.js";
import { success, badRequest, serverError } from "../utils/responseMessages.js";

// GET /api/dashboard/summary
const getDashboardSummary = async (req, res) => {
    try {
        const { role, companyID: userCompanyID } = req.user;
        const { from, to, companyID: queryCompanyID } = req.query;

        // Build date filter
        const dateFilter = {};
        if (from || to) {
            dateFilter.createdAt = {};
            if (from) dateFilter.createdAt.$gte = new Date(from);
            if (to) dateFilter.createdAt.$lte = new Date(to);
        } else {
            // Default to today if no date range provided
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateFilter.createdAt = { $gte: today, $lt: tomorrow };
        }

        // Build company filter based on role
        const companyFilter = {};
        if (role === "supervisor") {
            // Supervisor can only see their company's data
            companyFilter.companyID = userCompanyID;
        } else if (role === "admin" && queryCompanyID) {
            // Admin can filter by companyID if provided
            companyFilter.companyID = queryCompanyID;
        }

        const baseFilter = { ...dateFilter, ...companyFilter };

        // Get total tickets
        const totalTickets = await Ticket.countDocuments(baseFilter);

        // Get tickets by status
        const [openTickets, pendingTickets, resolvedTickets, newTickets, closedTickets] = await Promise.all([
            Ticket.countDocuments({ ...baseFilter, status: "open" }),
            Ticket.countDocuments({ ...baseFilter, status: "pending" }),
            Ticket.countDocuments({ ...baseFilter, status: "resolved" }),
            Ticket.countDocuments({ ...baseFilter, status: "new" }),
            Ticket.countDocuments({ ...baseFilter, status: "closed" })
        ]);

        // Get SLA breaches
        const slaBreaches = await Ticket.countDocuments({ 
            ...baseFilter, 
            "sla.breached": true 
        });

        // Get tickets at risk (resolution due within 2 hours)
        const now = new Date();
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const ticketsAtRisk = await Ticket.countDocuments({
            ...baseFilter,
            status: { $nin: ["resolved", "closed"] },
            "sla.resolutionDue": { $lte: twoHoursFromNow, $gt: now },
            "sla.breached": { $ne: true }
        });

        // Get tickets per company (aggregation)
        const ticketsPerCompany = await Ticket.aggregate([
            { $match: baseFilter },
            { 
                $group: { 
                    _id: "$companyID", 
                    count: { $sum: 1 },
                    open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
                    breached: { $sum: { $cond: [{ $eq: ["$sla.breached", true] }, 1, 0] } }
                } 
            },
            { $sort: { count: -1 } }
        ]);

        // Get tickets per agent (aggregation)
        const ticketsPerAgent = await Ticket.aggregate([
            { $match: { ...baseFilter, assignedAgentId: { $ne: null } } },
            {
                $group: {
                    _id: "$assignedAgentId",
                    count: { $sum: 1 },
                    open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "agent"
                }
            },
            { $unwind: "$agent" },
            {
                $project: {
                    _id: 1,
                    count: 1,
                    open: 1,
                    pending: 1,
                    resolved: 1,
                    agentName: "$agent.name",
                    agentEmail: "$agent.email"
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get unassigned tickets count
        const unassignedTickets = await Ticket.countDocuments({
            ...baseFilter,
            assignedAgentId: null,
            status: { $nin: ["resolved", "closed"] }
        });

        // Get tickets by priority
        const ticketsByPriority = await Ticket.aggregate([
            { $match: baseFilter },
            {
                $group: {
                    _id: "$priority",
                    count: { $sum: 1 }
                }
            }
        ]);

        const priorityMap = ticketsByPriority.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        // Get tickets by channel
        const ticketsByChannel = await Ticket.aggregate([
            { $match: baseFilter },
            {
                $group: {
                    _id: "$channel",
                    count: { $sum: 1 }
                }
            }
        ]);

        const channelMap = ticketsByChannel.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        // Calculate average response time (for tickets with first response)
        const avgResponseTime = await Ticket.aggregate([
            { 
                $match: { 
                    ...baseFilter, 
                    "sla.firstResponseAt": { $exists: true, $ne: null } 
                } 
            },
            {
                $project: {
                    responseTime: {
                        $subtract: ["$sla.firstResponseAt", "$createdAt"]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgResponseTimeMs: { $avg: "$responseTime" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const avgResponseMinutes = avgResponseTime.length > 0 
            ? Math.round(avgResponseTime[0].avgResponseTimeMs / (1000 * 60)) 
            : null;

        return success(res, {
            summary: {
                totalTickets,
                byStatus: {
                    new: newTickets,
                    open: openTickets,
                    pending: pendingTickets,
                    resolved: resolvedTickets,
                    closed: closedTickets
                },
                byPriority: {
                    low: priorityMap.low || 0,
                    medium: priorityMap.medium || 0,
                    high: priorityMap.high || 0,
                    urgent: priorityMap.urgent || 0
                },
                byChannel: {
                    chat: channelMap.chat || 0,
                    email: channelMap.email || 0
                }
            },
            sla: {
                breaches: slaBreaches,
                atRisk: ticketsAtRisk,
                breachRate: totalTickets > 0 
                    ? ((slaBreaches / totalTickets) * 100).toFixed(2) + "%" 
                    : "0%"
            },
            assignments: {
                unassigned: unassignedTickets,
                ticketsPerAgent: ticketsPerAgent.map(agent => ({
                    agentId: agent._id,
                    agentName: agent.agentName,
                    agentEmail: agent.agentEmail,
                    total: agent.count,
                    open: agent.open,
                    pending: agent.pending,
                    resolved: agent.resolved
                }))
            },
            ticketsPerCompany: ticketsPerCompany.map(company => ({
                companyID: company._id,
                total: company.count,
                open: company.open,
                pending: company.pending,
                resolved: company.resolved,
                breached: company.breached
            })),
            performance: {
                avgFirstResponseMinutes: avgResponseMinutes,
                avgFirstResponseFormatted: avgResponseMinutes !== null 
                    ? formatDuration(avgResponseMinutes) 
                    : "N/A"
            },
            filters: {
                dateRange: {
                    from: from || "today",
                    to: to || "today"
                },
                companyID: role === "supervisor" ? userCompanyID : (queryCompanyID || "all")
            }
        }, "Dashboard summary retrieved successfully");

    } catch (error) {
        console.error("Error fetching dashboard summary:", error);
        return serverError(res);
    }
};

// Helper function to format duration
const formatDuration = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

    return parts.join(" ");
};

export { getDashboardSummary };