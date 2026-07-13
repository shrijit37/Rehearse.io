import mongoose from 'mongoose';
import { v4 as uuidv4 } from "uuid";

const UserSchema = new mongoose.Schema({

    id: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        default: () => uuidv4()
    },
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
    // organization: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Organization',
    //     default: null,
    // },
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
    // Onboarding status
    onboardingCompleted: {
        type: Boolean,
        default: false,
    },
    // True when the account was auto-created from a candidate invite and has not
    // yet been claimed by a real signup. Such accounts have an unusable random
    // password and can be claimed (password set) via signup with the same email.
    isInvitedPlaceholder: {
        type: Boolean,
        default: false,
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

// // Defense-in-depth: strip HTML tags from name before saving
// UserSchema.pre('save', function (next: NextFunction) {
//     if (this.isModified('name') && typeof this.name === 'string') {
//         this.name = this.name.replace(/<[^>]*>/g, '').trim();
//     }
//     next();
// });

const User = mongoose.model('User', UserSchema);

export { User };

