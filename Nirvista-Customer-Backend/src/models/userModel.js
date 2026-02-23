import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email : {
        type: String,
        required: true,
        unique: true,
    },
    name : {
        type: String,
        required: true,
    },
    password : {
        type: String,
        required: true,
    },
    role : {
        type: String,
        required: true,
        enum: ["admin", "supervisor", "agent"],
    },
    companyID : {
        type: String,
        default: "",
    },
},{
    timestamps: true,
});

export default mongoose.model("User", userSchema);