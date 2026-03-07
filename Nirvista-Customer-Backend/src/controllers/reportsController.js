import Ticket from "../models/ticketModel.js";
import User from "../models/userModel.js";
import { success, badRequest, serverError } from "../utils/responseMessages.js";

// Helper function to build base filter
const buildBaseFilter = (req) => {
    const { role, companyID: userCompanyID } = req.user;
    const { from, to, companyID: queryCompanyID } = req.query;

    const filter = {};

    // Date filter
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = toDate;
        }
    }

    // Company filter based on role
    if (role === "supervisor") {
        filter.companyID = userCompanyID;
    } else if (role === "admin" && queryCompanyID) {
        filter.companyID = queryCompanyID;
    }

    return filter;
};

// Helper function to format duration
const formatDuration = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined) return "N/A";
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

    return parts.join(" ");
};

// GET /api/reports/tickets-per-day
const getTicketsPerDay = async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return badRequest(res, "Both 'from' and 'to' date parameters are required");
        }

        const baseFilter = buildBaseFilter(req);

        const ticketsPerDay = await Ticket.aggregate([
            { $match: baseFilter },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    total: { $sum: 1 },
                    new: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
                    open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
                    closed: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },
                    breached: { $sum: { $cond: [{ $eq: ["$sla.breached", true] }, 1, 0] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateFromParts: {
                            year: "$_id.year",
                            month: "$_id.month",
                            day: "$_id.day"
                        }
                    },
                    total: 1,
                    new: 1,
                    open: 1,
                    pending: 1,
                    resolved: 1,
                    closed: 1,
                    breached: 1
                }
            },
            { $sort: { date: 1 } }
        ]);

        // Calculate totals
        const totals = ticketsPerDay.reduce((acc, day) => {
            acc.total += day.total;
            acc.new += day.new;
            acc.open += day.open;
            acc.pending += day.pending;
            acc.resolved += day.resolved;
            acc.closed += day.closed;
            acc.breached += day.breached;
            return acc;
        }, { total: 0, new: 0, open: 0, pending: 0, resolved: 0, closed: 0, breached: 0 });

        return success(res, {
            report: "Tickets Per Day",
            dateRange: { from, to },
            data: ticketsPerDay.map(day => ({
                date: day.date.toISOString().split('T')[0],
                total: day.total,
                byStatus: {
                    new: day.new,
                    open: day.open,
                    pending: day.pending,
                    resolved: day.resolved,
                    closed: day.closed
                },
                breached: day.breached
            })),
            totals,
            daysCount: ticketsPerDay.length,
            averagePerDay: ticketsPerDay.length > 0 
                ? (totals.total / ticketsPerDay.length).toFixed(2) 
                : 0
        }, "Tickets per day report generated successfully");

    } catch (error) {
        console.error("Error generating tickets per day report:", error);
        return serverError(res);
    }
};

