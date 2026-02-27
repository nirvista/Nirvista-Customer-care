import Ticket from "../models/ticketModel.js";
import Widget from "../models/widgetModel.js";
import { success, created, notFound, serverError, forbidden, badRequest } from "../utils/responseMessages.js";

// POST /api/tickets/chat
const createTicketFromChat = async (req, res) => {
    try {
        const { widgetId, name, email, phone, message, pageUrl } = req.body;

        if (!widgetId || !email || !message) {
            return badRequest(res, "widgetId, email, and message are required");
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return badRequest(res, "Invalid email format");
        }

        const widget = await Widget.findOne({ widgetId, isActive: true });
        if (!widget) {
            return badRequest(res, "Invalid or inactive widget");
        }

        // SLA defaults (4 hours first response, 24 hours resolution)
        const now = new Date();
        const firstResponseDue = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        const resolutionDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Create ticket
        const ticket = new Ticket({
            companyId: widget.companyId,
            widgetId: widgetId,
            subject: message.substring(0, 100) + (message.length > 100 ? "..." : ""),
            status: "new",
            priority: "medium",
            channel: "chat",
            customer: {
                name: name || "Anonymous",
                email: email.toLowerCase(),
                phone: phone || null
            },
            sourceUrl: pageUrl || null,
            conversation: [{
                sender: "customer",
                senderEmail: email.toLowerCase(),
                senderName: name || "Anonymous",
                content: message,
                attachments: [],
                createdAt: now
            }],
            sla: {
                firstResponseDue,
                resolutionDue,
                breached: false
            }
        });

        await ticket.save();

        return created(res, {
            ticketId: ticket.ticketId,
            status: "new",
        }, "Ticket created successfully");

    } catch (error) {
        console.error("Error creating ticket from chat:", error);
        return serverError(res);
    }
};

// GET /api/tickets
const getTickets = async (req, res) => {
    try {
        const { role, id: userId, companyID } = req.user;
        const {
            companyId,
            status,
            priority,
            channel,
            assignedAgentId,
            createdFrom,
            createdTo,
            customerEmail,
            tag,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const filter = {};

        if (role === "agent") {
            filter.assignedAgentId = userId;
            filter.companyId = companyID;
        } else if (role === "supervisor") {
            filter.companyId = companyID;
        } else if (role === "admin" && companyId) {
            filter.companyId = companyId;
        }

        // Apply filters
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (channel) filter.channel = channel;
        if (assignedAgentId && role !== "agent") filter.assignedAgentId = assignedAgentId;
        if (customerEmail) filter["customer.email"] = customerEmail.toLowerCase();
        if (tag) filter.tags = { $in: [tag] };

        // Date range filter
        if (createdFrom || createdTo) {
            filter.createdAt = {};
            if (createdFrom) filter.createdAt.$gte = new Date(createdFrom);
            if (createdTo) filter.createdAt.$lte = new Date(createdTo);
        }

        // Search by ticketId, email, name, or subject
        if (search) {
            const searchRegex = new RegExp(search, "i");
            filter.$or = [
                { ticketId: searchRegex },
                { "customer.email": searchRegex },
                { "customer.name": searchRegex },
                { subject: searchRegex }
            ];
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tickets, totalCount] = await Promise.all([
            Ticket.find(filter)
                .select("ticketId companyId widgetId subject status priority channel customer assignedAgentId tags sla createdAt updatedAt")
                .populate("assignedAgentId", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Ticket.countDocuments(filter)
        ]);

        // Add SLA indicators
        const ticketsWithSLA = tickets.map(ticket => ({
            ...ticket,
            slaStatus: calculateSLAStatus(ticket.sla)
        }));

        return success(res, {
            tickets: ticketsWithSLA,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalCount,
                limit: parseInt(limit)
            }
        }, "Tickets retrieved successfully");

    } catch (error) {
        console.error("Error fetching tickets:", error);
        return serverError(res);
    }
};

// GET /api/tickets/:ticketId
const getTicketById = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { role, id: userId, companyID } = req.user;

        const ticket = await Ticket.findOne({ ticketId })
            .populate("assignedAgentId", "name email")
            .populate("notes.authorId", "name email")
            .lean();

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Role-based access control
        if (role === "agent" && 
            ticket.assignedAgentId?._id?.toString() !== userId.toString()) {
            return forbidden(res, "You don't have access to this ticket");
        }

        if (role === "supervisor" && 
            ticket.companyId.toString() !== companyID.toString()) {
            return forbidden(res, "You don't have access to this ticket");
        }

        // Calculate SLA indicators
        const slaIndicators = {
            status: calculateSLAStatus(ticket.sla),
            firstResponseDue: ticket.sla?.firstResponseDue,
            resolutionDue: ticket.sla?.resolutionDue,
            firstResponseMet: ticket.sla?.firstResponseAt 
                ? ticket.sla.firstResponseAt <= ticket.sla.firstResponseDue 
                : null,
            resolutionMet: ticket.sla?.resolvedAt 
                ? ticket.sla.resolvedAt <= ticket.sla.resolutionDue 
                : null,
            breached: ticket.sla?.breached || false
        };

        return success(res, {
            ...ticket,
            slaIndicators
        }, "Ticket details retrieved successfully");

    } catch (error) {
        console.error("Error fetching ticket:", error);
        return serverError(res);
    }
};

// Calculate SLA status based on due dates
const calculateSLAStatus = (sla) => {
    if (!sla) return "unknown";
    
    const now = new Date();
    
    if (sla.breached) return "breached";
    if (sla.resolvedAt && sla.resolvedAt <= sla.resolutionDue) return "met";
    
    if (sla.resolutionDue) {
        const timeRemaining = new Date(sla.resolutionDue) - now;
        const hoursRemaining = timeRemaining / (1000 * 60 * 60);
        
        if (timeRemaining < 0) return "breached";
        if (hoursRemaining <= 2) return "at_risk";
        if (hoursRemaining <= 8) return "warning";
    }
    
    return "on_track";
};

export { createTicketFromChat, getTickets, getTicketById };