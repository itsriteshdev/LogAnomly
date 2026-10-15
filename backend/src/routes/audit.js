import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { AuditLog } from '../models/AuditLog.js';

const router = Router();
router.use(authenticate, authorize('admin', 'analyst'));

// GET /api/v1/audit-logs
router.get('/', async (req, res) => {
  const { page = 1, limit = 50, action, actor, from, to } = req.query;
  const query = {};
  if (action) query.action = new RegExp(action, 'i');
  if (actor) query.actor = actor;
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [docs, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit))
      .populate('actor', 'firstName lastName email')
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: docs,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
  });
});

export default router;
