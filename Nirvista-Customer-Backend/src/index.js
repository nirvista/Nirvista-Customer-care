import express from "express";
import dotenv from "dotenv";
dotenv.config();
import dbConnect from "./config/dbConnect.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import supervisorRoutes from "./routes/supervisorRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import widgetRoutes from "./routes/widgetRoutes.js";
import cors from "cors";

dbConnect();
const app = express();

app.use(cors({
  origin: "*"|| "https://localhost:3000"
}));

//Middleware
app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/supervisors", supervisorRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/chat-widgets", widgetRoutes);

//Start the server
const PORT = process.env.PORT || 7002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});