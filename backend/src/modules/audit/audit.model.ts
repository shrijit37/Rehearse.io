import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
    user?: mongoose.Types.ObjectId | null;
    action: string;
    details: string;
    metadata?: Record<string, unknown>;
    ipHash?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false,
        default: null,
    },
    action: {
        type: String,
        required: true,
        enum: [
            "signup",
            "login",
            "onboard",
            "account_delete",
            "account_export",
            "consent_update",
            "interview_create",
            "interview_invite",
            "interview_start",
            "interview_submit",
            "org_create",
            "org_update",
            "org_member_invite",
            "profile_update",
        ],
    },
    details: {
        type: String,
        default: "",
    },
    metadata: {
        type: Schema.Types.Mixed,
    },
    ipHash: {
        type: String,
        select: false,
    },
}, { timestamps: true });

AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
