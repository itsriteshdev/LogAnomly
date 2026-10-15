import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { Anomaly } from '../models/Anomaly.js';
import { LogEvent } from '../models/LogEvent.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../models/AuditLog.js';
import { emitAnomalyUpdate } from '../config/socket.js';
import { callAIService } from '../services/aiServiceClient.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// GET /api/v1/anomalies
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, severity, status, category, sourceId, serviceName, from, to, search, sortBy = 'firstSeenAt', sortDir = 'desc' } = req.query;

  const query = {};
  if (severity) query.severity = severity;
  if (status) query.status = status;
  if (category) query.category = category;
  if (sourceId) query.sourceId = sourceId;
  if (serviceName) query.serviceName = new RegExp(serviceName, 'i');
  if (from || to) {
    query.firstSeenAt = {};
    if (from) query.firstSeenAt.$gte = new Date(from);
    if (to) query.firstSeenAt.$lte = new Date(to);
  }
  if (search) query.$or = [
    { serviceName: new RegExp(search, 'i') },
    { sourceId: new RegExp(search, 'i') },
    { anomalyId: new RegExp(search, 'i') },
  ];

  const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [docs, total] = await Promise.all([
    Anomaly.find(query).sort(sort).skip(skip).limit(parseInt(limit))
      .populate('assignedTo', 'firstName lastName email')
      .populate('acknowledgedBy', 'firstName lastName email')
      .lean(),
    Anomaly.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: docs,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// GET /api/v1/anomalies/:id
router.get('/:id', async (req, res) => {
  const anomaly = await Anomaly.findById(req.params.id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('acknowledgedBy', 'firstName lastName email')
    .populate('resolvedBy', 'firstName lastName email')
    .populate('source')
    .lean();
  if (!anomaly) return res.status(404).json({ success: false, error: 'Anomaly not found' });
  res.json({ success: true, data: anomaly });
});

// PATCH /api/v1/anomalies/:id/status
const statusSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'investigating', 'resolved', 'suppressed', 'false-positive']),
  note: z.string().max(1000).optional(),
});

router.patch('/:id/status', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid status', details: parsed.error.errors });

  const anomaly = await Anomaly.findById(req.params.id);
  if (!anomaly) return res.status(404).json({ success: false, error: 'Anomaly not found' });

  const oldStatus = anomaly.status;
  anomaly.statusHistory.push({ from: oldStatus, to: parsed.data.status, changedBy: req.user.id, note: parsed.data.note });
  anomaly.status = parsed.data.status;

  if (parsed.data.status === 'acknowledged' && !anomaly.acknowledgedAt) {
    anomaly.acknowledgedBy = req.user.id;
    anomaly.acknowledgedAt = new Date();
  }
  if (parsed.data.status === 'resolved' && !anomaly.resolvedAt) {
    anomaly.resolvedBy = req.user.id;
    anomaly.resolvedAt = new Date();
  }

  await anomaly.save();
  emitAnomalyUpdate(anomaly.toObject());

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
    action: 'anomaly.status.changed', targetType: 'Anomaly', targetId: anomaly._id.toString(),
    metadata: { from: oldStatus, to: parsed.data.status },
  });

  res.json({ success: true, data: anomaly });
});

// POST /api/v1/anomalies/:id/assign
router.post('/:id/assign', authorize('admin', 'analyst'), async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const anomaly = await Anomaly.findByIdAndUpdate(req.params.id, { assignedTo: userId }, { new: true }).populate('assignedTo', 'firstName lastName email');
  if (!anomaly) return res.status(404).json({ success: false, error: 'Anomaly not found' });

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email,
    action: 'anomaly.assigned', targetType: 'Anomaly', targetId: anomaly._id.toString(),
    metadata: { assignedTo: userId },
  });

  res.json({ success: true, data: anomaly });
});

// POST /api/v1/anomalies/:id/notes
router.post('/:id/notes', async (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Note content required' });
  }
  const anomaly = await Anomaly.findByIdAndUpdate(
    req.params.id,
    { $push: { notes: { content: content.trim().slice(0, 2000), author: req.user.id } } },
    { new: true },
  ).populate('notes.author', 'firstName lastName email');
  if (!anomaly) return res.status(404).json({ success: false, error: 'Anomaly not found' });
  res.json({ success: true, data: anomaly.notes });
});

// POST /api/v1/anomalies/:id/analyze
router.post('/:id/analyze', async (req, res) => {
  const anomaly = await Anomaly.findById(req.params.id).populate('source').lean();
  if (!anomaly) return res.status(404).json({ success: false, error: 'Anomaly not found' });

  // Fetch related events
  const relatedEvents = await LogEvent.find({ eventId: { $in: anomaly.relatedEventIds } })
    .limit(10)
    .lean();

  const result = await callAIService('/analyze/anomaly', {
    anomaly,
    relatedEvents,
  });

  // Persist explanation if successful
  if (result.success && result.data?.summary) {
    await Anomaly.findByIdAndUpdate(req.params.id, {
      explanation: {
        summary: result.data.summary,
        contributingFeatures: result.data.contributingFeatures || [],
        suggestedSteps: result.data.suggestedSteps || [],
        isAIGenerated: true,
        generatedAt: new Date(),
      },
    });
  }

  res.json({ success: true, data: result });
});

// GET /api/v1/anomalies/:id/related-logs
router.get('/:id/related-logs', async (req, res) => {
  const anomaly = await Anomaly.findById(req.params.id).lean();
  if (!anomaly) return res.status(404).json({ success: false, error: 'Anomaly not found' });

  const logs = await LogEvent.find({ eventId: { $in: anomaly.relatedEventIds.slice(0, 50) } })
    .sort({ timestamp: 1 })
    .lean();

  res.json({ success: true, data: logs });
});

export default router;
