import express from "express";
const router = express.Router();

import {
  createCompany,
  getAllCompanies,
  updateCompany,
  getCompanySLA,
} from "../controllers/companyController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

//Admin only
router.post("/", verifyToken, authorizeRoles("admin"), createCompany);

//Admin only
router.get("/", verifyToken, authorizeRoles("admin"), getAllCompanies);

//Admin only
router.put("/:companyId", verifyToken, authorizeRoles("admin"), updateCompany);

//Admin and Supervisor
router.get("/:companyId/sla", verifyToken, authorizeRoles("admin", "supervisor"), getCompanySLA);

export default router;