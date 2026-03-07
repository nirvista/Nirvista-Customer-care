import express from "express";
import { 
    getTicketsPerDay, 
    getResponseTimeReport, 
    getResolutionTimeReport, 
    getSLABreachesReport, 
    getAgentPerformanceReport 
} from "../controllers/reportsController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

const router = express.Router();

// All routes require authentication and admin/supervisor role
router.use(verifyToken);
router.use(authorizeRoles("admin", "supervisor"));

// GET /api/reports/tickets-per-day
router.get("/tickets-per-day", getTicketsPerDay);

// GET /api/reports/response-time
router.get("/response-time", getResponseTimeReport);

// GET /api/reports/resolution-time
router.get("/resolution-time", getResolutionTimeReport);

// GET /api/reports/sla-breaches
router.get("/sla-breaches", getSLABreachesReport);

// GET /api/reports/agent-performance
router.get("/agent-performance", getAgentPerformanceReport);

export default router;