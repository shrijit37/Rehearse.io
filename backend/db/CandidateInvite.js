import crypto from "crypto";
import mongoose from 'mongoose';

const CandidateInviteSchema = new mongoose.Schema({
  interview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewSession',
    required: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  inviteToken: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'started', 'completed'],
    default: 'pending',
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
  // Store results inline for each candidate
  results: [{
    question: { type: String, required: true },
    transcription: { type: String, default: '' },
    score: { type: Number, min: 1, max: 10, default: null },
    feedback: { type: String, default: '' },
  }],
}, { timestamps: true });

/**
 * Hash a token for storage/comparison.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Hash the raw inviteToken before saving so the raw value is never stored.
 */
CandidateInviteSchema.pre('save', function (next) {
  if (this.isModified('inviteToken')) {
    this.inviteToken = hashToken(this.inviteToken);
  }
  next();
});

/**
 * Query helper to find by raw token (hashes it automatically).
 */
CandidateInviteSchema.statics.findByRawToken = function (rawToken) {
  return this.findOne({ inviteToken: hashToken(rawToken) });
};

CandidateInviteSchema.index({ interview: 1, status: 1 });
CandidateInviteSchema.index({ candidate: 1 });

const CandidateInvite = mongoose.model('CandidateInvite', CandidateInviteSchema);
export default CandidateInvite;