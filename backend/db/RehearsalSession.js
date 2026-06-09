import mongoose from 'mongoose';

const ResultItemSchema = new mongoose.Schema({
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
});

const RehearsalSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetRole: {
    type: String,
    default: 'Software Engineer',
  },
  results: [ResultItemSchema],
}, { timestamps: true });

const RehearsalSession = mongoose.model('RehearsalSession', RehearsalSessionSchema);
export default RehearsalSession;
