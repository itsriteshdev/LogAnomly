import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { UserNotification } from '../models/Notification.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/notifications
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const query = { userId: req.user.id };
  if (unreadOnly === 'true') query.isRead = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [docs, total, unreadCount] = await Promise.all([
    UserNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    UserNotification.countDocuments(query),
    UserNotification.countDocuments({ userId: req.user.id, isRead: false }),
  ]);

  res.json({ success: true, data: docs, unreadCount, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', async (req, res) => {
  await UserNotification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const notif = await UserNotification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { isRead: true },
    { new: true },
  );
  if (!notif) return res.status(404).json({ success: false, error: 'Notification not found' });
  res.json({ success: true, data: notif });
});

export default router;
