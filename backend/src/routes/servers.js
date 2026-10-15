import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { ServerMetric } from '../models/ServerMetric.js';
import { LogSource } from '../models/LogSource.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/servers
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, health, environment, search } = req.query;

  // Get latest metric per source
  const pipeline = [
    { $sort: { sourceId: 1, timestamp: -1 } },
    { $group: { _id: '$sourceId', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
  ];

  if (health) pipeline.push({ $match: { health } });

  const allMetrics = await ServerMetric.aggregate(pipeline);

  // Join with source info
  const sourceIds = allMetrics.map(m => m.sourceId);
  const sources = await LogSource.find({ sourceId: { $in: sourceIds } }).lean();
  const sourceMap = {};
  sources.forEach(s => { sourceMap[s.sourceId] = s; });

  let combined = allMetrics.map(m => ({
    ...m,
    source: sourceMap[m.sourceId] || null,
  }));

  if (search) {
    const re = new RegExp(search, 'i');
    combined = combined.filter(m => re.test(m.hostname) || re.test(m.sourceId) || re.test(m.source?.name));
  }

  if (environment) {
    combined = combined.filter(m => m.source?.environment === environment);
  }

  const total = combined.length;
  const page_int = parseInt(page);
  const limit_int = parseInt(limit);
  const paginated = combined.slice((page_int - 1) * limit_int, page_int * limit_int);

  res.json({
    success: true,
    data: paginated,
    pagination: { page: page_int, limit: limit_int, total },
    note: 'Metrics are SIMULATED DEMO DATA. Connect Prometheus or similar for real infrastructure metrics.',
  });
});

// GET /api/v1/servers/:id
router.get('/:id', async (req, res) => {
  const latest = await ServerMetric.findOne({ sourceId: req.params.id }).sort({ timestamp: -1 });
  if (!latest) return res.status(404).json({ success: false, error: 'Server not found' });
  const source = await LogSource.findOne({ sourceId: req.params.id }).lean();
  res.json({ success: true, data: { ...latest.toObject(), source } });
});

// GET /api/v1/servers/:id/metrics
router.get('/:id/metrics', async (req, res) => {
  const { from, to, limit = 60 } = req.query;
  const query = { sourceId: req.params.id };
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }

  const metrics = await ServerMetric.find(query)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .lean();

  res.json({ success: true, data: metrics.reverse() });
});

export default router;
