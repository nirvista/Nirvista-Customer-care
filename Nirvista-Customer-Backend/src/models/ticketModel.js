import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        enum: ["customer", "agent", "system"],
        required: true
    },
    senderEmail: String,
    senderName: String,
    content: {
        type: String,
        required: true
    },
    attachments: [{
        filename: String,
        url: String,
        size: Number,
        mimeType: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const noteSchema = new mongoose.Schema({
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    authorName: String,
    content: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        unique: true
    },
    companyID: {
        type: String,
        required: true
    },
    widgetId: {
        type: String,
        default: null
    },
    subject: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["new", "open", "pending", "resolved", "closed"],
        default: "new"
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high", "urgent"],
        default: "medium"
    },
    channel: {
        type: String,
        enum: ["chat", "email"],
        required: true
    },
    customer: {
        name: String,
        email: {
            type: String,
            required: true,
            lowercase: true
        },
        phone: String
    },
    assignedAgentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    tags: [String],
    conversation: [messageSchema],
    notes: [noteSchema],
    sla: {
        firstResponseDue: Date,
        resolutionDue: Date,
        firstResponseAt: Date,
        resolvedAt: Date,
        breached: {
            type: Boolean,
            default: false
        }
    }
}, { timestamps: true });

// Generate unique ticket ID before saving
ticketSchema.pre("save", async function(next) {
    if (this.isNew && !this.ticketId) {
        const count = await mongoose.model("Ticket").countDocuments();
        this.ticketId = `TKT-${String(count + 1).padStart(6, "0")}`;
    }
});

// Index for search and filtering
ticketSchema.index({ companyID: 1, status: 1 });
ticketSchema.index({ "customer.email": 1 });
ticketSchema.index({ assignedAgentId: 1 });
ticketSchema.index({ widgetId: 1 });

const Ticket = mongoose.model("Ticket", ticketSchema);
export default Ticket;