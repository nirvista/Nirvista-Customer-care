import mongoose from "mongoose";
import Ticket from "../models/ticketModel.js";
import Widget from "../models/widgetModel.js";
import User from "../models/userModel.js";
import { autoAssignNewTicket, updateAgentStatus, processUnassignedTickets } from "../services/ticketAssignmentService.js";
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

        console.log("Widget found:", widget);
        console.log("CompanyID:", widget.companyID);
        // Create ticket
        const ticket = new Ticket({
            companyID: widget.companyID,
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

        // Auto-assign the ticket to an agent
        const assignmentResult = await autoAssignNewTicket(ticket);

        // Fetch updated ticket if assignment was successful
        let responseData = {
            ticketId: ticket.ticketId,
            status: ticket.status,
        };

        if (assignmentResult.success) {
            responseData.assignedAgent = {
                id: assignmentResult.agentId,
                name: assignmentResult.agentName,
                email: assignmentResult.agentEmail
            };
            responseData.status = "open";
        } else {
            responseData.assignmentNote = "Ticket created but not yet assigned - " + assignmentResult.reason;
        }

        return created(res, responseData, "Ticket created successfully");

    } catch (error) {
        console.error("Error creating ticket from chat:", error);
        return serverError(res);
    }
};

// GET /api/tickets
const getTickets = async (req, res) => {
    try {
        const { role, id: userId, companyID: userCompanyID } = req.user;
        const {
            companyID: queryCompanyID,
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
            filter.companyID = userCompanyID;
        } else if (role === "supervisor") {
            filter.companyID = userCompanyID;
        } else if (role === "admin" && queryCompanyID) {
            filter.companyID = queryCompanyID;
        }

        // Apply filters
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (channel) filter.channel = channel;
        if (assignedAgentId && role !== "agent") filter.assignedAgentId = assignedAgentId;
        if (customerEmail) filter["customer.email"] = customerEmail.toLowerCase();
        if (tag) filter.tags = { $in: [tag] };
        if (req.query.widgetId) filter.widgetId = req.query.widgetId;

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
                .select("ticketId companyID widgetId subject status priority channel customer assignedAgentId tags sla createdAt updatedAt")
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
            ticket.companyID !== companyID) {
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

// Assignment and Status Flows

// PUT /api/tickets/:ticketId/assign
const assignTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { agentId } = req.body;
        const { role, companyID } = req.user;

        if (!agentId) {
            return badRequest(res, "agentId is required");
        }

        // Validate agentId is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(agentId)) {
            return badRequest(res, "Invalid agentId format");
        }

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Supervisor can only assign tickets from their company
        if (role === "supervisor" && ticket.companyID !== companyID) {
            return forbidden(res, "You don't have access to this ticket");
        }

        // Find the user by MongoDB _id and verify they exist and have agent role
        const agent = await User.findById(agentId);

        if (!agent) {
            return notFound(res, "Agent not found");
        }

        if (agent.role !== "agent") {
            return badRequest(res, "User is not an agent");
        }

        // Verify agent belongs to the same company as the ticket
        if (agent.companyID !== ticket.companyID) {
            return badRequest(res, "Agent does not belong to the ticket's company");
        }

        // Additional check: Supervisor can only assign to agents from their company
        if (role === "supervisor" && agent.companyID !== companyID) {
            return forbidden(res, "Cannot assign ticket to an agent from a different company");
        }

        const previousAgentId = ticket.assignedAgentId;

        // Update ticket assignment
        ticket.assignedAgentId = agentId;

        // Update ticket
        if (ticket.status === "new") {
            ticket.status = "open";
        }
        await ticket.save();

        // Update new agent's stats
        await User.findByIdAndUpdate(agentId, {
            lastAssignedAt: new Date(),
            $inc: { activeTicketCount: 1 },
            isIdle: false
        });

        // Update previous agent's stats if there was one
        if (previousAgentId && previousAgentId.toString() !== agentId) {
            await updateAgentStatus(previousAgentId);
        }
        
        return success(res, {
            ticketId: ticket.ticketId,
            assignedAgentId: ticket.assignedAgentId,
            assignedAgentName: agent.name,
            assignedAgentEmail: agent.email,
            status: ticket.status
        }, "Ticket assigned successfully");

    } catch (error) {
        console.error("Error assigning ticket:", error);
        return serverError(res);
    }
};

