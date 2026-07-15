import mongoose, { Schema, Document } from "mongoose";

export interface IOrganizationMember {
    user: mongoose.Types.ObjectId;
    role: "admin" | "recruiter";
    joinedAt: Date;
}

export interface IOrganization extends Document {
    name: string;
    slug: string;
    members: IOrganizationMember[];
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    members: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        role: {
            type: String,
            enum: ["admin", "recruiter"],
            default: "recruiter",
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, { timestamps: true });

export const Organization = mongoose.model<IOrganization>("Organization", OrganizationSchema);
