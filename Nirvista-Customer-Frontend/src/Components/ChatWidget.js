import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './ChatWidget.css';

const ChatWidget = ({
    widgetId,
    serverUrl = process.env.REACT_APP_API_BASE_URL || 'https://nirvista-customer-care.onrender.com',
    primaryColor = '#0b7d7b',
    welcomeMessage = 'Hi! How can we help you today?',
    position = 'bottom-right'
}) => {
    // State
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState('prechat'); // 'prechat' | 'chat'
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [ticketId, setTicketId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [agentTyping, setAgentTyping] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [customerInfo, setCustomerInfo] = useState({ name: '', email: '' });
    const [error, setError] = useState(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    // Initialize socket connection
    useEffect(() => {
        if (!widgetId) return;

        const newSocket = io(serverUrl, {
            auth: {
                widgetId,
                userType: 'customer'
            },
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('Connected to chat server');
            setConnected(true);
            setError(null);
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from chat server');
            setConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('Connection error:', err.message);
            setError('Unable to connect to chat server');
            setConnected(false);
        });

        newSocket.on('error', (data) => {
            setError(data.message);
        });

        newSocket.on('chat:started', (data) => {
            setTicketId(data.ticketId);
            setView('chat');
            if (data.message) {
                setMessages([data.message]);
            }
        });

        newSocket.on('chat:history', (data) => {
            setTicketId(data.ticketId);
            setMessages(data.conversation || []);
            setView('chat');
        });

        newSocket.on('message:received', (data) => {
            setMessages(prev => [...prev, data.message || data]);
        });

        newSocket.on('typing:agent', () => {
            setAgentTyping(true);
        });

        newSocket.on('typing:agent_stopped', () => {
            setAgentTyping(false);
        });

        newSocket.on('agent:joined', (data) => {
            setMessages(prev => [...prev, {
                sender: 'system',
                senderName: 'System',
                content: `${data.agentName} has joined the chat`,
                createdAt: new Date()
            }]);
        });

        newSocket.on('ticket:status_updated', (data) => {
            if (data.status === 'closed') {
                setMessages(prev => [...prev, {
                    sender: 'system',
                    senderName: 'System',
                    content: 'This chat has been closed',
                    createdAt: new Date()
                }]);
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [widgetId, serverUrl]);

    // Handle pre-chat form submission
    const handleStartChat = (e) => {
        e.preventDefault();
        if (!customerInfo.name.trim() || !customerInfo.email.trim()) {
            setError('Please fill in all required fields');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerInfo.email)) {
            setError('Please enter a valid email address');
            return;
        }

        setError(null);

        // Check for existing session
        const savedSession = localStorage.getItem(`chat_session_${widgetId}`);
        if (savedSession) {
            const session = JSON.parse(savedSession);
            if (session.email === customerInfo.email.toLowerCase()) {
                socket.emit('customer:join_chat', {
                    ticketId: session.ticketId,
                    email: customerInfo.email
                });
                return;
            }
        }

        // Start new chat - require initial message
        const initialMessage = document.getElementById('initial-message')?.value;
        if (!initialMessage?.trim()) {
            setError('Please enter your message');
            return;
        }

        socket.emit('customer:start_chat', {
            name: customerInfo.name.trim(),
            email: customerInfo.email.trim().toLowerCase(),
            message: initialMessage.trim(),
            pageUrl: window.location.href
        });

        // Save session
        localStorage.setItem(`chat_session_${widgetId}`, JSON.stringify({
            email: customerInfo.email.toLowerCase(),
            name: customerInfo.name
        }));
    };

    // Handle sending message
    const handleSendMessage = useCallback(() => {
        if ((!inputMessage.trim() && attachments.length === 0) || !socket || !ticketId) return;

        socket.emit('customer:send_message', {
            content: inputMessage.trim(),
            attachments: attachments
        });

        setInputMessage('');
        setAttachments([]);
        
        // Stop typing indicator
        socket.emit('customer:stop_typing');
    }, [inputMessage, attachments, socket, ticketId]);

    // Handle typing indicator
    const handleTyping = (e) => {
        setInputMessage(e.target.value);

        if (!socket || !ticketId) return;

        if (!isTyping) {
            setIsTyping(true);
            socket.emit('customer:typing');
        }

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit('customer:stop_typing');
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
            files.forEach(file => formData.append('files', file));

            const response = await fetch(`${serverUrl}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setAttachments(prev => [...prev, ...data.files]);
            } else {
                setError(data.message || 'Upload failed');
            }
        } catch (err) {
            setError('Failed to upload files');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Remove attachment
    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Format time
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // CSS variables for theming
    const cssVars = {
        '--primary-color': primaryColor,
        '--position-right': position === 'bottom-right' ? '20px' : 'auto',
        '--position-left': position === 'bottom-left' ? '20px' : 'auto'
    };

    return (
        <div className="nirvista-chat-widget" style={cssVars}>
            {/* Toggle Button */}
            <button
                className="chat-toggle-btn"
                onClick={() => setIsOpen(!isOpen)}
                style={{ backgroundColor: primaryColor }}
            >
                {isOpen ? (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="chat-window">
                    {/* Header */}
                    <div className="chat-header" style={{ backgroundColor: primaryColor }}>
                        <div className="header-info">
                            <h3>Customer Support</h3>
                            <span className={`status ${connected ? 'online' : 'offline'}`}>
                                {connected ? 'Online' : 'Connecting...'}
                            </span>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-banner">
                            {error}
                            <button onClick={() => setError(null)}>×</button>
                        </div>
                    )}

                    {/* Pre-chat Form */}
                    {view === 'prechat' && (
                        <div className="prechat-form">
                            <div className="welcome-message">
                                <p>{welcomeMessage}</p>
                            </div>
                            <form onSubmit={handleStartChat}>
                                <div className="form-group">
                                    <label htmlFor="name">Name *</label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={customerInfo.name}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Your name"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="email">Email *</label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={customerInfo.email}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="Your email"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="initial-message">Message *</label>
                                    <textarea
                                        id="initial-message"
                                        placeholder="How can we help you?"
                                        rows="3"
                                        required
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    className="start-chat-btn"
                                    style={{ backgroundColor: primaryColor }}
                                    disabled={!connected}
                                >
                                    Start Chat
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Chat View */}
                    {view === 'chat' && (
                        <>
                            {/* Messages */}
                            <div className="messages-container">
                                {messages.map((msg, index) => (
                                    <div 
                                        key={index} 
                                        className={`message ${msg.sender === 'customer' ? 'outgoing' : msg.sender === 'system' ? 'system' : 'incoming'}`}
                                    >
                                        {msg.sender !== 'customer' && msg.sender !== 'system' && (
                                            <div className="sender-name">{msg.senderName}</div>
                                        )}
                                        <div className="message-content">
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
                                                            📎 {att.filename}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                                    </div>
                                ))}
                                {agentTyping && (
                                    <div className="message incoming typing">
                                        <div className="typing-indicator">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Attachments Preview */}
                            {attachments.length > 0 && (
                                <div className="attachments-preview">
                                    {attachments.map((att, index) => (
                                        <div key={index} className="attachment-item">
                                            <span>📎 {att.filename}</span>
                                            <button onClick={() => removeAttachment(index)}>×</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Input Area */}
                            <div className="input-area">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    multiple
                                    style={{ display: 'none' }}
                                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
                                />
                                <button 
                                    className="attachment-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    {uploading ? '...' : '📎'}
                                </button>
                                <textarea
                                    value={inputMessage}
                                    onChange={handleTyping}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Type a message..."
                                    rows="1"
                                />
                                <button 
                                    className="send-btn"
                                    onClick={handleSendMessage}
                                    disabled={!inputMessage.trim() && attachments.length === 0}
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                                    </svg>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatWidget;