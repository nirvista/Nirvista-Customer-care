import Company from "../models/companyModel.js";
import { created, success, badRequest, notFound, serverError } from "../utils/responseMessages.js";

//Create a company
const createCompany = async (req, res) => {
  try {
    const { name, code, sla } = req.body;

    const existingCompany = await Company.findOne({ code: code.toUpperCase() });
    if (existingCompany) {
      return badRequest(res, "Company with this code already exists");
    }

    const company = await Company.create({
      name,
      code: code.toUpperCase(),
      sla: sla || {},
    });

    return created(res, { id: company._id }, "Company created successfully");
  } catch (error) {
    return serverError(res, error.message);
  }
};

//List all companies
const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find().select("-__v");
    return success(res, companies, "Companies fetched successfully");
  } catch (error) {
    return serverError(res, error.message);
  }
};

//Update company details
const updateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, sla } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (sla) updateData.sla = sla;

    const company = await Company.findByIdAndUpdate(
      companyId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!company) {
      return notFound(res, "Company not found");
    }

    return success(res, company, "Company updated successfully");
  } catch (error) {
    return serverError(res, error.message);
  }
};

//Get SLA configuration
const getCompanySLA = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId).select("name code sla");

    if (!company) {
      return notFound(res, "Company not found");
    }

    return success(res, company, "SLA configuration fetched successfully");
  } catch (error) {
    return serverError(res, error.message);
  }
};

export { createCompany, getAllCompanies, updateCompany, getCompanySLA };