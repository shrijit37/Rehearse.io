import mongoose, { Schema, Document } from "mongoose";

export interface IResultItem {
    question: string;
    transcription: string;
    score: number;
    feedback: string;
}

export interface IDsaResultItem {
    problemTitle: string;
    problemIndex: number;
    language: string;
    code: string;
    score: number | null;
    correctness: number | null;
    codeQuality: number | null;
    timeComplexity: string;
    spaceComplexity: string;
    feedback: string;
    strengths: string[];
    improvements: string[];
    timeSpentSeconds: number;
}

export interface IRehearsalSession extends Document {
    user: mongoose.Types.ObjectId;
    targetRole: string;
    sessionType: "behavioral" | "dsa";
    results: IResultItem[];
    dsaResults: IDsaResultItem[];
    createdAt: Date;
    updatedAt: Date;
}

const ResultItemSchema = new Schema<IResultItem>({
    question: {
        type: String,
        required: true,
    },
    transcription: {
        type: String,
        required: true,
    },
    score: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
    },
    feedback: {
        type: String,
        required: true,
    }
}, { _id: false });

const DsaResultItemSchema = new Schema<IDsaResultItem>({
    problemTitle: { type: String, required: true },
    problemIndex: { type: Number, default: 0 },
    language: { type: String, default: "python" },
    code: { type: String, default: "" },
    score: { type: Number, min: 1, max: 10, default: null },
    correctness: { type: Number, min: 1, max: 10, default: null },
    codeQuality: { type: Number, min: 1, max: 10, default: null },
    timeComplexity: { type: String, default: "" },
    spaceComplexity: { type: String, default: "" },
    feedback: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    timeSpentSeconds: { type: Number, default: 0 },
}, { _id: false });

const RehearsalSessionSchema = new Schema<IRehearsalSession>({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    targetRole: {
        type: String,
        default: "Software Engineer",
    },
    sessionType: {
        type: String,
        enum: ["behavioral", "dsa"],
        default: "behavioral",
    },
    results: {
        type: [ResultItemSchema],
        default: [],
    },
    dsaResults: {
        type: [DsaResultItemSchema],
        default: [],
    },
}, { timestamps: true });

export const RehearsalSession = mongoose.model<IRehearsalSession>("RehearsalSession", RehearsalSessionSchema);
