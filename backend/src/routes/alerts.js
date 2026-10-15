import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { AlertRule, AlertEvent } from '../models/Alert.js';
import { createAuditLog } from '../models/AuditLog.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
  conditions: z.object({
    anomalyScoreThreshold: z.number().min(0).max(1).optional(),
    severityThreshold: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
    sourceFilter: z.array(z.string()).optional(),
    serviceFilter: z.array(z.string()).optional(),
    environmentFilter: z.array(z.string()).optional(),
    categoryFilter: z.array(z.string()).optional(),
    eventCountInWindow: z.number().optional(),
    windowMinutes: z.number().optional(),
  }).optional(),
  cooldownMinutes: z.number().min(0).max(1440).default(30),
  notifications: z.array(z.object({
    channel: z.enum(['in-app', 'email', 'slack', 'webhook', 'sms']),
    destination: z.string().optional(),
    enabled: z.boolean().default(true),
  })).optional(),
});

// GET /api/v1/alerts/rules
router.get('/rules', async (req, res) => {
  const rules = await AlertRule.find().sort({ createdAt: -1 }).populate('createdBy', 'firstName lastName').lean();
  res.json({ success: true, data: rules });
});

// POST /api/v1/alerts/rules
router.post('/rules', authorize('admin', 'analyst'), async (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors });

  const rule = await AlertRule.create({ ...parsed.data, createdBy: req.user.id });
  await createAuditLog({ actor: req.user.id, actorEmail: req.user.email, action: 'alert.rule.created', targetType: 'AlertRule', targetId: rule._id.toString() });
  res.status(201).json({ success: true, data: rule });
});

// PATCH /api/v1/alerts/rules/:id
router.patch('/rules/:id', authorize('admin', 'analyst'), async (req, res) => {
  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors });

  const rule = await AlertRule.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
  if (!rule) return res.status(404).json({ success: false, error: 'Alert rule not found' });
  await createAuditLog({ actor: req.user.id, actorEmail: req.user.email, action: 'alert.rule.updated', targetType: 'AlertRule', targetId: rule._id.toString() });
  res.json({ success: true, data: rule });
});

// DELETE /api/v1/alerts/rules/:id
router.delete('/rules/:id', authorize('admin'), async (req, res) => {
  const rule = await AlertRule.findByIdAndDelete(req.params.id);
  if (!rule) return res.status(404).json({ success: false, error: 'Alert rule not found' });
  await createAuditLog({ actor: req.user.id, actorEmail: req.user.email, action: 'alert.rule.deleted', targetType: 'AlertRule', targetId: req.params.id });
  res.json({ success: true, message: 'Rule deleted' });
});

// POST /api/v1/alerts/rules/:id/test
router.post('/rules/:id/test', authorize('admin', 'analyst'), async (req, res) => {
  const rule = await AlertRule.findById(req.params.id).lean();
  if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });

  // Check if notification channels are configured
  const unconfigured = rule.notifications?.filter(n => {
    if (n.channel === 'email' && !process.env.SMTP_HOST) return true;
    if (n.channel === 'slack' && !process.env.SLACK_WEBHOOK_URL) return true;
    return false;
  });

  res.json({
    success: true,
    data: {
      ruleId: rule._id,
      name: rule.name,
      enabled: rule.enabled,
      conditions: rule.conditions,
      notifications: rule.notifications,
      unconfiguredChannels: unconfigured,
      testNote: 'This is a configuration validation. Actual delivery requires configured notification providers.',
    },
  });
});

// GET /api/v1/alerts/events
router.get('/events', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [docs, total] = await Promise.all([
    AlertEvent.find().sort({ triggeredAt: -1 }).skip(skip).limit(parseInt(limit)).populate('rule', 'name').lean(),
    AlertEvent.countDocuments(),
  ]);
  res.json({ success: true, data: docs, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
});

export default router;
