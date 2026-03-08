import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { 
    ArrowLeft, Send, Paperclip, User, Mail, Phone, Clock, 
    AlertCircle, CheckCircle, XCircle, MoreVertical 
} from "lucide-react";
import Layout from "../Components/Layout";
import "./TicketChat.css";

const statusOptions = ["open", "pending", "resolved", "closed"];

const statusColors = {
    new: { bg: "bg-blue-100", text: "text-blue-700" },
    open: { bg: "bg-yellow-100", text: "text-yellow-700" },
    pending: { bg: "bg-orange-100", text: "text-orange-700" },
    resolved: { bg: "bg-green-100", text: "text-green-700" },
    closed: { bg: "bg-gray-100", text: "text-gray-600" }
};
const priorityOptions = ["low", "medium", "high", "urgent"];

const priorityColors = {
    low: { bg: "bg-gray-100", text: "text-gray-700" },
    medium: { bg: "bg-blue-100", text: "text-blue-700" },
    high: { bg: "bg-orange-100", text: "text-orange-700" },
    urgent: { bg: "bg-red-100", text: "text-red-700" }
};
function TicketChat() {
    const { ticketId } = useParams();
    const navigate = useNavigate();
    const serverUrl = process.env.REACT_APP_API_URL || "http://localhost:7001";

    // State
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [customerTyping, setCustomerTyping] = useState(false);
    const [error, setError] = useState(null);
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [showPriorityMenu, setShowPriorityMenu] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Initialize socket connection
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/");
            return;
        }

        const newSocket = io(serverUrl, {
            auth: {
                token,
                userType: "agent"
            },
            transports: ["websocket", "polling"]
        });

        newSocket.on("connect", () => {
            console.log("Agent connected to chat server");
            setConnected(true);
            setError(null);
            // Join the specific ticket room
            newSocket.emit("agent:join_ticket", { ticketId });
        });

        newSocket.on("disconnect", () => {
            console.log("Disconnected from chat server");
            setConnected(false);
        });

        newSocket.on("connect_error", (err) => {
            console.error("Connection error:", err.message);
            setError("Unable to connect to chat server");
            setConnected(false);
        });

        newSocket.on("error", (data) => {
            setError(data.message);
        });

        newSocket.on("chat:history", (data) => {
            setTicket({
                ticketId: data.ticketId,
                status: data.status,
                priority: data.priority,
                customer: data.customer,
                assignedAgent: data.assignedAgent,
                sla: data.sla
            });
            setMessages(data.conversation || []);
        });

        newSocket.on("message:received", (data) => {
            const message = data.message || data;
            setMessages(prev => [...prev, message]);
        });

        newSocket.on("typing:customer", (data) => {
            setCustomerTyping(true);
        });

        newSocket.on("typing:customer_stopped", () => {
            setCustomerTyping(false);
        });

        newSocket.on("ticket:status_updated", (data) => {
            setTicket(prev => prev ? { ...prev, status: data.status } : prev);
        });

        // Notification for new tickets (when on another ticket)
        newSocket.on("ticket:new", (data) => {
            // Could show a notification here
            console.log("New ticket assigned:", data);
        });

        newSocket.on("ticket:customer_message", (data) => {
            // Notification when customer sends message
            console.log("Customer message on ticket:", data);
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) {
                newSocket.emit("agent:leave_ticket", { ticketId });
                newSocket.disconnect();
            }
        };
    }, [ticketId, serverUrl, navigate]);

    // Send message
    const handleSendMessage = useCallback(() => {
        if ((!inputMessage.trim() && attachments.length === 0) || !socket) return;

        socket.emit("agent:send_message", {
            ticketId,
            content: inputMessage.trim(),
            attachments
        });

        setInputMessage("");
        setAttachments([]);

        // Stop typing indicator
        socket.emit("agent:stop_typing", { ticketId });
    }, [inputMessage, attachments, socket, ticketId]);

    // Handle typing
    const handleTyping = (e) => {
        setInputMessage(e.target.value);

        if (!socket) return;

        socket.emit("agent:typing", { ticketId });

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("agent:stop_typing", { ticketId });
        }, 1000);
    };

    // Handle file upload
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            files.forEach(file => formData.append("files", file));

            const response = await fetch(`${serverUrl}/api/upload`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setAttachments(prev => [...prev, ...data.files]);
            } else {
                setError(data.message || "Upload failed");
            }
        } catch (err) {
            setError("Failed to upload files");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    // Remove attachment
    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Update ticket status
    const handleStatusChange = (newStatus) => {
        if (!socket) return;
        socket.emit("agent:update_status", { ticketId, status: newStatus });
        setShowStatusMenu(false);
    };

    // Update ticket priority
    const handlePriorityChange = async (newPriority) => {
        try {
            const response = await fetch(`${serverUrl}/api/tickets/${ticketId}/priority`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ priority: newPriority })
            });
        
            const data = await response.json();
            if (data.success) {
                setTicket(prev => prev ? { ...prev, priority: newPriority } : prev);
            } else {
                setError(data.message || "Failed to update priority");
            }
        } catch (err) {
            setError("Failed to update priority");
        }
        setShowPriorityMenu(false);
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Format time
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    return (
        <Layout pageTitle="Ticket Chat">
            <div className="ticket-chat-container">
                {/* Left: Chat Area */}
                <div className="chat-main">
                    {/* Chat Header */}
                    <div className="chat-header-bar">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => navigate("/tickets")}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h2 className="font-semibold text-gray-800">{ticketId}</h2>
                                <p className="text-xs text-gray-500">
                                    {ticket?.customer?.name} • {ticket?.customer?.email}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`connection-status ${connected ? "online" : "offline"}`}>
                                {connected ? "Connected" : "Connecting..."}
                            </span>
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="error-banner">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                            <button onClick={() => setError(null)}>×</button>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="messages-area">
                        {messages.length === 0 ? (
                            <div className="empty-state">
                                <p>No messages yet</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, index) => (
                                    <div
                                        key={index}
                                        className={`message-wrapper ${
                                            msg.sender === "agent" ? "outgoing" : 
                                            msg.sender === "system" ? "system" : "incoming"
                                        }`}
                                    >
                                        {msg.sender !== "agent" && msg.sender !== "system" && (
                                            <div className="message-avatar">
                                                <User className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className="message-bubble">
                                            {msg.sender !== "agent" && msg.sender !== "system" && (
                                                <span className="sender-label">{msg.senderName}</span>
                                            )}
                                            <p>{msg.content}</p>
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="message-attachments">
                                                    {msg.attachments.map((att, i) => (
                                                        <a
                                                            key={i}
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="attachment-link"
                                                        >
                                                            <Paperclip className="w-3 h-3" />
                                                            {att.filename}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            <span className="message-time">{formatTime(msg.createdAt)}</span>
                                        </div>
                                    </div>
                                ))}
                                {customerTyping && (
                                    <div className="message-wrapper incoming">
                                        <div className="message-avatar">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div className="message-bubble typing">
                                            <div className="typing-indicator">
                                                <span></span><span></span><span></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Attachments Preview */}
                    {attachments.length > 0 && (
                        <div className="attachments-preview">
                            {attachments.map((att, index) => (
                                <div key={index} className="attachment-chip">
                                    <Paperclip className="w-3 h-3" />
                                    <span>{att.filename}</span>
                                    <button onClick={() => removeAttachment(index)}>×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="input-bar">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            style={{ display: "none" }}
                            accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
                        />
                        <button
                            className="icon-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            title="Attach files"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <textarea
                            value={inputMessage}
                            onChange={handleTyping}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your reply..."
                            rows="1"
                            disabled={ticket?.status === "closed"}
                        />
                        <button
                            className="send-btn"
                            onClick={handleSendMessage}
                            disabled={(!inputMessage.trim() && attachments.length === 0) || ticket?.status === "closed"}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Right: Ticket Info Sidebar */}
                <div className="ticket-sidebar">
                    <div className="sidebar-section">
                        <h3>Ticket Details</h3>
                        <div className="detail-row">
                            <span className="label">Ticket ID</span>
                            <span className="value font-mono">{ticketId}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">Status</span>
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setShowStatusMenu(!showStatusMenu);
                                        setShowPriorityMenu(false);
                                    }}
                                    className={`status-badge ${statusColors[ticket?.status]?.bg} ${statusColors[ticket?.status]?.text}`}
                                >
                                    {ticket?.status || "loading"}
                                    <MoreVertical className="w-3 h-3 ml-1" />
                                </button>
                                {showStatusMenu && (
                                    <div className="status-menu">
                                        {statusOptions.map(status => (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusChange(status)}
                                                className={ticket?.status === status ? "active" : ""}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="detail-row">
                            <span className="label">Priority</span>
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setShowPriorityMenu(!showPriorityMenu);
                                        setShowStatusMenu(false);
                                    }}
                                    className={`status-badge ${priorityColors[ticket?.priority]?.bg} ${priorityColors[ticket?.priority]?.text}`}
                                >
                                    {ticket?.priority || "loading"}
                                    <MoreVertical className="w-3 h-3 ml-1" />
                                </button>
                                {showPriorityMenu && (
                                    <div className="status-menu">
                                        {priorityOptions.map(priority => (
                                            <button
                                                key={priority}
                                                onClick={() => handlePriorityChange(priority)}
                                                className={ticket?.priority === priority ? "active" : ""}
                                            >
                                                {priority}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <h3>Customer</h3>
                        <div className="customer-info">
                            <div className="customer-avatar">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-800">
                                    {ticket?.customer?.name || "Anonymous"}
                                </p>
                            </div>
                        </div>
                        <div className="detail-row">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="value text-sm">{ticket?.customer?.email || "—"}</span>
                        </div>
                        {ticket?.customer?.phone && (
                            <div className="detail-row">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span className="value text-sm">{ticket.customer.phone}</span>
                            </div>
                        )}
                    </div>
                    <div className="sidebar-section">
                        <h3>Agent Assigned</h3>
                        <div className="customer-info">
                            <div className="customer-avatar">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-800">
                                    {ticket?.assignedAgent?.name || "Anonymous"}
                                </p>
                            </div>
                        </div>
                        <div className="detail-row">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="value text-sm">{ticket?.assignedAgent?.email || "—"}</span>
                        </div>
                    </div>
                    {ticket?.sla && (
                        <div className="sidebar-section">
                            <h3>SLA</h3>
                            <div className="detail-row">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500">First Response Due</span>
                                    <span className="text-sm">
                                        {ticket.sla.firstResponseDue 
                                            ? formatDate(ticket.sla.firstResponseDue) 
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                            <div className="detail-row">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500">Resolution Due</span>
                                    <span className="text-sm">
                                        {ticket.sla.resolutionDue 
                                            ? formatDate(ticket.sla.resolutionDue) 
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                            {ticket.sla.breached && (
                                <div className="sla-breach">
                                    <AlertCircle className="w-4 h-4" />
                                    SLA Breached
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="sidebar-section">
                        <h3>Quick Actions</h3>
                        <div className="quick-actions">
                            <button
                                onClick={() => handleStatusChange("resolved")}
                                disabled={ticket?.status === "resolved" || ticket?.status === "closed"}
                                className="action-btn success"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Mark Resolved
                            </button>
                            <button
                                onClick={() => handleStatusChange("closed")}
                                disabled={ticket?.status === "closed"}
                                className="action-btn danger"
                            >
                                <XCircle className="w-4 h-4" />
                                Close Ticket
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default TicketChat;