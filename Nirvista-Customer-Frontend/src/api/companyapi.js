import API from "./axios";

export const createCompany = (data) =>
  API.post("/api/companies", data);

export const getCompanies = () =>
  API.get("/api/companies");

export const updateCompany = (id, data) =>
  API.put(`/api/companies/${id}`, data);

export const getCompanySLA = (id) =>
  API.get(`/api/companies/${id}/sla`);

export const deleteCompany = (id) => 
  API.delete(`/api/companies/${id}`);
