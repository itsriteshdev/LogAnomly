import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { SystemSetting } from '../models/Notification.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../models/AuditLog.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/settings
router.get('/', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const query = isAdmin ? {} : { isSecret: false };
  const settings = await SystemSetting.find(query).lean();
  const settingMap = {};
  settings.forEach(s => {
    settingMap[s.key] = { value: s.value, description: s.description, category: s.category };
  });
  res.json({ success: true, data: settingMap });
});

// PATCH /api/v1/settings
router.patch('/', authorize('admin'), async (req, res) => {
  const { updates } = req.body; // { key: value, ... }
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, error: 'updates object required' });
  }

  const results = {};
  for (const [key, value] of Object.entries(updates)) {
    await SystemSetting.findOneAndUpdate(
      { key },
      { value, updatedBy: req.user.id },
      { upsert: true, new: true },
    );
    results[key] = value;
  }

  await createAuditLog({
    actor: req.user.id, actorEmail: req.user.email,
    action: 'settings.updated', targetType: 'SystemSetting',
    metadata: { keys: Object.keys(results) },
  });

  res.json({ success: true, data: results });
});

// PATCH /api/v1/settings/profile (any authenticated user)
router.patch('/profile', async (req, res) => {
  const { firstName, lastName, preferences } = req.body;
  const updates = {};
  if (firstName) updates.firstName = firstName;
  if (lastName) updates.lastName = lastName;
  if (preferences) updates.preferences = preferences;

  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, data: user.toSafeObject() });
});

export default router;
