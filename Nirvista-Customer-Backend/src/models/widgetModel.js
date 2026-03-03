import mongoose from "mongoose";

const widgetSchema = new mongoose.Schema({
    widgetId: {
        type: String,
        unique: true,
    },
    companyID: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    allowedDomains: [{
        type: String,
        required: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    settings: {
        primaryColor: { type: String, default: "#007bff" },
        welcomeMessage: { type: String, default: "Hi! How can we help you?" },
        position: { type: String, enum: ["bottom-right", "bottom-left"], default: "bottom-right" }
    }
}, { timestamps: true });

widgetSchema.pre("save", async function(next) {
    if (this.isNew) {
        // Generate widgetId
        const count = await mongoose.model("Widget").countDocuments();
        this.widgetId = `w_${String(count + 100).padStart(3, "0")}`;
    }
});

const Widget = mongoose.model("Widget", widgetSchema);
export default Widget;