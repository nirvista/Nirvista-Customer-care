import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import { created, success, badRequest, notFound, serverError } from "../utils/responseMessages.js";

// Create a new supervisor
const createSupervisor = async (req, res) => {
    try {
        const { email, name, password, companyID } = req.body;
        
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return badRequest(res, `User with email ${email} already exists`);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newSupervisor = new User({
            email: email.toLowerCase(),
            name,
            password: hashedPassword,
            role: "supervisor",
            companyID
        });
        
        await newSupervisor.save();
        created(res, { id: newSupervisor._id, email: newSupervisor.email, name: newSupervisor.name }, "Supervisor created successfully");
    } catch (error) {
        serverError(res);
    }
};

// Get all supervisors
const getAllSupervisors = async (req, res) => {
    try {
        const supervisors = await User.find({ role: "supervisor" }).select("-password");
        success(res, supervisors, "Supervisors retrieved successfully");
    } catch (error) {
        serverError(res);
    }
};

// Get single supervisor by ID
const getSupervisorById = async (req, res) => {
    try {
        const supervisor = await User.findOne({ _id: req.params.id, role: "supervisor" }).select("-password");
        if (!supervisor) {
            return notFound(res, "Supervisor not found");
        }
        success(res, supervisor, "Supervisor retrieved successfully");
    } catch (error) {
        serverError(res);
    }
};

// Update supervisor
const updateSupervisor = async (req, res) => {
    try {
        const { email, name, password, companyID } = req.body;
        const updateData = {};

        if (email) updateData.email = email.toLowerCase();
        if (name) updateData.name = name;
        if (companyID) updateData.companyID = companyID;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        const supervisor = await User.findOneAndUpdate(
            { _id: req.params.id, role: "supervisor" },
            updateData,
            { new: true }
        ).select("-password");

        if (!supervisor) {
            return notFound(res, "Supervisor not found");
        }
        success(res, supervisor, "Supervisor updated successfully");
    } catch (error) {
        serverError(res);
    }
};

// Delete supervisor
const deleteSupervisor = async (req, res) => {
    try {
        const supervisor = await User.findOneAndDelete({ _id: req.params.id, role: "supervisor" });
        if (!supervisor) {
            return notFound(res, "Supervisor not found");
        }
        success(res, null, "Supervisor deleted successfully");
    } catch (error) {
        serverError(res);
    }
};

export { createSupervisor, getAllSupervisors, getSupervisorById, updateSupervisor, deleteSupervisor };