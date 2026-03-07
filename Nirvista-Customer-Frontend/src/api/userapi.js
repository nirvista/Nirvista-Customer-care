import API from "./axios";

export const getAdmin = () =>
  API.get("/api/users/admin");

export const getSupervisor = () =>
  API.get("/api/users/supervisor");

export const getAgent = () =>
  API.get("/api/users/agent");