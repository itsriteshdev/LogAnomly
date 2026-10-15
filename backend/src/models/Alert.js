import mongoose from 'mongoose';

const alertRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  enabled: { type: Boolean, default: true },
  conditions: {
    anomalyScoreThreshold: { type: Number, min: 0, max: 1 },
    severityThreshold: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
    sourceFilter: [String],
    serviceFilter: [String],
    environmentFilter: [String],
    categoryFilter: [String],
    eventCountInWindow: { type: Number },
    windowMinutes: { type: Number },
  },
  cooldownMinutes: { type: Number, default: 30 },
  escalationPolicy: {
    enabled: { type: Boolean, default: false },
    escalateAfterMinutes: { type: Number, default: 60 },
    escalateTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  notifications: [{
    channel: { type: String, enum: ['in-app', 'email', 'slack', 'webhook', 'sms'] },
    destination: { type: String },
    enabled: { type: Boolean, default: true },
  }],
  lastTriggeredAt: { type: Date },
  triggerCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const AlertRule = mongoose.model('AlertRule', alertRuleSchema);

const alertEventSchema = new mongoose.Schema({
  rule: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertRule', required: true },
  anomaly: { type: mongoose.Schema.Types.ObjectId, ref: 'Anomaly' },
  triggeredAt: { type: Date, required: true, default: Date.now },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
  message: { type: String },
  deliveries: [{
    channel: String,
    destination: String,
    status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'] },
    sentAt: Date,
    error: String,
    retryCount: { type: Number, default: 0 },
  }],
}, { timestamps: true });

alertEventSchema.index({ triggeredAt: -1 });

export const AlertEvent = mongoose.model('AlertEvent', alertEventSchema);
