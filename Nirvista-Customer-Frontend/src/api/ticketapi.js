import API from "./axios";

export const createTicketChat = (data) =>
  API.post("/api/tickets/chat", data);

export const getTickets = () =>
  API.get("/api/tickets");

export const getTicketById = (id) =>
  API.get(`/api/tickets/${id}`);