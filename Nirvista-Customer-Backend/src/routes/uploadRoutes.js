import express from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Invalid file type"));
    }
});

// POST /api/upload - Upload file(s)
router.post("/", upload.array("files", 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded" });
        }

        const uploadedFiles = req.files.map(file => ({
            filename: file.originalname,
            url: `${process.env.SERVER_URL || 'http://localhost:7001'}/uploads/${file.filename}`,
            size: file.size,
            mimeType: file.mimetype
        }));

        res.json({ success: true, files: uploadedFiles });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ success: false, message: "Upload failed" });
    }
});

export default router;