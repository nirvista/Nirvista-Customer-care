import API from "./axios";

export const createTicketChat = (data) =>
  API.post("/api/tickets/chat", data);

export const getTickets = (params) =>
  API.get("/api/tickets", { params });

export const getTicketById = (id) =>
  API.get(`/api/tickets/${id}`);

export const assignTicket = (ticketId, agentId) =>
    API.put(`/api/tickets/${ticketId}/assign`, { agentId });

export const updateTicketStatus = (ticketId, status) =>
    API.put(`/api/tickets/${ticketId}/status`, { status });

export const updateTicketPriority = (ticketId, priority) =>
    API.put(`/api/tickets/${ticketId}/priority`, { priority });

export const addAgentMessage = (ticketId, data) =>
    API.post(`/api/tickets/${ticketId}/messages`, data);

export const getTicketSLA = (ticketId) =>
    API.get(`/api/tickets/${ticketId}/sla`);