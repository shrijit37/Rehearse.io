import mongoose from 'mongoose';

const InterviewSessionSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    default: '',
    maxlength: 2000,
  },
  questions: [{
    type: String,
    required: true,
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'closed'],
    default: 'draft',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

InterviewSessionSchema.index({ organization: 1, status: 1 });
InterviewSessionSchema.index({ createdBy: 1 });

const InterviewSession = mongoose.model('InterviewSession', InterviewSessionSchema);
export default InterviewSession;
