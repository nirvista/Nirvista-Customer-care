import API from "./axios";

export const createAgent = (data) =>
  API.post("/api/agents", data);

export const getAgents = () =>
  API.get("/api/agents");

export const getAgentById = (id) =>
  API.get(`/api/agents/${id}`);

export const updateAgent = (id, data) =>
  API.put(`/api/agents/${id}`, data);

export const deleteAgent = (id) =>
  API.delete(`/api/agents/${id}`);