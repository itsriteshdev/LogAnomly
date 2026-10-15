import mongoose from 'mongoose';

const serverMetricSchema = new mongoose.Schema({
  sourceId: { type: String, required: true, index: true },
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'LogSource' },
  hostname: { type: String },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  cpu: {
    utilization: { type: Number, min: 0, max: 100 },
    loadAvg1m: Number,
    loadAvg5m: Number,
    loadAvg15m: Number,
  },
  memory: {
    usedPercent: { type: Number, min: 0, max: 100 },
    usedBytes: Number,
    totalBytes: Number,
    available: Number,
  },
  disk: {
    usedPercent: { type: Number, min: 0, max: 100 },
    readBytesPerSec: Number,
    writeBytesPerSec: Number,
  },
  network: {
    rxBytesPerSec: Number,
    txBytesPerSec: Number,
    errors: Number,
  },
  logIngestionRate: { type: Number, default: 0 },
  errorRate: { type: Number, default: 0 },
  health: {
    type: String,
    enum: ['healthy', 'degraded', 'unhealthy', 'unknown'],
    default: 'unknown',
    index: true,
  },
  lastHeartbeat: { type: Date },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

serverMetricSchema.index({ sourceId: 1, timestamp: -1 });

export const ServerMetric = mongoose.model('ServerMetric', serverMetricSchema);
