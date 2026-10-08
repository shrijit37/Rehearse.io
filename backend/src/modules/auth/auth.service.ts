import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { ISignUpSchema, ILoginSchema } from "./auth.validation";
import { env } from "../../config/env";
import { createUser, findUserByEmail, findUserWithPasswordByEmail, updateUser } from "../../db/repositories/users";

const JWT_SECRET = env.JWT_SECRET;

type AuthPayload = {
    status: number;
    data: {
        message: string;
        error?: string;
        token?: string;
        user?: Record<string, unknown>;
    };
};

/**
 * Sanitized public user payload matching the frontend AuthUser shape:
 * { id, name, email, role, onboarded }.
 */
function toPublicUser(user: Record<string, unknown> | null | undefined): Record<string, unknown> {
    const id = String(user?.id ?? user?._id ?? "");
    return {
        id,
        _id: id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        onboarded: user?.onboardingCompleted === true,
    };
}

const addUser = async (data: ISignUpSchema): Promise<AuthPayload> => {
    try {
        const email = data.email.toLowerCase().trim();
        const hashedPassword = await bcrypt.hash(data.password, 12);
        const existing = await findUserByEmail(email);

        // A claimed account cannot be re-signed-up.
        if (existing && !existing.isDeleted && !existing.isInvitedPlaceholder) {
            return { status: 400, data: { message: "User already exists" } };
        }

        let user: Record<string, unknown> | null;
        if (existing && existing.isInvitedPlaceholder) {
            // Claim the placeholder created by an invite.
            user = await updateUser(existing.id, {
                name: data.name,
                password: hashedPassword,
                role: data.role || "candidate",
                isInvitedPlaceholder: false,
                consentGiven: data.consentGiven === true,
                consentDate: data.consentGiven === true ? new Date() : null,
                consentVersion: data.consentGiven === true ? data.consentVersion || "1.0" : null,
            });
        } else {
            user = await createUser({
                name: data.name,
                email,
                password: hashedPassword,
                role: data.role || "candidate",
                consentGiven: data.consentGiven === true,
                consentDate: data.consentGiven === true ? new Date() : null,
                consentVersion: data.consentGiven === true ? data.consentVersion || "1.0" : null,
            });
        }

        if (!user) {
            return { status: 500, data: { message: "Internal server error" } };
        }

        const token = jwt.sign({ _id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
        return {
            status: 201,
            data: { message: "User created successfully", token, user: toPublicUser(user) },
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "unknown error";
        return { status: 500, data: { message: "Internal server error", error: errorMessage } };
    }
};

const loginUser = async (data: ILoginSchema): Promise<AuthPayload> => {
    try {
        const { email, password } = data;
        const user = await findUserWithPasswordByEmail(email.toLowerCase().trim());
        if (!user || user.isDeleted) {
            return { status: 400, data: { message: "User not found" } };
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return { status: 400, data: { message: "Invalid credentials" } };
        }
        const token = jwt.sign({ _id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
        return {
            status: 200,
            data: { message: "User logged in successfully", token, user: toPublicUser(user) },
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "unknown error";
        return { status: 500, data: { message: "Internal server error", error: errorMessage } };
    }
};

export { loginUser, addUser };
