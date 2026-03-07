import API from "./axios";

// LOGIN
export const loginUser = (data) =>
  API.post("/api/auth/login", data);

// ADMIN SIGNUP
export const adminSignup = (data) =>
  API.post("/api/auth/admin-signup", data);