import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Company code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    sla: {
      firstResponseMinutes: {
        type: Number,
        default: 120,
      },
      resolutionMinutes: {
        type: Number,
        default: 1440,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Company", companySchema);