// PUT /api/tickets/:ticketId/status
const updateTicketStatus = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status } = req.body;
        const { role, id: userId, companyID } = req.user;

        if (!status) {
            return badRequest(res, "status is required");
        }

        const validStatuses = ["new", "open", "pending", "resolved", "closed"];
        if (!validStatuses.includes(status)) {
            return badRequest(res, `Invalid status. Allowed values: ${validStatuses.join(", ")}`);
        }

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Role-based access control
        if (role === "agent") {
            if (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== userId.toString()) {
                return forbidden(res, "You can only update tickets assigned to you");
            }
        } else if (role === "supervisor") {
            if (ticket.companyID !== companyID) {
                return forbidden(res, "You don't have access to this ticket");
            }
        }

        // Define allowed status transitions
        const allowedTransitions = {
            "new": ["open", "closed"],
            "open": ["pending", "resolved", "closed"],
            "pending": ["open", "resolved", "closed"],
            "resolved": ["open", "closed"],
            "closed": ["open"]
        };

        const currentStatus = ticket.status;
        if (!allowedTransitions[currentStatus].includes(status)) {
            return badRequest(res, `Cannot transition from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedTransitions[currentStatus].join(", ")}`);
        }

        // Update SLA timestamps based on status change
        const now = new Date();

        if (status === "resolved" && !ticket.sla.resolvedAt) {
            ticket.sla.resolvedAt = now;
            // Check if resolution is breached
            if (ticket.sla.resolutionDue && now > ticket.sla.resolutionDue) {
                ticket.sla.breached = true;
            }
        }

        // If reopening a resolved/closed ticket, clear resolvedAt
        if ((currentStatus === "resolved" || currentStatus === "closed") && status === "open") {
            ticket.sla.resolvedAt = null;
        }

        ticket.status = status;
        await ticket.save();

        // Update agent status when ticket is resolved or closed
        if ((status === "resolved" || status === "closed") && ticket.assignedAgentId) {
            await updateAgentStatus(ticket.assignedAgentId);
        }

        return success(res, {
            ticketId: ticket.ticketId,
            status: ticket.status,
            previousStatus: currentStatus
        }, "Ticket status updated successfully");

    } catch (error) {
        console.error("Error updating ticket status:", error);
        return serverError(res);
    }
};

// PUT /api/tickets/:ticketId/priority
const updateTicketPriority = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { priority } = req.body;
        const { role, companyID, id: userId } = req.user;

        if (!priority) {
            return badRequest(res, "priority is required");
        }

        const validPriorities = ["low", "medium", "high", "urgent"];
        if (!validPriorities.includes(priority)) {
            return badRequest(res, `Invalid priority. Allowed values: ${validPriorities.join(", ")}`);
        }

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Supervisor can only update tickets from their company
        if (role === "supervisor" && ticket.companyID !== companyID) {
            return forbidden(res, "You don't have access to this ticket");
        }

        const previousPriority = ticket.priority;
        ticket.priority = priority;
        await ticket.save();

        // If ticket is unassigned, trigger reprocessing of queue
        if (!ticket.assignedAgentId) {
            // Process unassigned tickets to reassign by new priority
            setImmediate(() => {
                processUnassignedTickets().catch((error) => {
                    console.error("Error processing unassigned tickets after priority update:", error);
                });
            });
        }

        return success(res, {
            ticketId: ticket.ticketId,
            priority: ticket.priority,
            previousPriority: previousPriority
        }, "Ticket priority updated successfully");

    } catch (error) {
        console.error("Error updating ticket priority:", error);
        return serverError(res);
    }
};

