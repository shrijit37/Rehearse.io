import bcrypt from "bcryptjs";
import type { ISignUpSchema, ILoginSchema } from "./auth.validation";
import { User } from "../user/user.model";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
// import {v4 as uuid} from "uuid";



let JWT_SECRET = env.JWT_SECRET;

/**
 * Sanitized public user payload that matches the frontend AuthUser shape:
 * { id, name, email, role, onboarded }.
 */
function toPublicUser(user: any): Record<string, unknown> {
    const obj = user?.toObject?.() ?? user;
    return {
        id: String(obj._id ?? obj.id ?? ""),
        _id: String(obj._id ?? obj.id ?? ""),
        name: obj.name,
        email: obj.email,
        role: obj.role,
        onboarded: obj.onboardingCompleted === true,
    };
}

const addUser = async (data: ISignUpSchema): Promise<{ status: number, data: { message: string, error?: string, token?: string, user?: Record<string, unknown> } }> => {
    try {
        const hashedPassword = await bcrypt.hash(data.password, 12);
        let user = await User.findOne({ email: data.email });
        if (user && !user.isDeleted && !user.isInvitedPlaceholder) {
            return { status: 400, data: { message: "User already exists" } }
        }

        if (user && user.isInvitedPlaceholder) {
            user.name = data.name;
            user.password = hashedPassword;
            user.role = data.role || "candidate";
            user.isInvitedPlaceholder = false;
            user.consentGiven = data.consentGiven === true;
            user.consentDate = data.consentGiven === true ? new Date() : undefined;
            user.consentVersion = data.consentGiven === true ? data.consentVersion || "1.0" : undefined;
            await user.save();
        } else {
            user = await User.create({
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: data.role || "candidate",
                consentGiven: data.consentGiven === true,
                consentDate: data.consentGiven === true ? new Date() : undefined,
                consentVersion: data.consentGiven === true ? data.consentVersion || "1.0" : undefined,
            });
            await user.save();
        }
        const token = jwt.sign({ _id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
        return { status: 201, data: { message: "User created successfully", token: token, user: toPublicUser(user) } }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "unknown error";
        return {
            status: 500, data: {
                message: "Internal server error",
                error: errorMessage
            }
        }
    }
}

const loginUser = async (data: ILoginSchema): Promise<{ status: number, data: { message: string, error?: string, token?: string, user?: Record<string, unknown> } }> => {
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
        const token = jwt.sign({ _id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
        return { status: 200, data: { message: "User logged in successfully", token: token, user: toPublicUser(user) } }
    } catch (error: unknown) {
        console.log(error);
        const errorMessage = error instanceof Error ? error.message : "unknown error";
        return {
            status: 500, data: {
                message: "Internal server error",
                error: errorMessage
            }
        }
    }
}

export { loginUser, addUser }

