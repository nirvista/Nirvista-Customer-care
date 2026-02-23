import express from "express";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";
import { createAgent, getAllAgents, getAgentById, updateAgent, deleteAgent } from "../controllers/agentController.js";

const router = express.Router();

//Admin only
router.post("/", verifyToken, authorizeRoles("admin"), createAgent);
router.put("/:id", verifyToken, authorizeRoles("admin"), updateAgent);
router.delete("/:id", verifyToken, authorizeRoles("admin"), deleteAgent);

//Admin and Supervisor
router.get("/", verifyToken, authorizeRoles("admin", "supervisor"), getAllAgents);
router.get("/:id", verifyToken, authorizeRoles("admin", "supervisor"), getAgentById);
export default router;