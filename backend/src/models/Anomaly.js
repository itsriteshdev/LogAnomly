import mongoose from 'mongoose';

const anomalySchema = new mongoose.Schema({
  anomalyId: { type: String, required: true, unique: true },
  firstSeenAt: { type: Date, required: true, index: true },
  lastSeenAt: { type: Date, required: true },
  sourceId: { type: String, index: true },
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'LogSource' },
  serviceName: { type: String, index: true },
  environment: { type: String, index: true },
  hostname: { type: String },
  category: {
    type: String,
    enum: [
      'auth-failure', 'resource-spike', 'service-failure', 'database-anomaly',
      'network-anomaly', 'unexpected-access', 'error-burst', 'sequence-anomaly', 'unknown'
    ],
    default: 'unknown',
    index: true,
  },
  score: { type: Number, required: true, min: 0, max: 1, index: true },
  threshold: { type: Number, required: true },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'info'],
    required: true,
    index: true,
  },
  detectionMethod: {
    type: String,
    enum: ['reconstruction-error', 'classification', 'unsupervised-score', 'hybrid', 'rule-based', 'baseline'],
    default: 'baseline',
  },
  modelVersion: { type: String },
  relatedEventIds: [{ type: String }],
  relatedEventCount: { type: Number, default: 0 },
  triggerEventId: { type: String },
  triggerEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'LogEvent' },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' },
  correlationGroup: { type: String },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'investigating', 'resolved', 'suppressed', 'false-positive'],
    default: 'open',
    index: true,
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  explanation: {
    summary: String,
    contributingFeatures: [String],
    suggestedSteps: [String],
    isAIGenerated: { type: Boolean, default: false },
    generatedAt: Date,
  },
  notes: [{
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
  statusHistory: [{
    from: String,
    to: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: String,
  }],
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

anomalySchema.index({ score: -1, severity: 1 });
anomalySchema.index({ status: 1, firstSeenAt: -1 });
anomalySchema.index({ sourceId: 1, firstSeenAt: -1 });

export const Anomaly = mongoose.model('Anomaly', anomalySchema);
