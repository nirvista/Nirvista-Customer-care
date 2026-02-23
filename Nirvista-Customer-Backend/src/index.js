import express from "express";
import dotenv from "dotenv";
dotenv.config();
import dbConnect from "./config/dbConnect.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import supervisorRoutes from "./routes/supervisorRoutes.js";

dbConnect();
const app = express();

//Middleware
app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/supervisors", supervisorRoutes);

//Start the server
const PORT = process.env.PORT || 7002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});