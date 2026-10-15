import mongoose from 'mongoose';

const logSourceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  sourceId: { type: String, required: true, unique: true },
  sourceType: {
    type: String,
    enum: ['server', 'container', 'kubernetes', 'cloud-aws', 'cloud-azure', 'application', 'database', 'network', 'system', 'other'],
    required: true,
  },
  environment: {
    type: String,
    enum: ['production', 'staging', 'development', 'testing', 'demo'],
    default: 'production',
  },
  hostname: { type: String, trim: true },
  ipAddress: { type: String, trim: true },
  endpoint: { type: String, trim: true },
  serviceName: { type: String, trim: true },
  teamOwner: { type: String, trim: true },
  tags: [String],
  status: {
    type: String,
    enum: ['active', 'inactive', 'error', 'pending'],
    default: 'pending',
  },
  connectionStatus: {
    type: String,
    enum: ['connected', 'disconnected', 'unknown'],
    default: 'unknown',
  },
  lastSeenAt: { type: Date },
  totalEventsReceived: { type: Number, default: 0 },
  ingestionRatePerMinute: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  apiKey: { type: String, select: false },
  configuration: {
    batchSize: { type: Number, default: 100 },
    flushIntervalSeconds: { type: Number, default: 10 },
    enabled: { type: Boolean, default: true },
    logFormat: { type: String, enum: ['json', 'syslog', 'plaintext', 'csv'], default: 'json' },
    samplingRate: { type: Number, default: 1.0, min: 0, max: 1 },
  },
  isDemo: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

logSourceSchema.index({ sourceType: 1, environment: 1 });
logSourceSchema.index({ status: 1 });
logSourceSchema.index({ lastSeenAt: -1 });

export const LogSource = mongoose.model('LogSource', logSourceSchema);