// PUT /api/tickets/:ticketId/tags
const updateTicketTags = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { tags } = req.body;
        const { role, id: userId, companyID } = req.user;

        if (!tags) {
            return badRequest(res, "tags is required");
        }

        if (!Array.isArray(tags)) {
            return badRequest(res, "tags must be an array");
        }

        // Validate tags are strings and sanitize
        const sanitizedTags = tags
            .filter(tag => typeof tag === "string")
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag.length > 0);

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Role-based access control
        if (role === "agent") {
            if (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== userId.toString()) {
                return forbidden(res, "You can only update tickets assigned to you");
            }
        } else if (role === "supervisor") {
            if (ticket.companyID !== companyID) {
                return forbidden(res, "You don't have access to this ticket");
            }
        }

        const previousTags = [...ticket.tags];
        ticket.tags = sanitizedTags;
        await ticket.save();

        return success(res, {
            ticketId: ticket.ticketId,
            tags: ticket.tags,
            previousTags: previousTags
        }, "Ticket tags updated successfully");

    } catch (error) {
        console.error("Error updating ticket tags:", error);
        return serverError(res);
    }
};

// Conversation Thread and Replies

// POST /api/tickets/:ticketId/messages
const addAgentMessage = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { channel, body, attachments } = req.body;
        const { role, id: userId, companyID, name: userName, email: userEmail } = req.user;

        if (!body) {
            return badRequest(res, "body is required");
        }

        const validChannels = ["chat", "email"];
        if (channel && !validChannels.includes(channel.toLowerCase())) {
            return badRequest(res, `Invalid channel. Allowed values: ${validChannels.join(", ")}`);
        }

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Role-based access control
        if (role === "agent") {
            if (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== userId.toString()) {
                return forbidden(res, "You can only reply to tickets assigned to you");
            }
        } else if (role === "supervisor") {
            if (ticket.companyID !== companyID) {
                return forbidden(res, "You don't have access to this ticket");
            }
        }

        // Validate channel matches ticket channel if provided
        if (channel && channel.toLowerCase() !== ticket.channel) {
            return badRequest(res, `Channel mismatch. Ticket channel is '${ticket.channel}'`);
        }

        const now = new Date();

        // Check if this is the first agent response
        const isFirstAgentResponse = !ticket.conversation.some(msg => msg.sender === "agent");

        // Process attachments
        const processedAttachments = Array.isArray(attachments) 
            ? attachments.map(att => {
                if (typeof att === "string") {
                    return { filename: att, url: att };
                }
                return {
                    filename: att.filename || "",
                    url: att.url || "",
                    size: att.size || 0,
                    mimeType: att.mimeType || ""
                };
            })
            : [];

        // Create message object
        const message = {
            sender: "agent",
            senderEmail: userEmail,
            senderName: userName,
            content: body,
            attachments: processedAttachments,
            createdAt: now
        };

        // Add message to conversation
        ticket.conversation.push(message);

        // If first agent response, update status and SLA
        if (isFirstAgentResponse) {
            // Set first response timestamp
            ticket.sla.firstResponseAt = now;

            // Check if first response SLA is breached
            if (ticket.sla.firstResponseDue && now > ticket.sla.firstResponseDue) {
                ticket.sla.breached = true;
            }

            // Move ticket from 'new' to 'open' if still new
            if (ticket.status === "new") {
                ticket.status = "open";
            }
        }

        await ticket.save();

        // TODO: For email tickets, trigger email worker to send email
        // TODO: For chat tickets, push to widget via websocket/polling

        return created(res, {
            ticketId: ticket.ticketId,
            message: {
                sender: message.sender,
                senderName: message.senderName,
                content: message.content,
                attachments: message.attachments,
                createdAt: message.createdAt
            },
            status: ticket.status,
            isFirstResponse: isFirstAgentResponse,
            sla: {
                firstResponseAt: ticket.sla.firstResponseAt,
                firstResponseDue: ticket.sla.firstResponseDue,
                firstResponseMet: ticket.sla.firstResponseAt <= ticket.sla.firstResponseDue
            }
        }, "Message added successfully");

    } catch (error) {
        console.error("Error adding agent message:", error);
        return serverError(res);
    }
};

