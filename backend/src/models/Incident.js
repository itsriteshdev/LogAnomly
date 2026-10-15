import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
  incidentId: { type: String, required: true, unique: true },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 2000 },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved', 'closed'],
    default: 'open',
    index: true,
  },
  anomalies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Anomaly' }],
  affectedSources: [String],
  affectedServices: [String],
  environment: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  summary: {
    text: String,
    isAIGenerated: { type: Boolean, default: false },
    generatedAt: Date,
  },
  notes: [{
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isAIGenerated: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }],
  timeline: [{
    event: String,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  }],
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

incidentSchema.index({ status: 1, createdAt: -1 });

export const Incident = mongoose.model('Incident', incidentSchema);
