import express from "express";
const router = express.Router();

import {
  createCompany,
  getAllCompanies,
  updateCompany,
  getCompanySLA,
  deleteCompany
} from "../controllers/companyController.js";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

//Admin only
router.post("/", verifyToken, authorizeRoles("admin"), createCompany);

//Admin only
router.get("/", verifyToken, authorizeRoles("admin"), getAllCompanies);

//Admin only
router.put("/:companyId", verifyToken, authorizeRoles("admin"), updateCompany);

//Admin only
router.delete("/:companyId", verifyToken, authorizeRoles("admin"), deleteCompany);

//Admin and Supervisor
router.get("/:companyID/sla", verifyToken, authorizeRoles("admin", "supervisor"), getCompanySLA);

export default router;