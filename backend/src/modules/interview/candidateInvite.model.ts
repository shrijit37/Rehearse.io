import crypto from "crypto";
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IResult {
    question: string;
    transcription: string;
    score: number | null;
    feedback: string;
}

export interface IDsaResult {
    problemId: string;
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

export interface ICandidateInvite extends Document {
    interview: mongoose.Types.ObjectId;
    candidate: mongoose.Types.ObjectId;
    inviteToken: string;
    status: "pending" | "started" | "completed";
    currentRound: "behavioral" | "dsa" | "done";
    invitedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    results: IResult[];
    dsaResults: IDsaResult[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ICandidateInviteModel extends Model<ICandidateInvite> {
    findByRawToken(rawToken: string): Promise<ICandidateInvite | null>;
}

const ResultSchema = new Schema<IResult>({
    question: { type: String, required: true },
    transcription: { type: String, default: "" },
    score: { type: Number, min: 1, max: 10, default: null },
    feedback: { type: String, default: "" },
}, { _id: false });

const DsaResultSchema = new Schema<IDsaResult>({
    problemId: { type: String, default: "" },
    problemTitle: { type: String, required: true },
    problemIndex: { type: Number, required: true },
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

const CandidateInviteSchema = new Schema<ICandidateInvite, ICandidateInviteModel>({
    interview: {
        type: Schema.Types.ObjectId,
        ref: "InterviewSession",
        required: true,
    },
    candidate: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    inviteToken: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ["pending", "started", "completed"],
        default: "pending",
    },
    currentRound: {
        type: String,
        enum: ["behavioral", "dsa", "done"],
        default: "behavioral",
    },
    invitedAt: {
        type: Date,
        default: Date.now,
    },
    startedAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    },
    results: {
        type: [ResultSchema],
        default: [],
    },
    dsaResults: {
        type: [DsaResultSchema],
        default: [],
    },
}, { timestamps: true });

CandidateInviteSchema.pre("save", async function () {
    if (this.isModified("inviteToken")) {
        this.inviteToken = crypto.createHash("sha256").update(this.inviteToken).digest("hex");
    }
});

CandidateInviteSchema.statics.findByRawToken = function (rawToken: string) {
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    return this.findOne({ inviteToken: hashedToken });
};

CandidateInviteSchema.index({ interview: 1, status: 1 });
CandidateInviteSchema.index({ candidate: 1 });

export const CandidateInvite = mongoose.model<ICandidateInvite, ICandidateInviteModel>("CandidateInvite", CandidateInviteSchema);
