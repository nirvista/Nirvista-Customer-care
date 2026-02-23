import express from "express";
import verifyToken from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/roleMiddleware.js";

const router = express.Router();

//Only admin can access this route
router.get("/admin", verifyToken, authorizeRoles("admin"), (req, res) => {
    res.json({message: "Welcome Admin!"});
});

//Both admin and supervisor can access this route
router.get("/supervisor", verifyToken, authorizeRoles("admin", "supervisor"), (req, res) => {
    res.json({message: "Welcome Supervisor!"});
});

//All three roles can access this route
router.get("/agent", verifyToken, authorizeRoles("admin", "supervisor", "agent"), (req, res) => {
    res.json({message: "Welcome Agent!"});
});

export default router;