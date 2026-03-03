import mongoose from "mongoose";
import Widget from "../models/widgetModel.js";
import Company from "../models/companyModel.js";
import { success, created, badRequest, notFound, serverError } from "../utils/responseMessages.js";


// POST /api/chat-widget
const createWidget = async (req, res) => {
    try {
        const { companyID, name, allowedDomains } = req.body;

        if (!companyID || !name || !allowedDomains) {
            return badRequest(res, "companyID, name, and allowedDomains are required");
        }

        if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) {
            return badRequest(res, "allowedDomains must be a non-empty array");
        }

        const company = await Company.findOne({ companyID });
        if (!company) {
            return notFound(res, "Company not found");
        }

        // Create widget
        const widget = new Widget({
            companyID: company.companyID,
            name,
            allowedDomains
        });

        await widget.save();

        return created(res, {
            widgetId: widget.widgetId,
        }, "Widget created successfully");

    } catch (error) {
        console.error("Error creating widget:", error);
        return serverError(res);
    }
};


// GET /api/chat-widgets
const getWidgets = async (req, res) => {
    try {
        const { role, companyID: userCompanyID } = req.user;
        const { companyID: queryCompanyID } = req.query;

        const filter = {};

        if (role === "admin") {
            // Admin can filter by companyID query param, or see all if not provided
            if (queryCompanyID) {
                filter.companyID = queryCompanyID;
            }
        } else if (role === "supervisor") {
            // Supervisor can only see their company's widgets
            filter.companyID = userCompanyID;
        }

        const widgets = await Widget.find(filter).lean();

        return success(res, widgets, "Widgets retrieved successfully");

    } catch (error) {
        console.error("Error fetching widgets:", error);
        return serverError(res);
    }
};

// GET /api/chat-widgets/:widgetId
const getWidgetById = async (req, res) => {
    try {
        const { widgetId } = req.params;
        const { role, companyID } = req.user;

        const widget = await Widget.findOne({ widgetId }).lean();

        if (!widget) {
            return notFound(res, "Widget not found");
        }

        // Role-based access check for non-admin
        if (role !== "admin") {
            if (widget.companyID !== companyID) {
                return notFound(res, "Widget not found");
            }
        }

        return success(res, widget, "Widget retrieved successfully");

    } catch (error) {
        console.error("Error fetching widget:", error);
        return serverError(res);
    }
};

// PUT /api/chat-widgets/:widgetId
const updateWidget = async (req, res) => {
    try {
        const { widgetId } = req.params;
        const { name, allowedDomains, isActive, settings } = req.body;

        const widget = await Widget.findOne({ widgetId });

        if (!widget) {
            return notFound(res, "Widget not found");
        }

        // Update fields
        if (name) widget.name = name;
        if (allowedDomains) widget.allowedDomains = allowedDomains;
        if (typeof isActive === "boolean") widget.isActive = isActive;
        if (settings) widget.settings = { ...widget.settings, ...settings };

        await widget.save();

        return success(res, {
            widgetId: widget.widgetId,
            name: widget.name,
            allowedDomains: widget.allowedDomains,
            isActive: widget.isActive,
            settings: widget.settings
        }, "Widget updated successfully");

    } catch (error) {
        console.error("Error updating widget:", error);
        return serverError(res);
    }
};

export { createWidget, getWidgets, getWidgetById, updateWidget };