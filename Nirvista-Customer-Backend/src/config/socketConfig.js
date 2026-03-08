import { Server } from "socket.io";
import Ticket from "../models/ticketModel.js";
import Widget from "../models/widgetModel.js";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";

let io;

const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Middleware for authentication (optional for customers, required for agents)
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        const widgetId = socket.handshake.auth.widgetId;
        const userType = socket.handshake.auth.userType; // 'customer' or 'agent'

        if (userType === "customer") {
            // Validate widget for customers
            if (!widgetId) {
                return next(new Error("Widget ID required"));
            }

            const widget = await Widget.findOne({ widgetId, isActive: true });
            if (!widget) {
                return next(new Error("Invalid or inactive widget"));
            }

            socket.userType = "customer";
            socket.widgetId = widgetId;
            socket.companyID = widget.companyID;
            next();
        } else if (userType === "agent") {
            // Validate JWT for agents
            if (!token) {
                return next(new Error("Authentication required"));
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id);
                
                if (!user || !["agent", "supervisor", "admin"].includes(user.role)) {
                    return next(new Error("Unauthorized"));
                }

                socket.userType = "agent";
                socket.userId = user._id.toString();
                socket.userName = user.name;
                socket.userEmail = user.email;
                socket.companyID = user.companyID;
                socket.role = user.role;
                next();
            } catch (error) {
                return next(new Error("Invalid token"));
            }
        } else {
            return next(new Error("Invalid user type"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id} (${socket.userType})`);

        // Customer events
        if (socket.userType === "customer") {
            handleCustomerConnection(socket);
        }

        // Agent events
        if (socket.userType === "agent") {
            handleAgentConnection(socket);
        }

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

// Handle customer socket events
const handleCustomerConnection = (socket) => {
    // Customer joins with pre-chat form data and starts a new chat
    socket.on("customer:start_chat", async (data) => {
        try {
            const { name, email, phone, message, pageUrl } = data;

            // Validate required fields
            if (!email || !message) {
                socket.emit("error", { message: "Email and message are required" });
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                socket.emit("error", { message: "Invalid email format" });
                return;
            }

            // Import auto-assign function
            const { autoAssignNewTicket } = await import("../services/ticketAssignmentService.js");

            // SLA defaults
            const now = new Date();
            const firstResponseDue = new Date(now.getTime() + 4 * 60 * 60 * 1000);
            const resolutionDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Create new ticket
            const ticket = new Ticket({
                companyID: socket.companyID,
                widgetId: socket.widgetId,
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

            // Auto-assign ticket to an agent
            const assignmentResult = await autoAssignNewTicket(ticket);

            // Store ticket info in socket
            socket.ticketId = ticket.ticketId;
            socket.customerEmail = email.toLowerCase();
            socket.customerName = name || "Anonymous";

            // Join ticket room
            socket.join(`ticket:${ticket.ticketId}`);

            // Send confirmation to customer
            socket.emit("chat:started", {
                ticketId: ticket.ticketId,
                status: assignmentResult.success ? "open" : "new",
                assignedAgent: assignmentResult.success ? {
                    name: assignmentResult.agentName
                } : null,
                message: {
                    sender: "customer",
                    senderName: name || "Anonymous",
                    content: message,
                    createdAt: now
                }
            });

            // Notify assigned agent if any
            if (assignmentResult.success) {
                io.to(`agent:${assignmentResult.agentId}`).emit("ticket:new", {
                    ticketId: ticket.ticketId,
                    customer: {
                        name: name || "Anonymous",
                        email: email.toLowerCase()
                    },
                    subject: ticket.subject,
                    priority: ticket.priority
                });
            }

            // Send system welcome message
            const systemMessage = {
                sender: "system",
                senderName: "System",
                content: assignmentResult.success 
                    ? `You are now connected with ${assignmentResult.agentName}`
                    : "Thank you for reaching out. An agent will be with you shortly.",
                createdAt: new Date()
            };

            ticket.conversation.push(systemMessage);
            await ticket.save();

            socket.emit("message:received", systemMessage);

        } catch (error) {
            console.error("Error starting chat:", error);
            socket.emit("error", { message: "Failed to start chat. Please try again." });
        }
    });

    // Customer joins existing chat
    socket.on("customer:join_chat", async (data) => {
        try {
            const { ticketId, email } = data;

            if (!ticketId || !email) {
                socket.emit("error", { message: "Ticket ID and email are required" });
                return;
            }

            const ticket = await Ticket.findOne({ 
                ticketId, 
                "customer.email": email.toLowerCase(),
                widgetId: socket.widgetId
            });

            if (!ticket) {
                socket.emit("error", { message: "Chat not found" });
                return;
            }

            if (ticket.status === "closed") {
                socket.emit("error", { message: "This chat has been closed" });
                return;
            }

            // Store ticket info in socket
            socket.ticketId = ticket.ticketId;
            socket.customerEmail = email.toLowerCase();
            socket.customerName = ticket.customer.name;

            // Join ticket room
            socket.join(`ticket:${ticket.ticketId}`);

            // Send chat history
            socket.emit("chat:history", {
                ticketId: ticket.ticketId,
                status: ticket.status,
                customer: ticket.customer,
                conversation: ticket.conversation.map(msg => ({
                    sender: msg.sender,
                    senderName: msg.senderName,
                    content: msg.content,
                    attachments: msg.attachments,
                    createdAt: msg.createdAt
                }))
            });

        } catch (error) {
            console.error("Error joining chat:", error);
            socket.emit("error", { message: "Failed to join chat" });
        }
    });

    // Customer sends message
    socket.on("customer:send_message", async (data) => {
        try {
            const { content, attachments } = data;

            if (!socket.ticketId) {
                socket.emit("error", { message: "Please start a chat first" });
                return;
            }

            if (!content || content.trim().length === 0) {
                socket.emit("error", { message: "Message cannot be empty" });
                return;
            }

            const ticket = await Ticket.findOne({ ticketId: socket.ticketId });

            if (!ticket) {
                socket.emit("error", { message: "Chat not found" });
                return;
            }

            if (ticket.status === "closed") {
                socket.emit("error", { message: "This chat has been closed" });
                return;
            }

            const now = new Date();

            // Process attachments
            const processedAttachments = Array.isArray(attachments)
                ? attachments.map(att => ({
                    filename: att.filename || "",
                    url: att.url || "",
                    size: att.size || 0,
                    mimeType: att.mimeType || ""
                }))
                : [];

            // Create message
            const message = {
                sender: "customer",
                senderEmail: socket.customerEmail,
                senderName: socket.customerName,
                content: content.trim(),
                attachments: processedAttachments,
                createdAt: now
            };

            // Add message to conversation
            ticket.conversation.push(message);

            // Reopen ticket if resolved or pending
            if (ticket.status === "resolved") {
                ticket.status = "open";
                ticket.sla.resolvedAt = null;
            }
            if (ticket.status === "pending") {
                ticket.status = "open";
            }

            await ticket.save();

            // Broadcast message to all in the ticket room (including agents)
            io.to(`ticket:${ticket.ticketId}`).emit("message:received", {
                ticketId: ticket.ticketId,
                message: {
                    sender: message.sender,
                    senderName: message.senderName,
                    content: message.content,
                    attachments: message.attachments,
                    createdAt: message.createdAt
                }
            });

            // Notify assigned agent specifically
            if (ticket.assignedAgentId) {
                io.to(`agent:${ticket.assignedAgentId}`).emit("ticket:customer_message", {
                    ticketId: ticket.ticketId,
                    customer: ticket.customer,
                    message: {
                        content: message.content,
                        createdAt: message.createdAt
                    }
                });
            }

        } catch (error) {
            console.error("Error sending customer message:", error);
            socket.emit("error", { message: "Failed to send message" });
        }
    });

    // Customer typing indicator
    socket.on("customer:typing", () => {
        if (socket.ticketId) {
            socket.to(`ticket:${socket.ticketId}`).emit("typing:customer", {
                ticketId: socket.ticketId,
                customerName: socket.customerName
            });
        }
    });

    socket.on("customer:stop_typing", () => {
        if (socket.ticketId) {
            socket.to(`ticket:${socket.ticketId}`).emit("typing:customer_stopped", {
                ticketId: socket.ticketId
            });
        }
    });
};

// Handle agent socket events
const handleAgentConnection = (socket) => {
    // Agent joins their personal room for notifications
    socket.join(`agent:${socket.userId}`);
    socket.join(`company:${socket.companyID}`);

    console.log(`Agent ${socket.userName} joined rooms: agent:${socket.userId}, company:${socket.companyID}`);

    // Agent joins specific ticket chat
    socket.on("agent:join_ticket", async (data) => {
        try {
            const { ticketId } = data;

            const ticket = await Ticket.findOne({ ticketId })
                .populate("assignedAgentId", "name email");

            if (!ticket) {
                socket.emit("error", { message: "Ticket not found" });
                return;
            }

            // Check access based on role
            if (socket.role === "agent") {
                if (!ticket.assignedAgentId || 
                    ticket.assignedAgentId._id.toString() !== socket.userId) {
                    socket.emit("error", { message: "You don't have access to this ticket" });
                    return;
                }
            } else if (socket.role === "supervisor") {
                if (ticket.companyID !== socket.companyID) {
                    socket.emit("error", { message: "You don't have access to this ticket" });
                    return;
                }
            }

            // Join ticket room
            socket.join(`ticket:${ticketId}`);
            socket.currentTicketId = ticketId;

            // Send chat history
            socket.emit("chat:history", {
                ticketId: ticket.ticketId,
                status: ticket.status,
                priority: ticket.priority,
                customer: ticket.customer,
                assignedAgent: ticket.assignedAgentId ? {
                    id: ticket.assignedAgentId._id,
                    name: ticket.assignedAgentId.name,
                    email: ticket.assignedAgentId.email
                } : null,
                conversation: ticket.conversation.map(msg => ({
                    sender: msg.sender,
                    senderName: msg.senderName,
                    senderEmail: msg.senderEmail,
                    content: msg.content,
                    attachments: msg.attachments,
                    createdAt: msg.createdAt
                })),
                sla: ticket.sla
            });

            // Notify customer that agent joined
            socket.to(`ticket:${ticketId}`).emit("agent:joined", {
                ticketId: ticketId,
                agentName: socket.userName
            });

        } catch (error) {
            console.error("Error joining ticket:", error);
            socket.emit("error", { message: "Failed to join ticket" });
        }
    });

    // Agent leaves ticket chat
    socket.on("agent:leave_ticket", (data) => {
        const { ticketId } = data;
        socket.leave(`ticket:${ticketId}`);
        socket.currentTicketId = null;
    });

    // Agent sends message
    socket.on("agent:send_message", async (data) => {
        try {
            const { ticketId, content, attachments } = data;

            if (!ticketId) {
                socket.emit("error", { message: "Ticket ID is required" });
                return;
            }

            if (!content || content.trim().length === 0) {
                socket.emit("error", { message: "Message cannot be empty" });
                return;
            }

            const ticket = await Ticket.findOne({ ticketId });

            if (!ticket) {
                socket.emit("error", { message: "Ticket not found" });
                return;
            }

            // Check access
            if (socket.role === "agent") {
                if (!ticket.assignedAgentId || 
                    ticket.assignedAgentId.toString() !== socket.userId) {
                    socket.emit("error", { message: "You can only reply to tickets assigned to you" });
                    return;
                }
            } else if (socket.role === "supervisor") {
                if (ticket.companyID !== socket.companyID) {
                    socket.emit("error", { message: "You don't have access to this ticket" });
                    return;
                }
            }

            const now = new Date();

            // Check if first response
            const isFirstAgentResponse = !ticket.conversation.some(msg => msg.sender === "agent");

            // Process attachments
            const processedAttachments = Array.isArray(attachments)
                ? attachments.map(att => ({
                    filename: att.filename || "",
                    url: att.url || "",
                    size: att.size || 0,
                    mimeType: att.mimeType || ""
                }))
                : [];

            // Create message
            const message = {
                sender: "agent",
                senderEmail: socket.userEmail,
                senderName: socket.userName,
                content: content.trim(),
                attachments: processedAttachments,
                createdAt: now
            };

            // Add message to conversation
            ticket.conversation.push(message);

            // Update SLA if first response
            if (isFirstAgentResponse) {
                ticket.sla.firstResponseAt = now;
                if (ticket.sla.firstResponseDue && now > ticket.sla.firstResponseDue) {
                    ticket.sla.breached = true;
                }
                if (ticket.status === "new") {
                    ticket.status = "open";
                }
            }

            await ticket.save();

            // Broadcast message to all in the ticket room
            io.to(`ticket:${ticketId}`).emit("message:received", {
                ticketId: ticketId,
                message: {
                    sender: message.sender,
                    senderName: message.senderName,
                    content: message.content,
                    attachments: message.attachments,
                    createdAt: message.createdAt
                },
                isFirstResponse: isFirstAgentResponse
            });

        } catch (error) {
            console.error("Error sending agent message:", error);
            socket.emit("error", { message: "Failed to send message" });
        }
    });

    // Agent typing indicator
    socket.on("agent:typing", (data) => {
        const { ticketId } = data;
        if (ticketId) {
            socket.to(`ticket:${ticketId}`).emit("typing:agent", {
                ticketId: ticketId,
                agentName: socket.userName
            });
        }
    });

    socket.on("agent:stop_typing", (data) => {
        const { ticketId } = data;
        if (ticketId) {
            socket.to(`ticket:${ticketId}`).emit("typing:agent_stopped", {
                ticketId: ticketId
            });
        }
    });

    // Agent updates ticket status
    socket.on("agent:update_status", async (data) => {
        try {
            const { ticketId, status } = data;
            const { updateAgentStatus } = await import("../services/ticketAssignmentService.js");

            const validStatuses = ["open", "pending", "resolved", "closed"];
            if (!validStatuses.includes(status)) {
                socket.emit("error", { message: "Invalid status" });
                return;
            }

            const ticket = await Ticket.findOne({ ticketId });

            if (!ticket) {
                socket.emit("error", { message: "Ticket not found" });
                return;
            }

            // Check access
            if (socket.role === "agent" && 
                (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== socket.userId)) {
                socket.emit("error", { message: "You don't have access to this ticket" });
                return;
            }

            const previousStatus = ticket.status;
            ticket.status = status;

            // Update SLA on resolution
            if (status === "resolved" && !ticket.sla.resolvedAt) {
                ticket.sla.resolvedAt = new Date();
                if (ticket.sla.resolutionDue && new Date() > ticket.sla.resolutionDue) {
                    ticket.sla.breached = true;
                }
            }

            await ticket.save();

            // Update agent status if ticket resolved/closed
            if ((status === "resolved" || status === "closed") && ticket.assignedAgentId) {
                await updateAgentStatus(ticket.assignedAgentId);
            }

            // Broadcast status update
            io.to(`ticket:${ticketId}`).emit("ticket:status_updated", {
                ticketId: ticketId,
                status: status,
                previousStatus: previousStatus,
                updatedBy: socket.userName
            });

            // Send system message
            const systemMessage = {
                sender: "system",
                senderName: "System",
                content: `Ticket is "${status}" by ${socket.userName}`,
                createdAt: new Date()
            };

            ticket.conversation.push(systemMessage);
            await ticket.save();

            io.to(`ticket:${ticketId}`).emit("message:received", {
                ticketId: ticketId,
                message: systemMessage
            });

        } catch (error) {
            console.error("Error updating status:", error);
            socket.emit("error", { message: "Failed to update status" });
        }
    });
};

// Utility function to get io instance
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};

// Utility function to emit to specific ticket room
const emitToTicket = (ticketId, event, data) => {
    if (io) {
        io.to(`ticket:${ticketId}`).emit(event, data);
    }
};

// Utility function to emit to specific agent
const emitToAgent = (agentId, event, data) => {
    if (io) {
        io.to(`agent:${agentId}`).emit(event, data);
    }
};

// Utility function to emit to company
const emitToCompany = (companyID, event, data) => {
    if (io) {
        io.to(`company:${companyID}`).emit(event, data);
    }
};

export { 
    initializeSocket, 
    getIO, 
    emitToTicket, 
    emitToAgent, 
    emitToCompany 
};