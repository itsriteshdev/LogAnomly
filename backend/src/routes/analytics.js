import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { LogEvent } from '../models/LogEvent.js';
import { Anomaly } from '../models/Anomaly.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/analytics/overview
router.get('/overview', async (req, res) => {
  const { from, to } = req.query;
  const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const [logsBySeverity, anomalyTrend, anomalyByService, logsByService] = await Promise.all([
    LogEvent.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    Anomaly.aggregate([
      { $match: { firstSeenAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$firstSeenAt' } },
          total: { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Anomaly.aggregate([
      { $match: { firstSeenAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$serviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    LogEvent.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$serviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.json({
    success: true,
    data: { logsBySeverity, anomalyTrend, anomalyByService, logsByService },
    period: { from: start, to: end },
  });
});

// GET /api/v1/analytics/trends
router.get('/trends', async (req, res) => {
  const { from, to, interval = 'hour' } = req.query;
  const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const fmt = interval === 'day' ? '%Y-%m-%d' : '%Y-%m-%dT%H:00';

  const [logTrend, anomalyTrend] = await Promise.all([
    LogEvent.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: fmt, date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Anomaly.aggregate([
      { $match: { firstSeenAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: fmt, date: '$firstSeenAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({ success: true, data: { logTrend, anomalyTrend }, period: { from: start, to: end } });
});

export default router;
