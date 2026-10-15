import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ModelRegistryEntry, TrainingJob, EvaluationRun } from '../models/Model.js';
import { createAuditLog } from '../models/AuditLog.js';
import { callAIService } from '../services/aiServiceClient.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// GET /api/v1/models
router.get('/', async (req, res) => {
  const models = await ModelRegistryEntry.find()
    .sort({ createdAt: -1 })
    .populate('createdBy', 'firstName lastName')
    .populate('promotedBy', 'firstName lastName')
    .lean();
  res.json({ success: true, data: models });
});

// GET /api/v1/models/active
router.get('/active', async (_req, res) => {
  const model = await ModelRegistryEntry.findOne({ status: 'production' })
    .sort({ promotedAt: -1 })
    .lean();
  res.json({ success: true, data: model || null });
});

// GET /api/v1/models/:id
router.get('/:id', async (req, res) => {
  const model = await ModelRegistryEntry.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email')
    .populate('promotedBy', 'firstName lastName email')
    .lean();
  if (!model) return res.status(404).json({ success: false, error: 'Model not found' });
  res.json({ success: true, data: model });
});

// GET /api/v1/models/:id/evaluations
router.get('/:id/evaluations', async (req, res) => {
  const runs = await EvaluationRun.find({ modelId: req.params.id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: runs });
});

// POST /api/v1/models/train
router.post('/train', authorize('admin', 'analyst'), async (req, res) => {
  const jobId = `job_${Date.now()}`;
  const job = await TrainingJob.create({
    jobId,
    status: 'queued',
    config: req.body.config || {},
    createdBy: req.user.id,
  });

  // Attempt to trigger AI service training
  const aiResult = await callAIService('/training/start', { jobId, config: req.body.config || {} });

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email,
    action: 'model.training.started', targetType: 'TrainingJob', targetId: job._id.toString(),
  });

  res.status(202).json({ success: true, data: { job, aiServiceResponse: aiResult } });
});

// POST /api/v1/models/evaluate
router.post('/evaluate', authorize('admin', 'analyst'), async (req, res) => {
  const { modelId } = req.body;
  const model = await ModelRegistryEntry.findById(modelId);
  if (!model) return res.status(404).json({ success: false, error: 'Model not found' });

  const runId = uuidv4();
  const run = await EvaluationRun.create({
    runId,
    modelId: model._id,
    status: 'pending',
    createdBy: req.user.id,
  });

  const aiResult = await callAIService('/evaluation/run', { runId, modelId: model.modelId });

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email,
    action: 'model.evaluation.started', targetType: 'EvaluationRun', targetId: run._id.toString(),
  });

  res.status(202).json({ success: true, data: { run, aiServiceResponse: aiResult } });
});

// POST /api/v1/models/:id/promote
router.post('/:id/promote', authorize('admin'), async (req, res) => {
  const model = await ModelRegistryEntry.findById(req.params.id);
  if (!model) return res.status(404).json({ success: false, error: 'Model not found' });
  if (model.status !== 'evaluated') {
    return res.status(400).json({ success: false, error: 'Only evaluated models can be promoted to production. Run evaluation first.' });
  }

  // Archive current production model
  await ModelRegistryEntry.updateMany({ status: 'production' }, {
    status: 'archived',
    archivedAt: new Date(),
    archivedBy: req.user.id,
  });

  model.status = 'production';
  model.promotedAt = new Date();
  model.promotedBy = req.user.id;
  model.approvedBy = req.user.id;
  model.deploymentHistory.push({ action: 'promoted', performedBy: req.user.id, at: new Date() });
  await model.save();

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email,
    action: 'model.promoted', targetType: 'ModelRegistryEntry', targetId: model._id.toString(),
    metadata: { version: model.version },
  });

  res.json({ success: true, data: model });
});

// POST /api/v1/models/:id/rollback
router.post('/:id/rollback', authorize('admin'), async (req, res) => {
  const model = await ModelRegistryEntry.findById(req.params.id);
  if (!model) return res.status(404).json({ success: false, error: 'Model not found' });
  if (!['evaluated', 'archived'].includes(model.status)) {
    return res.status(400).json({ success: false, error: 'Only evaluated or archived models can be activated' });
  }

  await ModelRegistryEntry.updateMany({ status: 'production' }, { status: 'archived', archivedAt: new Date() });
  model.status = 'production';
  model.promotedAt = new Date();
  model.deploymentHistory.push({ action: 'rolled-back', performedBy: req.user.id, at: new Date() });
  await model.save();

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email,
    action: 'model.rollback', targetType: 'ModelRegistryEntry', targetId: model._id.toString(),
  });

  res.json({ success: true, data: model });
});

export default router;
