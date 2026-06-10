import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // exclude password from queries by default
  },
  role: {
    type: String,
    enum: ['recruiter', 'candidate'],
    default: 'candidate',
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
  },
  resumeName: {
    type: String,
  },
  resume: {
    type: String, // base64 string (encrypted in production)
  },
  photo: {
    type: String, // base64 string (encrypted in production)
  },
  audio: {
    type: String, // base64 string (encrypted in production)
  },
  // GDPR/CCPA consent fields
  consentGiven: {
    type: Boolean,
    default: false,
  },
  consentDate: {
    type: Date,
  },
  consentVersion: {
    type: String, // e.g. "1.0" — version of privacy policy accepted
  },
  // Account status
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
}, { timestamps: true });

// Defense-in-depth: strip HTML tags from name before saving
UserSchema.pre('save', function (next) {
  if (this.isModified('name') && typeof this.name === 'string') {
    this.name = this.name.replace(/<[^>]*>/g, '').trim();
  }
  next();
});

const User = mongoose.model('User', UserSchema);
export default User;
