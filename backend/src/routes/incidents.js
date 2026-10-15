import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { Incident } from '../models/Incident.js';
import { createAuditLog } from '../models/AuditLog.js';
import { callAIService } from '../services/aiServiceClient.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const incidentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  anomalies: z.array(z.string()).optional(),
  affectedSources: z.array(z.string()).optional(),
  affectedServices: z.array(z.string()).optional(),
  environment: z.string().optional(),
});

// GET /api/v1/incidents
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, status, severity } = req.query;
  const query = {};
  if (status) query.status = status;
  if (severity) query.severity = severity;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [docs, total] = await Promise.all([
    Incident.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .lean(),
    Incident.countDocuments(query),
  ]);
  res.json({ success: true, data: docs, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
});

// POST /api/v1/incidents
router.post('/', authorize('admin', 'analyst'), async (req, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors });

  const incidentId = `INC-${Date.now()}`;
  const incident = await Incident.create({
    incidentId,
    ...parsed.data,
    createdBy: req.user.id,
    timeline: [{ event: 'Incident created', actor: req.user.id }],
  });

  await createAuditLog({ actor: req.user.id, actorEmail: req.user.email, action: 'incident.created', targetType: 'Incident', targetId: incident._id.toString() });
  res.status(201).json({ success: true, data: incident });
});

// GET /api/v1/incidents/:id
router.get('/:id', async (req, res) => {
  const incident = await Incident.findById(req.params.id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('resolvedBy', 'firstName lastName email')
    .populate('anomalies')
    .lean();
  if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });
  res.json({ success: true, data: incident });
});

// PATCH /api/v1/incidents/:id
router.patch('/:id', authorize('admin', 'analyst'), async (req, res) => {
  const allowed = ['title', 'description', 'severity', 'status', 'assignedTo', 'affectedSources', 'affectedServices'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  if (updates.status === 'resolved') {
    updates.resolvedAt = new Date();
    updates.resolvedBy = req.user.id;
  }

  const incident = await Incident.findByIdAndUpdate(req.params.id, {
    ...updates,
    $push: { timeline: { event: `Status changed to ${updates.status || 'updated'}`, actor: req.user.id } },
  }, { new: true });
  if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

  await createAuditLog({ actor: req.user.id, actorEmail: req.user.email, action: 'incident.updated', targetType: 'Incident', targetId: incident._id.toString() });
  res.json({ success: true, data: incident });
});

// POST /api/v1/incidents/:id/notes
router.post('/:id/notes', async (req, res) => {
  const { content, requestAISummary } = req.body;
  if (!content) return res.status(400).json({ success: false, error: 'Note content required' });

  const incident = await Incident.findById(req.params.id).lean();
  if (!incident) return res.status(404).json({ success: false, error: 'Incident not found' });

  let aiSummary = null;
  if (requestAISummary) {
    const result = await callAIService('/analyze/incident', { incident, context: content });
    if (result.success) aiSummary = result.data;
  }

  const updated = await Incident.findByIdAndUpdate(req.params.id, {
    $push: {
      notes: { content: content.trim(), author: req.user.id },
      timeline: { event: 'Note added', actor: req.user.id },
    },
    ...(aiSummary && { summary: { text: aiSummary.summary, isAIGenerated: true, generatedAt: new Date() } }),
  }, { new: true });

  res.json({ success: true, data: { notes: updated.notes, aiSummary } });
});

export default router;
