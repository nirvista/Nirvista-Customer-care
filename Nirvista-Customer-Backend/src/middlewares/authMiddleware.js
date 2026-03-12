import jwt from "jsonwebtoken";
import { unauthorized } from "../utils/responseMessages.js";

const verifyToken = (req, res, next) => {
    let token;
    let authHeader = req.headers.Authorization || req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
        if (!token) {
            return unauthorized(res, "Unauthorized, no token provided");
        }
        try {
            const decode = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decode;
            console.log("Decoded user:", req.user);
            next();
        } catch (error) {
            unauthorized(res, "Token is invalid");
        }
    }else{
        return unauthorized(res, "Unauthorized, no token provided");
    }
    
};

export default verifyToken;