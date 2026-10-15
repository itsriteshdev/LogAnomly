import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { createAuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateTokens(user) {
  const payload = { id: user._id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid credentials format', details: parsed.error.errors });
  }
  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    await createAuditLog({ action: 'auth.login.failed', actorEmail: email, result: 'failure', metadata: { reason: 'user not found' } });
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    await createAuditLog({ action: 'auth.login.failed', actor: user._id, actorEmail: email, result: 'failure', metadata: { reason: 'wrong password' } });
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  // Use updateOne to avoid triggering pre-save bcrypt hook (which would re-hash an already-hashed password)
  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

  const { accessToken, refreshToken } = generateTokens(user);

  await createAuditLog({ action: 'auth.login.success', actor: user._id, actorEmail: email, actorRole: user.role, result: 'success' });

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
    },
  });
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token required' });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }
    const tokens = generateTokens(user);
    res.json({ success: true, data: tokens });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, data: user.toSafeObject() });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await createAuditLog({ action: 'auth.logout', actor: req.user.id, actorEmail: req.user.email, result: 'success' });
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
