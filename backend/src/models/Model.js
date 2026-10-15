import mongoose from 'mongoose';

const modelRegistrySchema = new mongoose.Schema({
  modelId: { type: String, required: true, unique: true },
  version: { type: String, required: true },
  architecture: {
    type: String,
    enum: ['cnn-lstm-transformer', 'lstm-only', 'transformer-only', 'baseline-statistical', 'isolation-forest'],
    default: 'baseline-statistical',
  },
  description: { type: String },
  checkpointPath: { type: String },
  configHash: { type: String },
  config: {
    hiddenDim: Number,
    numLayers: Number,
    numHeads: Number,
    dropoutRate: Number,
    sequenceLength: Number,
    preprocessingMode: String,
    device: String,
  },
  status: {
    type: String,
    enum: ['draft', 'evaluated', 'production', 'archived', 'failed'],
    default: 'draft',
    index: true,
  },
  trainingDataset: { type: mongoose.Schema.Types.ObjectId, ref: 'DatasetReference' },
  trainingJob: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingJob' },
  evaluationResult: {
    runId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationRun' },
    precision: Number,
    recall: Number,
    f1Score: Number,
    rocAuc: Number,
    prAuc: Number,
    accuracy: Number,
    threshold: Number,
    evaluatedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  inferenceLatencyP50Ms: Number,
  inferenceLatencyP95Ms: Number,
  inferenceLatencyP99Ms: Number,
  promotedAt: Date,
  promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  archivedAt: Date,
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deploymentHistory: [{
    action: { type: String, enum: ['promoted', 'rolled-back', 'archived'] },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: String,
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const ModelRegistryEntry = mongoose.model('ModelRegistryEntry', modelRegistrySchema);

const trainingJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
    default: 'queued',
    index: true,
  },
  config: { type: Map, of: mongoose.Schema.Types.Mixed },
  startedAt: Date,
  completedAt: Date,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  currentEpoch: { type: Number, default: 0 },
  totalEpochs: { type: Number },
  trainLoss: [Number],
  valLoss: [Number],
  logs: [{ message: String, timestamp: Date }],
  errorMessage: String,
  resultModelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ModelRegistryEntry' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const TrainingJob = mongoose.model('TrainingJob', trainingJobSchema);

const evaluationRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  modelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ModelRegistryEntry' },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'DatasetReference' },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  results: {
    precision: Number,
    recall: Number,
    f1Score: Number,
    rocAuc: Number,
    prAuc: Number,
    accuracy: Number,
    confusionMatrix: { tp: Number, fp: Number, tn: Number, fn: Number },
    threshold: Number,
    sampleCount: Number,
    positiveCount: Number,
    negativeCount: Number,
    warnings: [String],
    isDemo: { type: Boolean, default: false },
  },
  startedAt: Date,
  completedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const EvaluationRun = mongoose.model('EvaluationRun', evaluationRunSchema);