// GET /api/reports/response-time
const getResponseTimeReport = async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return badRequest(res, "Both 'from' and 'to' date parameters are required");
        }

        const baseFilter = buildBaseFilter(req);

        // Get tickets with first response
        const responseTimeData = await Ticket.aggregate([
            { 
                $match: { 
                    ...baseFilter, 
                    "sla.firstResponseAt": { $exists: true, $ne: null } 
                } 
            },
            {
                $project: {
                    responseTimeMs: {
                        $subtract: ["$sla.firstResponseAt", "$createdAt"]
                    },
                    priority: 1,
                    companyID: 1,
                    assignedAgentId: 1,
                    "sla.firstResponseDue": 1,
                    "sla.firstResponseAt": 1,
                    createdAt: 1
                }
            },
            {
                $addFields: {
                    responseTimeMinutes: { $divide: ["$responseTimeMs", 60000] },
                    metSLA: {
                        $cond: [
                            { $lte: ["$sla.firstResponseAt", "$sla.firstResponseDue"] },
                            true,
                            false
                        ]
                    }
                }
            }
        ]);

        // Calculate statistics
        const responseTimes = responseTimeData.map(t => t.responseTimeMinutes);
        const totalTickets = responseTimes.length;

        if (totalTickets === 0) {
            return success(res, {
                report: "Response Time",
                dateRange: { from, to },
                message: "No tickets with first response found in the given date range",
                data: null
            }, "Response time report generated");
        }

        // Sort for percentile calculations
        const sortedTimes = [...responseTimes].sort((a, b) => a - b);

        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / totalTickets;
        const minResponseTime = sortedTimes[0];
        const maxResponseTime = sortedTimes[totalTickets - 1];
        const medianResponseTime = totalTickets % 2 === 0
            ? (sortedTimes[totalTickets / 2 - 1] + sortedTimes[totalTickets / 2]) / 2
            : sortedTimes[Math.floor(totalTickets / 2)];
        const p90ResponseTime = sortedTimes[Math.floor(totalTickets * 0.9)];
        const p95ResponseTime = sortedTimes[Math.floor(totalTickets * 0.95)];

        // Distribution buckets (in minutes)
        const distribution = {
            "0-15min": 0,
            "15-30min": 0,
            "30-60min": 0,
            "1-2hr": 0,
            "2-4hr": 0,
            "4hr+": 0
        };

        responseTimes.forEach(time => {
            if (time <= 15) distribution["0-15min"]++;
            else if (time <= 30) distribution["15-30min"]++;
            else if (time <= 60) distribution["30-60min"]++;
            else if (time <= 120) distribution["1-2hr"]++;
            else if (time <= 240) distribution["2-4hr"]++;
            else distribution["4hr+"]++;
        });

        // SLA compliance
        const metSLACount = responseTimeData.filter(t => t.metSLA).length;
        const slaComplianceRate = ((metSLACount / totalTickets) * 100).toFixed(2);

        // Response time by priority
        const byPriority = await Ticket.aggregate([
            { 
                $match: { 
                    ...baseFilter, 
                    "sla.firstResponseAt": { $exists: true, $ne: null } 
                } 
            },
            {
                $group: {
                    _id: "$priority",
                    avgResponseTimeMs: { 
                        $avg: { $subtract: ["$sla.firstResponseAt", "$createdAt"] } 
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const priorityStats = byPriority.reduce((acc, item) => {
            acc[item._id] = {
                count: item.count,
                avgMinutes: Math.round(item.avgResponseTimeMs / 60000),
                avgFormatted: formatDuration(item.avgResponseTimeMs / 60000)
            };
            return acc;
        }, {});

        return success(res, {
            report: "Response Time",
            dateRange: { from, to },
            ticketsAnalyzed: totalTickets,
            statistics: {
                average: {
                    minutes: Math.round(avgResponseTime),
                    formatted: formatDuration(avgResponseTime)
                },
                median: {
                    minutes: Math.round(medianResponseTime),
                    formatted: formatDuration(medianResponseTime)
                },
                minimum: {
                    minutes: Math.round(minResponseTime),
                    formatted: formatDuration(minResponseTime)
                },
                maximum: {
                    minutes: Math.round(maxResponseTime),
                    formatted: formatDuration(maxResponseTime)
                },
                p90: {
                    minutes: Math.round(p90ResponseTime),
                    formatted: formatDuration(p90ResponseTime)
                },
                p95: {
                    minutes: Math.round(p95ResponseTime),
                    formatted: formatDuration(p95ResponseTime)
                }
            },
            distribution: Object.entries(distribution).map(([range, count]) => ({
                range,
                count,
                percentage: ((count / totalTickets) * 100).toFixed(2) + "%"
            })),
            slaCompliance: {
                metSLA: metSLACount,
                missedSLA: totalTickets - metSLACount,
                complianceRate: slaComplianceRate + "%"
            },
            byPriority: priorityStats
        }, "Response time report generated successfully");

    } catch (error) {
        console.error("Error generating response time report:", error);
        return serverError(res);
    }
};

// GET /api/reports/resolution-time
const getResolutionTimeReport = async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return badRequest(res, "Both 'from' and 'to' date parameters are required");
        }

        const baseFilter = buildBaseFilter(req);

        // Get resolved/closed tickets
        const resolutionTimeData = await Ticket.aggregate([
            { 
                $match: { 
                    ...baseFilter, 
                    status: { $in: ["resolved", "closed"] },
                    "sla.resolvedAt": { $exists: true, $ne: null }
                } 
            },
            {
                $project: {
                    resolutionTimeMs: {
                        $subtract: ["$sla.resolvedAt", "$createdAt"]
                    },
                    priority: 1,
                    companyID: 1,
                    assignedAgentId: 1,
                    "sla.resolutionDue": 1,
                    "sla.resolvedAt": 1,
                    createdAt: 1
                }
            },
            {
                $addFields: {
                    resolutionTimeMinutes: { $divide: ["$resolutionTimeMs", 60000] },
                    metSLA: {
                        $cond: [
                            { $lte: ["$sla.resolvedAt", "$sla.resolutionDue"] },
                            true,
                            false
                        ]
                    }
                }
            }
        ]);

        const resolutionTimes = resolutionTimeData.map(t => t.resolutionTimeMinutes);
        const totalTickets = resolutionTimes.length;

        if (totalTickets === 0) {
            return success(res, {
                report: "Resolution Time",
                dateRange: { from, to },
                message: "No resolved tickets found in the given date range",
                data: null
            }, "Resolution time report generated");
        }

        // Sort for percentile calculations
        const sortedTimes = [...resolutionTimes].sort((a, b) => a - b);

        const avgResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0) / totalTickets;
        const minResolutionTime = sortedTimes[0];
        const maxResolutionTime = sortedTimes[totalTickets - 1];
        const medianResolutionTime = totalTickets % 2 === 0
            ? (sortedTimes[totalTickets / 2 - 1] + sortedTimes[totalTickets / 2]) / 2
            : sortedTimes[Math.floor(totalTickets / 2)];
        const p90ResolutionTime = sortedTimes[Math.floor(totalTickets * 0.9)];
        const p95ResolutionTime = sortedTimes[Math.floor(totalTickets * 0.95)];

        // Distribution buckets (in hours)
        const distribution = {
            "0-1hr": 0,
            "1-4hr": 0,
            "4-8hr": 0,
            "8-24hr": 0,
            "1-3days": 0,
            "3days+": 0
        };

        resolutionTimes.forEach(time => {
            const hours = time / 60;
            if (hours <= 1) distribution["0-1hr"]++;
            else if (hours <= 4) distribution["1-4hr"]++;
            else if (hours <= 8) distribution["4-8hr"]++;
            else if (hours <= 24) distribution["8-24hr"]++;
            else if (hours <= 72) distribution["1-3days"]++;
            else distribution["3days+"]++;
        });

        // SLA compliance
        const metSLACount = resolutionTimeData.filter(t => t.metSLA).length;
        const slaComplianceRate = ((metSLACount / totalTickets) * 100).toFixed(2);

        // Resolution time by priority
        const byPriority = await Ticket.aggregate([
            { 
                $match: { 
                    ...baseFilter, 
                    status: { $in: ["resolved", "closed"] },
                    "sla.resolvedAt": { $exists: true, $ne: null }
                } 
            },
            {
                $group: {
                    _id: "$priority",
                    avgResolutionTimeMs: { 
                        $avg: { $subtract: ["$sla.resolvedAt", "$createdAt"] } 
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const priorityStats = byPriority.reduce((acc, item) => {
            const avgMinutes = item.avgResolutionTimeMs / 60000;
            acc[item._id] = {
                count: item.count,
                avgMinutes: Math.round(avgMinutes),
                avgHours: (avgMinutes / 60).toFixed(2),
                avgFormatted: formatDuration(avgMinutes)
            };
            return acc;
        }, {});

        return success(res, {
            report: "Resolution Time",
            dateRange: { from, to },
            ticketsAnalyzed: totalTickets,
            statistics: {
                average: {
                    minutes: Math.round(avgResolutionTime),
                    hours: (avgResolutionTime / 60).toFixed(2),
                    formatted: formatDuration(avgResolutionTime)
                },
                median: {
                    minutes: Math.round(medianResolutionTime),
                    hours: (medianResolutionTime / 60).toFixed(2),
                    formatted: formatDuration(medianResolutionTime)
                },
                minimum: {
                    minutes: Math.round(minResolutionTime),
                    formatted: formatDuration(minResolutionTime)
                },
                maximum: {
                    minutes: Math.round(maxResolutionTime),
                    hours: (maxResolutionTime / 60).toFixed(2),
                    formatted: formatDuration(maxResolutionTime)
                },
                p90: {
                    minutes: Math.round(p90ResolutionTime),
                    hours: (p90ResolutionTime / 60).toFixed(2),
                    formatted: formatDuration(p90ResolutionTime)
                },
                p95: {
                    minutes: Math.round(p95ResolutionTime),
                    hours: (p95ResolutionTime / 60).toFixed(2),
                    formatted: formatDuration(p95ResolutionTime)
                }
            },
            distribution: Object.entries(distribution).map(([range, count]) => ({
                range,
                count,
                percentage: ((count / totalTickets) * 100).toFixed(2) + "%"
            })),
            slaCompliance: {
                metSLA: metSLACount,
                missedSLA: totalTickets - metSLACount,
                complianceRate: slaComplianceRate + "%"
            },
            byPriority: priorityStats
        }, "Resolution time report generated successfully");

    } catch (error) {
        console.error("Error generating resolution time report:", error);
        return serverError(res);
    }
};

// GET /api/reports/sla-breaches
const getSLABreachesReport = async (req, res) => {
    try {
        const { from, to, page = 1, limit = 20 } = req.query;

        if (!from || !to) {
            return badRequest(res, "Both 'from' and 'to' date parameters are required");
        }

        const baseFilter = buildBaseFilter(req);
        const breachFilter = { ...baseFilter, "sla.breached": true };

        // Get total breach count
        const totalBreaches = await Ticket.countDocuments(breachFilter);

        // Get breached tickets with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const breachedTickets = await Ticket.find(breachFilter)
            .select("ticketId subject priority status companyID assignedAgentId sla createdAt")
            .populate("assignedAgentId", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Breaches by company
        const breachesByCompany = await Ticket.aggregate([
            { $match: breachFilter },
            {
                $group: {
                    _id: "$companyID",
                    totalBreaches: { $sum: 1 },
                    responseBreaches: { 
                        $sum: { 
                            $cond: [
                                { $gt: ["$sla.firstResponseAt", "$sla.firstResponseDue"] }, 
                                1, 
                                0
                            ] 
                        } 
                    },
                    resolutionBreaches: { 
                        $sum: { 
                            $cond: [
                                { 
                                    $or: [
                                        { $gt: ["$sla.resolvedAt", "$sla.resolutionDue"] },
                                        { 
                                            $and: [
                                                { $eq: ["$sla.resolvedAt", null] },
                                                { $lt: ["$sla.resolutionDue", new Date()] }
                                            ]
                                        }
                                    ]
                                }, 
                                1, 
                                0
                            ] 
                        } 
                    }
                }
            },
            { $sort: { totalBreaches: -1 } }
        ]);

        // Breaches by agent
        const breachesByAgent = await Ticket.aggregate([
            { $match: { ...breachFilter, assignedAgentId: { $ne: null } } },
            {
                $group: {
                    _id: "$assignedAgentId",
                    totalBreaches: { $sum: 1 }
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
                    totalBreaches: 1,
                    agentName: "$agent.name",
                    agentEmail: "$agent.email"
                }
            },
            { $sort: { totalBreaches: -1 } }
        ]);

        // Breaches by priority
        const breachesByPriority = await Ticket.aggregate([
            { $match: breachFilter },
            {
                $group: {
                    _id: "$priority",
                    count: { $sum: 1 }
                }
            }
        ]);

        const priorityBreaches = breachesByPriority.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        // Get total tickets in date range for breach rate
        const totalTicketsInRange = await Ticket.countDocuments(baseFilter);
        const breachRate = totalTicketsInRange > 0 
            ? ((totalBreaches / totalTicketsInRange) * 100).toFixed(2) 
            : 0;

        return success(res, {
            report: "SLA Breaches",
            dateRange: { from, to },
            summary: {
                totalBreaches,
                totalTicketsInRange,
                breachRate: breachRate + "%"
            },
            byPriority: {
                urgent: priorityBreaches.urgent || 0,
                high: priorityBreaches.high || 0,
                medium: priorityBreaches.medium || 0,
                low: priorityBreaches.low || 0
            },
            byCompany: breachesByCompany.map(company => ({
                companyID: company._id,
                totalBreaches: company.totalBreaches,
                responseBreaches: company.responseBreaches,
                resolutionBreaches: company.resolutionBreaches
            })),
            byAgent: breachesByAgent.map(agent => ({
                agentId: agent._id,
                agentName: agent.agentName,
                agentEmail: agent.agentEmail,
                totalBreaches: agent.totalBreaches
            })),
            breachedTickets: breachedTickets.map(ticket => ({
                ticketId: ticket.ticketId,
                subject: ticket.subject,
                priority: ticket.priority,
                status: ticket.status,
                companyID: ticket.companyID,
                assignedAgent: ticket.assignedAgentId ? {
                    id: ticket.assignedAgentId._id,
                    name: ticket.assignedAgentId.name,
                    email: ticket.assignedAgentId.email
                } : null,
                sla: {
                    firstResponseDue: ticket.sla?.firstResponseDue,
                    firstResponseAt: ticket.sla?.firstResponseAt,
                    resolutionDue: ticket.sla?.resolutionDue,
                    resolvedAt: ticket.sla?.resolvedAt
                },
                createdAt: ticket.createdAt
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalBreaches / parseInt(limit)),
                totalItems: totalBreaches
            }
        }, "SLA breaches report generated successfully");

    } catch (error) {
        console.error("Error generating SLA breaches report:", error);
        return serverError(res);
    }
};

// GET /api/reports/agent-performance
const getAgentPerformanceReport = async (req, res) => {
    try {
        const { from, to, agentId } = req.query;

        if (!from || !to) {
            return badRequest(res, "Both 'from' and 'to' date parameters are required");
        }

        const baseFilter = buildBaseFilter(req);

        // If specific agent requested
        if (agentId) {
            baseFilter.assignedAgentId = agentId;
        }

        // Get agent performance metrics
        const agentMetrics = await Ticket.aggregate([
            { $match: { ...baseFilter, assignedAgentId: { $ne: null } } },
            {
                $group: {
                    _id: "$assignedAgentId",
                    totalTickets: { $sum: 1 },
                    resolved: { 
                        $sum: { $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0] } 
                    },
                    open: { 
                        $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } 
                    },
                    pending: { 
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } 
                    },
                    breached: { 
                        $sum: { $cond: [{ $eq: ["$sla.breached", true] }, 1, 0] } 
                    },
                    avgResponseTimeMs: {
                        $avg: {
                            $cond: [
                                { $ne: ["$sla.firstResponseAt", null] },
                                { $subtract: ["$sla.firstResponseAt", "$createdAt"] },
                                null
                            ]
                        }
                    },
                    avgResolutionTimeMs: {
                        $avg: {
                            $cond: [
                                { $ne: ["$sla.resolvedAt", null] },
                                { $subtract: ["$sla.resolvedAt", "$createdAt"] },
                                null
                            ]
                        }
                    },
                    ticketsWithResponse: {
                        $sum: { $cond: [{ $ne: ["$sla.firstResponseAt", null] }, 1, 0] }
                    },
                    ticketsResolved: {
                        $sum: { $cond: [{ $ne: ["$sla.resolvedAt", null] }, 1, 0] }
                    }
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
                    agentName: "$agent.name",
                    agentEmail: "$agent.email",
                    companyID: "$agent.companyID",
                    totalTickets: 1,
                    resolved: 1,
                    open: 1,
                    pending: 1,
                    breached: 1,
                    avgResponseTimeMs: 1,
                    avgResolutionTimeMs: 1,
                    ticketsWithResponse: 1,
                    ticketsResolved: 1
                }
            },
            { $sort: { totalTickets: -1 } }
        ]);

        // Calculate additional metrics for each agent
        const agentPerformance = agentMetrics.map(agent => {
            const avgResponseMinutes = agent.avgResponseTimeMs 
                ? agent.avgResponseTimeMs / 60000 
                : null;
            const avgResolutionMinutes = agent.avgResolutionTimeMs 
                ? agent.avgResolutionTimeMs / 60000 
                : null;

            const resolutionRate = agent.totalTickets > 0 
                ? ((agent.resolved / agent.totalTickets) * 100).toFixed(2) 
                : 0;
            const breachRate = agent.totalTickets > 0 
                ? ((agent.breached / agent.totalTickets) * 100).toFixed(2) 
                : 0;

            return {
                agentId: agent._id,
                agentName: agent.agentName,
                agentEmail: agent.agentEmail,
                companyID: agent.companyID,
                tickets: {
                    total: agent.totalTickets,
                    resolved: agent.resolved,
                    open: agent.open,
                    pending: agent.pending,
                    resolutionRate: resolutionRate + "%"
                },
                sla: {
                    breached: agent.breached,
                    breachRate: breachRate + "%"
                },
                performance: {
                    avgFirstResponse: {
                        minutes: avgResponseMinutes ? Math.round(avgResponseMinutes) : null,
                        formatted: formatDuration(avgResponseMinutes)
                    },
                    avgResolution: {
                        minutes: avgResolutionMinutes ? Math.round(avgResolutionMinutes) : null,
                        hours: avgResolutionMinutes ? (avgResolutionMinutes / 60).toFixed(2) : null,
                        formatted: formatDuration(avgResolutionMinutes)
                    },
                    ticketsWithResponse: agent.ticketsWithResponse,
                    ticketsResolved: agent.ticketsResolved
                }
            };
        });

        // Calculate team averages
        const teamTotals = agentPerformance.reduce((acc, agent) => {
            acc.totalTickets += agent.tickets.total;
            acc.resolved += agent.tickets.resolved;
            acc.breached += agent.sla.breached;
            return acc;
        }, { totalTickets: 0, resolved: 0, breached: 0 });

        const teamAvgResponseMs = agentMetrics.reduce((sum, a) => 
            sum + (a.avgResponseTimeMs || 0), 0) / agentMetrics.filter(a => a.avgResponseTimeMs).length || 0;
        const teamAvgResolutionMs = agentMetrics.reduce((sum, a) => 
            sum + (a.avgResolutionTimeMs || 0), 0) / agentMetrics.filter(a => a.avgResolutionTimeMs).length || 0;

        return success(res, {
            report: "Agent Performance",
            dateRange: { from, to },
            teamSummary: {
                totalAgents: agentPerformance.length,
                totalTickets: teamTotals.totalTickets,
                totalResolved: teamTotals.resolved,
                totalBreached: teamTotals.breached,
                teamResolutionRate: teamTotals.totalTickets > 0 
                    ? ((teamTotals.resolved / teamTotals.totalTickets) * 100).toFixed(2) + "%" 
                    : "0%",
                teamBreachRate: teamTotals.totalTickets > 0 
                    ? ((teamTotals.breached / teamTotals.totalTickets) * 100).toFixed(2) + "%" 
                    : "0%",
                avgFirstResponse: {
                    minutes: teamAvgResponseMs ? Math.round(teamAvgResponseMs / 60000) : null,
                    formatted: formatDuration(teamAvgResponseMs / 60000)
                },
                avgResolution: {
                    minutes: teamAvgResolutionMs ? Math.round(teamAvgResolutionMs / 60000) : null,
                    formatted: formatDuration(teamAvgResolutionMs / 60000)
                }
            },
            agents: agentPerformance
        }, "Agent performance report generated successfully");

    } catch (error) {
        console.error("Error generating agent performance report:", error);
        return serverError(res);
    }
};

export { 
    getTicketsPerDay, 
    getResponseTimeReport, 
    getResolutionTimeReport, 
    getSLABreachesReport, 
    getAgentPerformanceReport 
};