// POST /api/tickets/:ticketId/customer-message
const addCustomerMessage = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { widgetId, body, attachments } = req.body;

        if (!widgetId) {
            return badRequest(res, "widgetId is required");
        }

        if (!body) {
            return badRequest(res, "body is required");
        }

        // Verify widget exists and is active
        const widget = await Widget.findOne({ widgetId, isActive: true });
        if (!widget) {
            return badRequest(res, "Invalid or inactive widget");
        }

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Verify ticket belongs to the same widget
        if (ticket.widgetId !== widgetId) {
            return forbidden(res, "Widget does not match ticket");
        }

        // Verify ticket is a chat ticket
        if (ticket.channel !== "chat") {
            return badRequest(res, "Customer messages can only be added to chat tickets");
        }

        // Verify ticket is not closed
        if (ticket.status === "closed") {
            return badRequest(res, "Cannot add messages to a closed ticket");
        }

        const now = new Date();

        // Process attachments
        const processedAttachments = Array.isArray(attachments)
            ? attachments.map(att => {
                if (typeof att === "string") {
                    return { filename: att, url: att };
                }
                return {
                    filename: att.filename || "",
                    url: att.url || "",
                    size: att.size || 0,
                    mimeType: att.mimeType || ""
                };
            })
            : [];

        // Create message object
        const message = {
            sender: "customer",
            senderEmail: ticket.customer.email,
            senderName: ticket.customer.name,
            content: body,
            attachments: processedAttachments,
            createdAt: now
        };

        // Add message to conversation
        ticket.conversation.push(message);

        // If ticket was resolved, reopen it when customer sends a new message
        if (ticket.status === "resolved") {
            ticket.status = "open";
            ticket.sla.resolvedAt = null;
        }

        // If ticket was pending, move to open
        if (ticket.status === "pending") {
            ticket.status = "open";
        }

        await ticket.save();

        return created(res, {
            ticketId: ticket.ticketId,
            message: {
                sender: message.sender,
                senderName: message.senderName,
                content: message.content,
                attachments: message.attachments,
                createdAt: message.createdAt
            },
            status: ticket.status
        }, "Customer message added successfully");

    } catch (error) {
        console.error("Error adding customer message:", error);
        return serverError(res);
    }
};

// POST /api/tickets/:ticketId/notes
const addTicketNote = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { note } = req.body;
        const { role, id: userId, companyID, name: userName } = req.user;

        if (!note) {
            return badRequest(res, "note is required");
        }

        if (typeof note !== "string" || note.trim().length === 0) {
            return badRequest(res, "note must be a non-empty string");
        }

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Role-based access control
        if (role === "agent") {
            if (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== userId.toString()) {
                return forbidden(res, "You can only add notes to tickets assigned to you");
            }
        } else if (role === "supervisor") {
            if (ticket.companyID !== companyID) {
                return forbidden(res, "You don't have access to this ticket");
            }
        }

        const now = new Date();

        // Create note object
        const noteObj = {
            authorId: userId,
            authorName: userName,
            content: note.trim(),
            createdAt: now
        };

        // Add note to ticket
        ticket.notes.push(noteObj);
        await ticket.save();

        return created(res, {
            ticketId: ticket.ticketId,
            note: {
                authorId: noteObj.authorId,
                authorName: noteObj.authorName,
                content: noteObj.content,
                createdAt: noteObj.createdAt
            }
        }, "Note added successfully");

    } catch (error) {
        console.error("Error adding ticket note:", error);
        return serverError(res);
    }
};

