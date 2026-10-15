import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { LogEvent } from '../models/LogEvent.js';
import { LogSource } from '../models/LogSource.js';
import { Anomaly } from '../models/Anomaly.js';
import { createAuditLog } from '../models/AuditLog.js';
import { emitNewLog, emitNewAnomaly } from '../config/socket.js';
import { v4 as uuidv4 } from 'uuid';
import { scoreLogEvent } from '../services/anomalyScorer.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10')) * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['application/json', 'text/csv', 'text/plain'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.jsonl') || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON, JSONL, and CSV files are allowed'));
    }
  },
});

const ingestSchema = z.object({
  timestamp: z.string().optional(),
  sourceId: z.string(),
  hostname: z.string().optional(),
  serviceName: z.string().optional(),
  environment: z.enum(['production', 'staging', 'development', 'testing', 'demo']).optional(),
  severity: z.enum(['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'TRACE']).default('INFO'),
  message: z.string().min(1).max(10000),
  traceId: z.string().optional(),
  correlationId: z.string().optional(),
  structuredFields: z.record(z.unknown()).optional(),
});

// GET /api/v1/logs
router.get('/', async (req, res) => {
  const { page = 1, limit = 50, severity, sourceId, serviceName, from, to, search, isAnomaly } = req.query;
  const query = {};
  if (severity) query.severity = severity.toUpperCase();
  if (sourceId) query.sourceId = sourceId;
  if (serviceName) query.serviceName = new RegExp(serviceName, 'i');
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to) query.timestamp.$lte = new Date(to);
  }
  if (search) query.message = new RegExp(search.slice(0, 200), 'i');
  if (isAnomaly === 'true') query['anomalyResult.isAnomaly'] = true;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [docs, total] = await Promise.all([
    LogEvent.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    LogEvent.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: docs,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// GET /api/v1/logs/:id
router.get('/:id', async (req, res) => {
  const log = await LogEvent.findById(req.params.id).lean();
  if (!log) return res.status(404).json({ success: false, error: 'Log event not found' });
  res.json({ success: true, data: log });
});

// POST /api/v1/logs/ingest
router.post('/ingest', async (req, res) => {
  const body = Array.isArray(req.body) ? req.body : [req.body];
  const results = { accepted: 0, rejected: 0, errors: [] };

  for (const item of body.slice(0, 100)) {
    const parsed = ingestSchema.safeParse(item);
    if (!parsed.success) {
      results.rejected++;
      results.errors.push({ item, errors: parsed.error.errors });
      continue;
    }
    const data = parsed.data;

    // Verify source exists or auto-create for demo
    let source = await LogSource.findOne({ sourceId: data.sourceId });
    if (!source) {
      results.rejected++;
      results.errors.push({ item, error: `Unknown sourceId: ${data.sourceId}` });
      continue;
    }

    const eventId = uuidv4();
    const logEvent = new LogEvent({
      eventId,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      receivedAt: new Date(),
      sourceId: data.sourceId,
      source: source._id,
      hostname: data.hostname || source.hostname,
      serviceName: data.serviceName || source.serviceName,
      environment: data.environment || source.environment,
      severity: data.severity,
      message: data.message,
      rawMessage: data.message,
      structuredFields: data.structuredFields,
      traceId: data.traceId,
      correlationId: data.correlationId,
      processingStatus: 'processed',
    });

    await logEvent.save();

    // Update source stats
    await LogSource.findByIdAndUpdate(source._id, {
      $inc: { totalEventsReceived: 1 },
      lastSeenAt: new Date(),
      status: 'active',
      connectionStatus: 'connected',
    });

    // Async anomaly scoring
    scoreLogEvent(logEvent).then(async (scoreResult) => {
      if (scoreResult.isAnomaly) {
        const anomaly = new Anomaly({
          anomalyId: `ANO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          firstSeenAt: logEvent.timestamp,
          lastSeenAt: logEvent.timestamp,
          sourceId: data.sourceId,
          source: source._id,
          serviceName: logEvent.serviceName,
          environment: logEvent.environment,
          hostname: logEvent.hostname,
          category: scoreResult.category || 'unknown',
          score: scoreResult.score,
          threshold: scoreResult.threshold,
          severity: scoreResult.severity,
          detectionMethod: scoreResult.method,
          modelVersion: scoreResult.modelVersion,
          triggerEventId: eventId,
          triggerEvent: logEvent._id,
          relatedEventIds: [eventId],
          relatedEventCount: 1,
          status: 'open',
        });
        await anomaly.save();

        await LogEvent.findByIdAndUpdate(logEvent._id, {
          'anomalyResult.anomalyId': anomaly._id,
          'anomalyResult.score': scoreResult.score,
          'anomalyResult.isAnomaly': true,
          'anomalyResult.detectedAt': new Date(),
        });

        emitNewAnomaly(anomaly.toObject());
      }
      emitNewLog(logEvent.toObject());
    }).catch(err => logger.error('Anomaly scoring error:', err));

    results.accepted++;
  }

  res.status(results.accepted > 0 ? 201 : 400).json({
    success: results.accepted > 0,
    data: results,
  });
});

// POST /api/v1/logs/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file provided' });
  }

  const content = req.file.buffer.toString('utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const results = { total: lines.length, accepted: 0, rejected: 0, errors: [] };

  for (const line of lines.slice(0, 1000)) {
    try {
      const item = JSON.parse(line);
      const parsed = ingestSchema.safeParse(item);
      if (!parsed.success) {
        results.rejected++;
        continue;
      }
      const data = parsed.data;
      const source = await LogSource.findOne({ sourceId: data.sourceId });
      if (!source) { results.rejected++; continue; }

      await LogEvent.create({
        eventId: uuidv4(),
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        receivedAt: new Date(),
        sourceId: data.sourceId,
        source: source._id,
        hostname: data.hostname || source.hostname,
        serviceName: data.serviceName || source.serviceName,
        environment: data.environment || source.environment,
        severity: data.severity,
        message: data.message,
        rawMessage: data.message,
        structuredFields: data.structuredFields,
        traceId: data.traceId,
        correlationId: data.correlationId,
        processingStatus: 'processed',
      });
      results.accepted++;
    } catch {
      results.rejected++;
    }
  }

  res.json({ success: true, data: results });
});

// GET /api/v1/log-sources
router.get('/log-sources', async (req, res) => {
  const { page = 1, limit = 20, status, environment, type } = req.query;
  const query = {};
  if (status) query.status = status;
  if (environment) query.environment = environment;
  if (type) query.sourceType = type;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [docs, total] = await Promise.all([
    LogSource.find(query).sort({ lastSeenAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    LogSource.countDocuments(query),
  ]);
  res.json({ success: true, data: docs, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
});

export default router;
