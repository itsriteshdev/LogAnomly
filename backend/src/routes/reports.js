import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { Anomaly } from '../models/Anomaly.js';
import { LogEvent } from '../models/LogEvent.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// GET /api/v1/reports
router.get('/', async (_req, res) => {
  res.json({
    success: true,
    data: [],
    note: 'Report generation is available via POST /api/v1/reports/generate. Report history storage is planned.',
  });
});

// POST /api/v1/reports/generate
router.post('/generate', async (req, res) => {
  const { type, from, to } = req.body;
  const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const [anomalies, logs] = await Promise.all([
    Anomaly.find({ firstSeenAt: { $gte: start, $lte: end } }).lean(),
    LogEvent.countDocuments({ timestamp: { $gte: start, $lte: end } }),
  ]);

  const sevBreakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const statusBreakdown = {};
  anomalies.forEach(a => {
    sevBreakdown[a.severity] = (sevBreakdown[a.severity] || 0) + 1;
    statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1;
  });

  const report = {
    reportId: `RPT-${uuidv4().slice(0, 8)}`,
    type: type || 'anomaly-summary',
    period: { from: start, to: end },
    generatedAt: new Date(),
    summary: {
      totalLogs: logs,
      totalAnomalies: anomalies.length,
      severityBreakdown: sevBreakdown,
      statusBreakdown,
    },
    anomalies: anomalies.slice(0, 100),
    note: 'This report is computed from actual database data. [DEMO DATA] labels indicate simulated records.',
  };

  res.json({ success: true, data: report });
});

export default router;
