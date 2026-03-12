import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// Response interceptor - handle expired/invalid token
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || "";
    const status = error.response?.status;

    // Check for auth failures (400 with "invalid token" or 401)
    if (
      status === 401 ||
      (status === 400 && message.toLowerCase().includes("token"))
    ) {
      // Clear stored auth data
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("companyID");

      alert("Session expired. Please log in again.");

      // Redirect to login (only if not already there)
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default API;