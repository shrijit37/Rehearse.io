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
    score: { type: Number, min: 0, max: 10 },
    feedback: { type: String, default: '' },
  }],
}, { timestamps: true });

CandidateInviteSchema.index({ interview: 1, status: 1 });
CandidateInviteSchema.index({ candidate: 1 });

const CandidateInvite = mongoose.model('CandidateInvite', CandidateInviteSchema);
export default CandidateInvite;
