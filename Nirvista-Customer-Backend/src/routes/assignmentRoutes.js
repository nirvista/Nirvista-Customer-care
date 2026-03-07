import mongoose from "mongoose";
import express from "express";
import { 
    processUnassignedTickets, 
    recalculateAllAgentStats,
    reassignAgentTickets 
} from "../services/ticketAssignmentService.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";
import { success, serverError, badRequest } from "../utils/responseMessages.js";

const router = express.Router();

// POST /api/assignment/process - Manually trigger assignment of unassigned tickets
router.post("/process", verifyToken, authorizeRoles("admin", "supervisor"), async (req, res) => {
    try {
        const result = await processUnassignedTickets();
        return success(res, result, "Unassigned tickets processed");
    } catch (error) {
        console.error("Error processing tickets:", error);
        return serverError(res);
    }
});

// POST /api/assignment/recalculate - Recalculate all agent stats
router.post("/recalculate", verifyToken, authorizeRoles("admin"), async (req, res) => {
    try {
        const result = await recalculateAllAgentStats();
        return success(res, result, "Agent stats recalculated");
    } catch (error) {
        console.error("Error recalculating stats:", error);
        return serverError(res);
    }
});

// POST /api/assignment/reassign/:agentId
router.post("/reassign/:agentId", verifyToken, authorizeRoles("admin", "supervisor"), async (req, res) => {
    try {
        const { agentId } = req.params;
        
        // FIX: Validate ObjectId format
        if (!agentId || !mongoose.Types.ObjectId.isValid(agentId)) {
            return badRequest(res, "Valid Agent ID is required");
        }
        
        const result = await reassignAgentTickets(agentId);
        return success(res, result, "Agent tickets reassigned");
    } catch (error) {
        console.error("Error reassigning tickets:", error);
        return serverError(res);
    }
});

export default router;