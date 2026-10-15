import mongoose from 'mongoose';

const logEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true, index: true },
  receivedAt: { type: Date, required: true, default: Date.now },
  sourceId: { type: String, required: true, index: true },
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'LogSource' },
  hostname: { type: String, trim: true },
  serviceName: { type: String, trim: true, index: true },
  environment: {
    type: String,
    enum: ['production', 'staging', 'development', 'testing', 'demo'],
    index: true,
  },
  severity: {
    type: String,
    enum: ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'TRACE'],
    required: true,
    index: true,
  },
  message: { type: String, required: true, maxlength: 10000 },
  rawMessage: { type: String, maxlength: 10000 },
  structuredFields: { type: Map, of: mongoose.Schema.Types.Mixed },
  traceId: { type: String, index: true },
  correlationId: { type: String, index: true },
  requestId: { type: String },
  processId: { type: String },
  threadId: { type: String },
  containerId: { type: String },
  kubernetesMetadata: {
    namespace: String,
    podName: String,
    containerName: String,
    nodeName: String,
    labels: Map,
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processed', 'failed', 'quarantined'],
    default: 'pending',
    index: true,
  },
  preprocessingMode: {
    type: String,
    enum: ['parser-free-semantic', 'structured', 'hybrid'],
    default: 'parser-free-semantic',
  },
  anomalyResult: {
    anomalyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Anomaly' },
    score: Number,
    isAnomaly: Boolean,
    detectedAt: Date,
  },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

logEventSchema.index({ timestamp: -1, sourceId: 1 });
logEventSchema.index({ severity: 1, timestamp: -1 });
logEventSchema.index({ serviceName: 1, timestamp: -1 });
logEventSchema.index({ 'anomalyResult.isAnomaly': 1 });

export const LogEvent = mongoose.model('LogEvent', logEventSchema);