// GET /api/tickets/:ticketId/notes
const getTicketNotes = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { role, id: userId, companyID } = req.user;

        const ticket = await Ticket.findOne({ ticketId })
            .select("ticketId companyID assignedAgentId notes")
            .populate("notes.authorId", "name email")
            .lean();

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Role-based access control
        if (role === "agent") {
            if (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== userId.toString()) {
                return forbidden(res, "You can only view notes for tickets assigned to you");
            }
        } else if (role === "supervisor") {
            if (ticket.companyID !== companyID) {
                return forbidden(res, "You don't have access to this ticket");
            }
        }

        // Format notes for response
        const notes = ticket.notes.map(note => ({
            authorId: note.authorId?._id || note.authorId,
            authorName: note.authorId?.name || note.authorName,
            authorEmail: note.authorId?.email || null,
            content: note.content,
            createdAt: note.createdAt
        }));

        // Sort notes by createdAt descending (newest first)
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return success(res, {
            ticketId: ticket.ticketId,
            notes: notes,
            totalNotes: notes.length
        }, "Notes retrieved successfully");

    } catch (error) {
        console.error("Error fetching ticket notes:", error);
        return serverError(res);
    }
};

// PUT /api/tickets/:ticketId/notes/:noteId
const updateTicketNote = async (req, res) => {
    try {
        const { ticketId, noteId } = req.params;
        const { note } = req.body;
        const { role, id: userId, companyID } = req.user;

        if (!note) {
            return badRequest(res, "note is required");
        }

        if (typeof note !== "string" || note.trim().length === 0) {
            return badRequest(res, "note must be a non-empty string");
        }

        const ticket = await Ticket.findOne({ ticketId });

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Find the note
        const noteIndex = ticket.notes.findIndex(n => n._id.toString() === noteId);
        if (noteIndex === -1) {
            return notFound(res, "Note not found");
        }

        const existingNote = ticket.notes[noteIndex];

        // Role-based access control - only the author or admin can edit
        if (role === "agent") {
            if (existingNote.authorId.toString() !== userId.toString()) {
                return forbidden(res, "You can only edit your own notes");
            }
        } else if (role === "supervisor") {
            if (ticket.companyID !== companyID) {
                return forbidden(res, "You don't have access to this ticket");
            }
            if (existingNote.authorId.toString() !== userId.toString()) {
                return forbidden(res, "You can only edit your own notes");
            }
        }
        // Admin can edit any note

        // Update the note
        ticket.notes[noteIndex].content = note.trim();
        ticket.notes[noteIndex].updatedAt = new Date();
        await ticket.save();

        return success(res, {
            ticketId: ticket.ticketId,
            note: {
                _id: ticket.notes[noteIndex]._id,
                authorId: ticket.notes[noteIndex].authorId,
                authorName: ticket.notes[noteIndex].authorName,
                content: ticket.notes[noteIndex].content,
                createdAt: ticket.notes[noteIndex].createdAt,
                updatedAt: ticket.notes[noteIndex].updatedAt
            }
        }, "Note updated successfully");

    } catch (error) {
        console.error("Error updating ticket note:", error);
        return serverError(res);
    }
};

