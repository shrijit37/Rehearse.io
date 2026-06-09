import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // null for unauthenticated actions
  },
  action: {
    type: String,
    required: true,
    enum: [
      'signup', 'login', 'logout', 'onboard',
      'account_delete', 'account_export', 'consent_update',
      'interview_create', 'interview_invite', 'interview_start', 'interview_submit',
      'org_create', 'org_update', 'org_member_invite',
      'data_access', 'data_modify',
    ],
  },
  details: {
    type: String, // human-readable description
    default: '',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // arbitrary structured data
  },
  ipHash: {
    type: String, // SHA-256 hash of IP (never store raw IP)
    select: false, // not returned by default
  },
}, { timestamps: true });

AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;
