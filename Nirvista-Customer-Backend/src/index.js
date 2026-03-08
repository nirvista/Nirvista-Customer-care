import express from "express";
import dotenv from "dotenv";
dotenv.config();
import dbConnect from "./config/dbConnect.js";
import { initializeSocket } from "./config/socketConfig.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import supervisorRoutes from "./routes/supervisorRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import widgetRoutes from "./routes/widgetRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import startAgentStatsSync from "./jobs/agentStatsSync.js";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dbConnect();
const app = express();
const server = http.createServer(app);
initializeSocket(server);

app.use(cors({
  origin: "*"
}));

//Middleware
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/supervisors", supervisorRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/chat-widgets", widgetRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/assignment", assignmentRoutes);
app.use("/api/upload", uploadRoutes);

//Start the server
const PORT = process.env.PORT || 7002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Start scheduled job for syncing agent stats
  startAgentStatsSync();
});