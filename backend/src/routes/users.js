import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../models/AuditLog.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// GET /api/v1/users - Admin only
router.get('/', authorize('admin'), async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: users });
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and digit'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['admin', 'analyst', 'viewer']).default('viewer'),
});

// POST /api/v1/users - Admin only
router.post('/', authorize('admin'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.errors });

  const existing = await User.findOne({ email: parsed.data.email });
  if (existing) return res.status(409).json({ success: false, error: 'Email already registered' });

  const user = await User.create(parsed.data);

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
    action: 'user.created', targetType: 'User', targetId: user._id.toString(),
    metadata: { email: user.email, role: user.role },
  });

  res.status(201).json({ success: true, data: user.toSafeObject() });
});

// PATCH /api/v1/users/:id - Admin only
router.patch('/:id', authorize('admin'), async (req, res) => {
  const allowedUpdates = ['firstName', 'lastName', 'role', 'isActive'];
  const updates = {};
  allowedUpdates.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email,
    action: 'user.updated', targetType: 'User', targetId: user._id.toString(),
    metadata: updates,
  });

  res.json({ success: true, data: user.toSafeObject() });
});

export default router;
