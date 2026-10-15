import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  requestId: { type: String, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorEmail: { type: String },
  actorRole: { type: String },
  action: { type: String, required: true, index: true },
  targetType: { type: String },
  targetId: { type: String },
  targetDescription: { type: String },
  result: { type: String, enum: ['success', 'failure', 'error'], default: 'success' },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export async function createAuditLog(data) {
  try {
    await AuditLog.create(data);
  } catch (err) {
    // Audit log creation should never crash the main request
    console.error('Failed to create audit log:', err.message);
  }
}
