import API from "./axios";

export const createChatWidget = (data) =>
  API.post("/api/chat-widgets", data);

export const getChatWidgets = () =>
  API.get("/api/chat-widgets");

export const getChatWidgetById = (id) =>
  API.get(`/api/chat-widgets/${id}`);

export const updateChatWidget = (id, data) =>
  API.put(`/api/chat-widgets/${id}`, data);

export const deleteChatWidget = (id) =>
  API.delete(`/api/chat-widgets/${id}`);