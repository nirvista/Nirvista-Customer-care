import express from "express";
import { createWidget, getWidgets, getWidgetById, updateWidget } from "../controllers/widgetController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, authorizeRoles("admin"), createWidget);

router.get("/", verifyToken, authorizeRoles("admin", "supervisor"), getWidgets);

router.get("/:widgetId", verifyToken, authorizeRoles("admin", "supervisor"), getWidgetById);

router.put("/:widgetId", verifyToken, authorizeRoles("admin"), updateWidget);

export default router;