// GET /api/tickets/:ticketId/sla
const getTicketSLA = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { role, id: userId, companyID } = req.user;

        const ticket = await Ticket.findOne({ ticketId })
            .select("ticketId companyID assignedAgentId status sla createdAt")
            .lean();

        if (!ticket) {
            return notFound(res, `Ticket ${ticketId} not found`);
        }

        // Role-based access control
        if (role === "agent") {
            if (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== userId.toString()) {
                return forbidden(res, "You can only view SLA for tickets assigned to you");
            }
        } else if (role === "supervisor") {
            if (ticket.companyID !== companyID) {
                return forbidden(res, "You don't have access to this ticket");
            }
        }

        const now = new Date();
        const sla = ticket.sla || {};

        // Calculate first response breach status
        let isFirstResponseBreached = false;
        if (sla.firstResponseDue) {
            if (sla.firstResponseAt) {
                // First response was made, check if it was on time
                isFirstResponseBreached = new Date(sla.firstResponseAt) > new Date(sla.firstResponseDue);
            } else {
                // No first response yet, check if it's overdue
                isFirstResponseBreached = now > new Date(sla.firstResponseDue);
            }
        }

        // Calculate resolution breach status
        let isResolutionBreached = false;
        if (sla.resolutionDue) {
            if (sla.resolvedAt) {
                // Ticket was resolved, check if it was on time
                isResolutionBreached = new Date(sla.resolvedAt) > new Date(sla.resolutionDue);
            } else if (ticket.status !== "resolved" && ticket.status !== "closed") {
                // Ticket not yet resolved, check if it's overdue
                isResolutionBreached = now > new Date(sla.resolutionDue);
            }
        }

        // Calculate open duration (time since ticket creation)
        const openDurationMs = now - new Date(ticket.createdAt);
        const openDurationMinutes = Math.floor(openDurationMs / (1000 * 60));
        const openDurationHours = Math.floor(openDurationMinutes / 60);
        const openDurationDays = Math.floor(openDurationHours / 24);

        // Calculate time to first response (if responded)
        let timeToFirstResponseMinutes = null;
        if (sla.firstResponseAt) {
            const firstResponseMs = new Date(sla.firstResponseAt) - new Date(ticket.createdAt);
            timeToFirstResponseMinutes = Math.floor(firstResponseMs / (1000 * 60));
        }

        // Calculate remaining time for first response (if not yet responded)
        let firstResponseRemainingMinutes = null;
        if (!sla.firstResponseAt && sla.firstResponseDue) {
            const remainingMs = new Date(sla.firstResponseDue) - now;
            firstResponseRemainingMinutes = Math.floor(remainingMs / (1000 * 60));
        }

        // Calculate remaining time for resolution (if not yet resolved)
        let resolutionRemainingMinutes = null;
        if (!sla.resolvedAt && sla.resolutionDue && ticket.status !== "resolved" && ticket.status !== "closed") {
            const remainingMs = new Date(sla.resolutionDue) - now;
            resolutionRemainingMinutes = Math.floor(remainingMs / (1000 * 60));
        }

        return success(res, {
            ticketId: ticket.ticketId,
            status: ticket.status,
            firstResponseDueAt: sla.firstResponseDue || null,
            firstResponseAt: sla.firstResponseAt || null,
            resolutionDueAt: sla.resolutionDue || null,
            resolvedAt: sla.resolvedAt || null,
            isFirstResponseBreached,
            isResolutionBreached,
            openDuration: {
                days: openDurationDays,
                hours: openDurationHours % 24,
                minutes: openDurationMinutes % 60,
                totalMinutes: openDurationMinutes
            },
            timeToFirstResponse: timeToFirstResponseMinutes !== null ? {
                minutes: timeToFirstResponseMinutes,
                formatted: formatDuration(timeToFirstResponseMinutes)
            } : null,
            firstResponseRemaining: firstResponseRemainingMinutes !== null ? {
                minutes: firstResponseRemainingMinutes,
                formatted: formatDuration(firstResponseRemainingMinutes),
                isOverdue: firstResponseRemainingMinutes < 0
            } : null,
            resolutionRemaining: resolutionRemainingMinutes !== null ? {
                minutes: resolutionRemainingMinutes,
                formatted: formatDuration(resolutionRemainingMinutes),
                isOverdue: resolutionRemainingMinutes < 0
            } : null
        }, "SLA details retrieved successfully");

    } catch (error) {
        console.error("Error fetching ticket SLA:", error);
        return serverError(res);
    }
};

// Helper function to format duration
const formatDuration = (totalMinutes) => {
    const isNegative = totalMinutes < 0;
    const absMinutes = Math.abs(totalMinutes);
    
    const days = Math.floor(absMinutes / (24 * 60));
    const hours = Math.floor((absMinutes % (24 * 60)) / 60);
    const minutes = absMinutes % 60;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

    return (isNegative ? "-" : "") + parts.join(" ");
};

export { 
    createTicketFromChat, 
    getTickets, 
    getTicketById, 
    assignTicket, 
    updateTicketStatus, 
    updateTicketPriority, 
    updateTicketTags,
    addAgentMessage,
    addCustomerMessage,
    addTicketNote,
    getTicketNotes,
    updateTicketNote,
    getTicketSLA
};