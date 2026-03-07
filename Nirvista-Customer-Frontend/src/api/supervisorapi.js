import API from "./axios";

export const createSupervisor = (data) => API.post("/api/supervisors", data);
export const getSupervisors = () => API.get("/api/supervisors");
export const getSupervisorById = (id) => API.get(`/api/supervisors/${id}`);
export const updateSupervisor = (id, data) => API.put(`/api/supervisors/${id}`, data);
export const deleteSupervisor = (id) => API.delete(`/api/supervisors/${id}`);
