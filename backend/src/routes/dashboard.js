import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { LogEvent } from '../models/LogEvent.js';
import { Anomaly } from '../models/Anomaly.js';
import { LogSource } from '../models/LogSource.js';
import { ServerMetric } from '../models/ServerMetric.js';
import { ModelRegistryEntry } from '../models/Model.js';

const router = Router();

router.use(authenticate);

// GET /api/v1/dashboard/summary
router.get('/summary', async (req, res) => {
  const { from, to } = req.query;
  const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const [
    totalSources,
    activeSources,
    totalLogs,
    totalAnomalies,
    criticalAnomalies,
    openAnomalies,
    latestModel,
    serverHealthCounts,
  ] = await Promise.all([
    LogSource.countDocuments(),
    LogSource.countDocuments({ status: 'active' }),
    LogEvent.countDocuments({ timestamp: { $gte: start, $lte: end } }),
    Anomaly.countDocuments({ firstSeenAt: { $gte: start, $lte: end } }),
    Anomaly.countDocuments({ firstSeenAt: { $gte: start, $lte: end }, severity: 'critical' }),
    Anomaly.countDocuments({ status: { $in: ['open', 'acknowledged', 'investigating'] } }),
    ModelRegistryEntry.findOne({ status: 'production' }).sort({ promotedAt: -1 }),
    ServerMetric.aggregate([
      { $sort: { sourceId: 1, timestamp: -1 } },
      { $group: { _id: '$sourceId', health: { $first: '$health' } } },
      { $group: { _id: '$health', count: { $sum: 1 } } },
    ]),
  ]);

  // Compute logs per second
  const durationSeconds = (end - start) / 1000;
  const logsPerSecond = durationSeconds > 0 ? (totalLogs / durationSeconds).toFixed(2) : 0;

  // Server health breakdown
  const healthMap = { healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
  serverHealthCounts.forEach(({ _id, count }) => {
    if (_id && healthMap[_id] !== undefined) healthMap[_id] = count;
  });

  const downServers = healthMap.unhealthy;

  res.json({
    success: true,
    data: {
      period: { from: start, to: end },
      sources: {
        total: totalSources,
        active: activeSources,
        down: downServers,
      },
      logs: {
        total: totalLogs,
        logsPerSecond: parseFloat(logsPerSecond),
      },
      anomalies: {
        total: totalAnomalies,
        critical: criticalAnomalies,
        open: openAnomalies,
      },
      serverHealth: healthMap,
      model: latestModel ? {
        version: latestModel.version,
        modelId: latestModel.modelId,
        architecture: latestModel.architecture,
        f1Score: latestModel.evaluationResult?.f1Score,
        isDemo: latestModel.evaluationResult?.isDemo,
      } : null,
      ingestionPipelineHealth: 'operational',
      avgDetectionLatencyMs: null, // computed from actual model evaluation
    },
  });
});

// GET /api/v1/dashboard/log-volume
router.get('/log-volume', async (req, res) => {
  const { from, to, interval = 'hour' } = req.query;
  const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const groupFormat = interval === 'day'
    ? { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
    : { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$timestamp' } };

  const data = await LogEvent.aggregate([
    { $match: { timestamp: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          time: groupFormat,
          isAnomaly: '$anomalyResult.isAnomaly',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.time': 1 } },
  ]);

  res.json({ success: true, data, period: { from: start, to: end } });
});

// GET /api/v1/dashboard/anomaly-distribution
router.get('/anomaly-distribution', async (req, res) => {
  const { from, to } = req.query;
  const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const data = await Anomaly.aggregate([
    { $match: { firstSeenAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 },
        avgScore: { $avg: '$score' },
      },
    },
    { $sort: { '_id': 1 } },
  ]);

  res.json({ success: true, data });
});

// GET /api/v1/dashboard/anomaly-types
router.get('/anomaly-types', async (req, res) => {
  const { from, to } = req.query;
  const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const data = await Anomaly.aggregate([
    { $match: { firstSeenAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json({ success: true, data });
});

// GET /api/v1/dashboard/latency
router.get('/latency', async (_req, res) => {
  // Returns model inference latency from the production model's recorded stats
  const model = await ModelRegistryEntry.findOne({ status: 'production' });
  res.json({
    success: true,
    data: {
      p50: model?.inferenceLatencyP50Ms ?? null,
      p95: model?.inferenceLatencyP95Ms ?? null,
      p99: model?.inferenceLatencyP99Ms ?? null,
      isDemo: model?.evaluationResult?.isDemo ?? false,
      note: model ? 'Recorded from last evaluation run.' : 'No production model deployed.',
    },
  });
});

// GET /api/v1/dashboard/server-health
router.get('/server-health', async (_req, res) => {
  const latest = await ServerMetric.aggregate([
    { $sort: { sourceId: 1, timestamp: -1 } },
    { $group: { _id: '$sourceId', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { 'cpu.utilization': -1 } },
    { $limit: 20 },
  ]);
  res.json({ success: true, data: latest });
});

export default router;
