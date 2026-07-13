import bcrypt from "bcryptjs";
import type { ISignUpSchema, ILoginSchema } from "./auth.validation";
import { User } from "../user/user.model";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
// import {v4 as uuid} from "uuid";



let JWT_SECRET = env.JWT_SECRET;

const addUser = async (data: ISignUpSchema): Promise<{ status: number, data: { message: string, error?: string, token?: string } }> => {
    try {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        let user = await User.findOne({ email: data.email });
        if (user && !user.isDeleted) {
            return { status: 400, data: { message: "User already exists" } }
        } else {
            user = await User.create({ ...data, password: hashedPassword });
            await user.save();
            const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
            return { status: 201, data: { message: "User created successfully", token: token } }
        }
    } catch (error: any) {
        return {
            status: 500, data: {
                message: "Internal server error",
                error: error?.message
            }
        }
    }
}

const loginUser = async (data: ILoginSchema): Promise<{ status: number, data: { message: string, error?: string, token?: string, user?: any } }> => {
    try {
        const { email, password } = data;
        const user = await User.findOne({ email }).select("+password");
        if (!user || user.isDeleted) {
            return { status: 400, data: { message: "User not found" } }
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return { status: 400, data: { message: "Invalid credentials" } }
        }
        let userData = user.toObject();
        userData.password = "";
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
        return { status: 200, data: { message: "User logged in successfully", token: token, user: userData } }
    } catch (error: any) {
        console.log(error);
        return {
            status: 500, data: {
                message: "Internal server error",
                error: error?.message
            }
        }
    }
}

export { loginUser, addUser }

