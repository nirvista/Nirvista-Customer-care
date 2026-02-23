import express from "express";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";
import { createSupervisor, getAllSupervisors, getSupervisorById, updateSupervisor, deleteSupervisor } from "../controllers/supervisorController.js";

const router = express.Router();

//Admin only
router.post("/", verifyToken, authorizeRoles("admin"), createSupervisor);
router.put("/:id", verifyToken, authorizeRoles("admin"), updateSupervisor);
router.delete("/:id", verifyToken, authorizeRoles("admin"), deleteSupervisor);
router.get("/", verifyToken, authorizeRoles("admin"), getAllSupervisors);
router.get("/:id", verifyToken, authorizeRoles("admin"), getSupervisorById);
export default router;