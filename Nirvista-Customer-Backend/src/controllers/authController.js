import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { created, badRequest, notFound, serverError } from "../utils/responseMessages.js";

const register = async (req, res) => {
    try{
        const {email, name, password, role, companyID} = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({email: email.toLowerCase(), name, password: hashedPassword, role, companyID});
        await newUser.save();
        created(res, null, `User registered successfully with email ${email}`);
    }catch(error){
        serverError(res);
    }
};
const login = async (req, res) => {
    try {
        const {email, password} = req.body;
    const user = await User.findOne({email});

    if(!user){
        return notFound(res, `User with email ${email} not found`);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
        return badRequest(res, `Invalid password credentials`);
    }

    const token = jwt.sign(
        {id:user._id, role: user.role}, 
        process.env.JWT_SECRET,
        {expiresIn: "1h"},

    );
    res.status(200).json({success: true, data: {token, user:{
        id: user._id, 
        email: user.email,
        name: user.name, 
        role: user.role, 
        companyID: user.companyID
    }}, message: `Login successful`});

    } catch (error) {
        serverError(res);
    }
};

export {register, login};