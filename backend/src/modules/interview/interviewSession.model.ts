import mongoose, { Schema, Document } from "mongoose";

export interface IDsaExample {
    input: string;
    output: string;
    explanation: string;
}

export interface IDsaStarterCode {
    python: string;
    javascript: string;
    java: string;
    cpp: string;
}

export interface IDsaProblem {
    _id?: mongoose.Types.ObjectId;
    title: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    constraints: string;
    examples: IDsaExample[];
    topics: string[];
    expectedApproach: string;
    starterCode: IDsaStarterCode;
}

export interface IInterviewSession extends Document {
    organization: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    title: string;
    targetRole: string;
    description: string;
    interviewType: "behavioral" | "dsa" | "mixed";
    questions: string[];
    dsaProblems: IDsaProblem[];
    dsaDifficulty: "easy" | "medium" | "hard" | "mixed";
    status: "draft" | "active" | "closed";
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const DsaExampleSchema = new Schema<IDsaExample>({
    input: { type: String, default: "" },
    output: { type: String, default: "" },
    explanation: { type: String, default: "" },
}, { _id: false });

const DsaStarterCodeSchema = new Schema<IDsaStarterCode>({
    python: { type: String, default: "" },
    javascript: { type: String, default: "" },
    java: { type: String, default: "" },
    cpp: { type: String, default: "" },
}, { _id: false });

const DsaProblemSchema = new Schema<IDsaProblem>({
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, required: true, maxlength: 10000 },
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
    },
    constraints: { type: String, default: "", maxlength: 3000 },
    examples: { type: [DsaExampleSchema], default: [] },
    topics: { type: [String], default: [] },
    expectedApproach: { type: String, default: "", maxlength: 3000 },
    starterCode: { type: DsaStarterCodeSchema, default: () => ({}) },
}, { _id: true });

const InterviewSessionSchema = new Schema<IInterviewSession>({
    organization: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
    },
    targetRole: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: "",
        maxlength: 2000,
    },
    interviewType: {
        type: String,
        enum: ["behavioral", "dsa", "mixed"],
        default: "behavioral",
    },
    questions: [{
        type: String,
        required: true,
    }],
    dsaProblems: {
        type: [DsaProblemSchema],
        default: [],
    },
    dsaDifficulty: {
        type: String,
        enum: ["easy", "medium", "hard", "mixed"],
        default: "medium",
    },
    status: {
        type: String,
        enum: ["draft", "active", "closed"],
        default: "draft",
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, { timestamps: true });

InterviewSessionSchema.index({ organization: 1, status: 1 });
InterviewSessionSchema.index({ createdBy: 1 });

export const InterviewSession = mongoose.model<IInterviewSession>("InterviewSession", InterviewSessionSchema);
