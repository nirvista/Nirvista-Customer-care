import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

const router = express.Router();

// GET /api/dashboard/summary - Dashboard tiles with metrics
router.get("/summary", verifyToken, authorizeRoles("admin", "supervisor"), getDashboardSummary);

export default router;