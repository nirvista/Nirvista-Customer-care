import express from "express";
import { getTickets, getTicketById, createTicketFromChat, assignTicket, updateTicketStatus, updateTicketPriority, updateTicketTags, addAgentMessage, addCustomerMessage, addTicketNote, getTicketNotes, updateTicketNote, getTicketSLA } from "../controllers/ticketController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

const router = express.Router();

// POST /api/tickets/chat - Create ticket from chat widget
router.post("/chat", createTicketFromChat);

// GET /api/tickets - List tickets with filters
router.get("/", verifyToken, authorizeRoles("admin", "supervisor", "agent"), getTickets);

// GET /api/tickets/:ticketId - Get ticket details
router.get("/:ticketId", verifyToken, authorizeRoles("admin", "supervisor", "agent"), getTicketById);

// PUT /api/tickets/:ticketId/assign - Assign ticket to agent (admin, supervisor only)
router.put("/:ticketId/assign", verifyToken, authorizeRoles("admin", "supervisor"), assignTicket);

// PUT /api/tickets/:ticketId/status - Update ticket status (admin, supervisor, agent)
router.put("/:ticketId/status", verifyToken, authorizeRoles("admin", "supervisor", "agent"), updateTicketStatus);

// PUT /api/tickets/:ticketId/priority - Update ticket priority (admin, supervisor only)
router.put("/:ticketId/priority", verifyToken, authorizeRoles("admin", "supervisor"), updateTicketPriority);

// PUT /api/tickets/:ticketId/tags - Update ticket tags (admin, supervisor, agent)
router.put("/:ticketId/tags", verifyToken, authorizeRoles("admin", "supervisor", "agent"), updateTicketTags);

// POST /api/tickets/:ticketId/messages - Add agent message/reply (admin, supervisor, agent)
router.post("/:ticketId/messages", verifyToken, authorizeRoles("admin", "supervisor", "agent"), addAgentMessage);

// POST /api/tickets/:ticketId/customer-message - Add customer message to existing chat ticket (Public)
router.post("/:ticketId/customer-message", addCustomerMessage);

// POST /api/tickets/:ticketId/notes - Add internal note (admin, supervisor, agent)
router.post("/:ticketId/notes", verifyToken, authorizeRoles("admin", "supervisor", "agent"), addTicketNote);

// GET /api/tickets/:ticketId/notes - Get internal notes (admin, supervisor, agent)
router.get("/:ticketId/notes", verifyToken, authorizeRoles("admin", "supervisor", "agent"), getTicketNotes);

// PUT /api/tickets/:ticketId/notes/:noteId - Update internal note (admin, supervisor, agent)
router.put("/:ticketId/notes/:noteId", verifyToken, authorizeRoles("admin", "supervisor", "agent"), updateTicketNote);

// GET /api/tickets/:ticketId/sla - Get ticket SLA details
router.get("/:ticketId/sla", verifyToken, authorizeRoles("admin", "supervisor", "agent"), getTicketSLA);

export default router;