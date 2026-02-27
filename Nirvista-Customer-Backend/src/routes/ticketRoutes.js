import express from "express";
import { getTickets, getTicketById, createTicketFromChat } from "../controllers/ticketController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

const router = express.Router();

// POST /api/tickets/chat - Create ticket from chat widget
router.post("/chat", createTicketFromChat);

// GET /api/tickets - List tickets with filters
router.get("/", verifyToken, authorizeRoles("admin", "supervisor", "agent"), getTickets);

// GET /api/tickets/:ticketId - Get ticket details
router.get("/:ticketId", verifyToken, authorizeRoles("admin", "supervisor", "agent"), getTicketById);

export default router;