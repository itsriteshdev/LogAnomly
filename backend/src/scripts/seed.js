/**
 * Demo Data Seed Script
 * 
 * Creates a representative but clearly labeled DEMO dataset.
 * All seeded records are marked isDemo: true.
 * Run: node src/scripts/seed.js
 * Reset: node src/scripts/seed.js --reset
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { LogSource } from '../models/LogSource.js';
import { LogEvent } from '../models/LogEvent.js';
import { Anomaly } from '../models/Anomaly.js';
import { ServerMetric } from '../models/ServerMetric.js';
import { ModelRegistryEntry } from '../models/Model.js';
import { AlertRule } from '../models/Alert.js';
import { Incident } from '../models/Incident.js';
import { SystemSetting } from '../models/Notification.js';
import { logger } from '../utils/logger.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/log_anomaly_platform';

// Deterministic seed: all timestamps relative to NOW
const NOW = new Date();
const H = (hours) => new Date(NOW - hours * 60 * 60 * 1000);

const SERVICES = [
  'auth-service', 'api-gateway', 'payment-service', 'user-service',
  'notification-service', 'database-service', 'cache-service', 'ml-pipeline',
  'web-frontend', 'admin-service',
];

const ENVIRONMENTS = ['production', 'staging', 'development'];

const SEVERITIES = ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'];

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// Normal log messages
const normalMessages = [
  'Request processed successfully in 45ms',
  'Cache hit for key: user_session_data',
  'Database query completed: SELECT * FROM users WHERE id=$1',
  'Health check passed',
  'Configuration loaded from environment',
  'WebSocket connection established from 192.168.1.100',
  'Token validated for user_id: 12345',
  'Batch job completed: 250 records processed',
  'Metrics pushed to Prometheus endpoint',
  'Service initialized with 4 worker threads',
];

// Anomalous log messages (each represents an anomaly category)
const anomalousMessages = [
  { msg: 'CRITICAL: Authentication failed 50 times in 2 minutes from IP 10.0.0.5', category: 'auth-failure', severity: 'CRITICAL' },
  { msg: 'ERROR: CPU utilization reached 98% - system may be overloaded', category: 'resource-spike', severity: 'ERROR' },
  { msg: 'CRITICAL: Service payment-service is unreachable after 5 retries', category: 'service-failure', severity: 'CRITICAL' },
  { msg: 'ERROR: Database connection pool exhausted - max 100 connections reached', category: 'database-anomaly', severity: 'ERROR' },
  { msg: 'WARNING: Memory usage at 92% - approaching limit of 8GB', category: 'resource-spike', severity: 'WARNING' },
  { msg: 'ERROR: Unexpected 403 Forbidden from internal API /admin/settings', category: 'unexpected-access', severity: 'ERROR' },
  { msg: 'CRITICAL: 500 errors per second detected - error burst in progress', category: 'error-burst', severity: 'CRITICAL' },
  { msg: 'ERROR: Network timeout on downstream service after 30000ms', category: 'network-anomaly', severity: 'ERROR' },
  { msg: 'ERROR: Disk usage at 95% on /var/log partition', category: 'resource-spike', severity: 'ERROR' },
  { msg: 'CRITICAL: Database deadlock detected - rolling back transaction', category: 'database-anomaly', severity: 'CRITICAL' },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  logger.info('Connected to MongoDB');

  if (process.argv.includes('--reset')) {
    logger.info('Resetting demo data...');
    await Promise.all([
      User.deleteMany({ email: { $in: ['admin@demo.local', 'analyst@demo.local', 'viewer@demo.local'] } }),
      LogSource.deleteMany({ isDemo: true }),
      LogEvent.deleteMany({ isDemo: true }),
      Anomaly.deleteMany({ isDemo: true }),
      ServerMetric.deleteMany({ isDemo: true }),
      ModelRegistryEntry.deleteMany({ modelId: { $regex: /^demo-/ } }),
      AlertRule.deleteMany({ name: { $regex: /\[DEMO\]/ } }),
      Incident.deleteMany({ isDemo: true }),
    ]);
    logger.info('Demo data reset complete.');
  }

  // ─── 1. USERS ─────────────────────────────────────────────────
  // IMPORTANT: We must use .save() so the pre-save bcrypt hook fires.
  // findOneAndUpdate bypasses Mongoose hooks and stores passwords in plaintext.
  logger.info('Seeding users...');

  async function upsertUser({ email, password, firstName, lastName, role }) {
    await User.deleteOne({ email });
    const u = new User({ email, password, firstName, lastName, role, isActive: true });
    await u.save(); // triggers pre('save') → bcrypt hash
    return User.findOne({ email });
  }

  const adminUser = await upsertUser({
    email: 'admin@demo.local',
    password: 'Admin1234!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  });

  const analystUser = await upsertUser({
    email: 'analyst@demo.local',
    password: 'Analyst1234!',
    firstName: 'Jane',
    lastName: 'Analyst',
    role: 'analyst',
  });

  await upsertUser({
    email: 'viewer@demo.local',
    password: 'Viewer1234!',
    firstName: 'Bob',
    lastName: 'Viewer',
    role: 'viewer',
  });

  logger.info('Users seeded: admin@demo.local (Admin1234!), analyst@demo.local (Analyst1234!), viewer@demo.local (Viewer1234!)');

  // ─── 2. LOG SOURCES ───────────────────────────────────────────
  logger.info('Seeding 20 demo log sources...');
  const sources = [];
  const sourceTypes = ['server', 'container', 'kubernetes', 'application', 'database', 'network'];
  const healthStates = ['active', 'active', 'active', 'active', 'inactive', 'error'];

  for (let i = 0; i < 20; i++) {
    const sourceId = `src-demo-${String(i + 1).padStart(3, '0')}`;
    const sourceType = randomPick(sourceTypes);
    const env = randomPick(ENVIRONMENTS);
    const status = healthStates[i % healthStates.length];

    const source = await LogSource.findOneAndUpdate(
      { sourceId },
      {
        sourceId,
        name: `${randomPick(SERVICES)}-${i + 1} [DEMO]`,
        sourceType,
        environment: env,
        hostname: `host-${i + 1}.${env}.local`,
        ipAddress: `10.${Math.floor(i / 8)}.${i % 8}.${100 + i}`,
        serviceName: randomPick(SERVICES),
        teamOwner: randomPick(['Platform', 'Backend', 'Frontend', 'Data']),
        status,
        connectionStatus: status === 'active' ? 'connected' : 'disconnected',
        lastSeenAt: H(Math.random() * 2),
        totalEventsReceived: Math.floor(Math.random() * 50000) + 100,
        ingestionRatePerMinute: Math.floor(Math.random() * 500),
        errorCount: Math.floor(Math.random() * 20),
        isDemo: true,
        createdBy: adminUser._id,
      },
      { upsert: true, new: true },
    );
    sources.push(source);
  }
  logger.info(`${sources.length} log sources seeded.`);

  // ─── 3. LOG EVENTS ────────────────────────────────────────────
  logger.info('Seeding 500 demo log events...');
  const logEvents = [];

  for (let i = 0; i < 500; i++) {
    const isAnomalous = i % 10 === 0; // 10% anomalous
    const source = randomPick(sources);
    const hoursAgo = (i / 500) * 24; // spread over last 24 hours
    const ts = H(hoursAgo);
    const severity = isAnomalous ? randomPick(['CRITICAL', 'ERROR', 'WARNING']) : randomPick(['INFO', 'INFO', 'INFO', 'DEBUG', 'WARNING']);
    const msg = isAnomalous ? randomPick(anomalousMessages).msg : randomPick(normalMessages);
    const eventId = `evt-demo-${String(i).padStart(5, '0')}`;

    const existingEvent = await LogEvent.findOne({ eventId });
    if (!existingEvent) {
      const ev = await LogEvent.create({
        eventId,
        timestamp: ts,
        receivedAt: ts,
        sourceId: source.sourceId,
        source: source._id,
        hostname: source.hostname,
        serviceName: source.serviceName,
        environment: source.environment,
        severity,
        message: msg,
        rawMessage: msg,
        traceId: `trace-${uuidv4().slice(0, 8)}`,
        correlationId: `corr-${Math.floor(i / 5)}`,
        processingStatus: 'processed',
        isDemo: true,
      });
      logEvents.push(ev);
    }
  }
  logger.info(`${logEvents.length} log events seeded.`);

  // ─── 4. ANOMALIES ─────────────────────────────────────────────
  logger.info('Seeding demo anomalies...');
  const anomalySeverities = ['critical', 'high', 'medium', 'low'];
  const anomalyStatuses = ['open', 'acknowledged', 'investigating', 'resolved'];
  const anomalyCategories = ['auth-failure', 'resource-spike', 'service-failure', 'database-anomaly', 'error-burst', 'unknown'];

  for (let i = 0; i < 50; i++) {
    const source = randomPick(sources);
    const hoursAgo = (i / 50) * 48;
    const firstSeen = H(hoursAgo + 0.5);
    const lastSeen = H(hoursAgo);
    const score = randomBetween(0.35, 0.99);
    const severity = anomalySeverities[i % anomalySeverities.length];
    const status = anomalyStatuses[i % anomalyStatuses.length];
    const category = anomalyCategories[i % anomalyCategories.length];
    const anomalyId = `ANO-DEMO-${String(i).padStart(4, '0')}`;

    const existingAnomaly = await Anomaly.findOne({ anomalyId });
    if (!existingAnomaly) {
      await Anomaly.create({
        anomalyId,
        firstSeenAt: firstSeen,
        lastSeenAt: lastSeen,
        sourceId: source.sourceId,
        source: source._id,
        serviceName: source.serviceName,
        environment: source.environment,
        hostname: source.hostname,
        category,
        score: parseFloat(score.toFixed(4)),
        threshold: 0.35,
        severity,
        detectionMethod: 'baseline',
        modelVersion: 'baseline-v1',
        relatedEventCount: Math.floor(Math.random() * 20) + 1,
        status,
        assignedTo: i % 5 === 0 ? analystUser._id : null,
        explanation: {
          summary: `[SIMULATED] ${category} anomaly detected. Score ${score.toFixed(3)} exceeds threshold 0.35. This is demo data generated for development purposes.`,
          contributingFeatures: ['severity_level', 'message_keywords', 'frequency'],
          suggestedSteps: ['Review related log events', 'Check service health dashboard', 'Contact service owner if persists'],
          isAIGenerated: false,
          generatedAt: new Date(),
        },
        isDemo: true,
      });
    }
  }
  logger.info('50 anomalies seeded.');

  // ─── 5. SERVER METRICS ────────────────────────────────────────
  logger.info('Seeding server metrics...');
  for (const source of sources.slice(0, 10)) {
    for (let t = 0; t < 24; t++) {
      const ts = H(t);
      const cpuUtil = randomBetween(5, 95);
      const health = cpuUtil > 90 ? 'unhealthy' : cpuUtil > 75 ? 'degraded' : 'healthy';

      await ServerMetric.findOneAndUpdate(
        { sourceId: source.sourceId, timestamp: ts },
        {
          sourceId: source.sourceId,
          source: source._id,
          hostname: source.hostname,
          timestamp: ts,
          cpu: { utilization: parseFloat(cpuUtil.toFixed(1)), loadAvg1m: parseFloat((cpuUtil / 100 * 4).toFixed(2)) },
          memory: { usedPercent: parseFloat(randomBetween(20, 92).toFixed(1)), totalBytes: 8 * 1024 * 1024 * 1024 },
          disk: { usedPercent: parseFloat(randomBetween(10, 85).toFixed(1)) },
          network: { rxBytesPerSec: Math.floor(randomBetween(1000, 5000000)), txBytesPerSec: Math.floor(randomBetween(1000, 2000000)) },
          logIngestionRate: Math.floor(randomBetween(10, 500)),
          errorRate: parseFloat(randomBetween(0, 5).toFixed(2)),
          health,
          lastHeartbeat: new Date(ts.getTime() + 30000),
          isDemo: true,
        },
        { upsert: true, new: true },
      );
    }
  }
  logger.info('Server metrics seeded.');

  // ─── 6. MODEL REGISTRY ────────────────────────────────────────
  logger.info('Seeding demo model registry...');
  await ModelRegistryEntry.findOneAndUpdate(
    { modelId: 'demo-baseline-v1' },
    {
      modelId: 'demo-baseline-v1',
      version: 'v1.0.0-baseline',
      architecture: 'baseline-statistical',
      description: '[DEMO] Baseline statistical scorer using severity heuristics and keyword matching.',
      status: 'production',
      config: { preprocessingMode: 'parser-free-semantic', device: 'cpu' },
      evaluationResult: {
        precision: null,
        recall: null,
        f1Score: null,
        threshold: 0.35,
        evaluatedAt: new Date(),
        isDemo: true,
        note: 'Baseline model does not have trained evaluation metrics. Precision/Recall/F1 require a labeled evaluation dataset.',
      },
      inferenceLatencyP50Ms: 2,
      inferenceLatencyP95Ms: 8,
      promotedAt: H(48),
      createdBy: adminUser._id,
    },
    { upsert: true, new: true },
  );

  await ModelRegistryEntry.findOneAndUpdate(
    { modelId: 'demo-hybrid-v1' },
    {
      modelId: 'demo-hybrid-v1',
      version: 'v1.0.0-hybrid-draft',
      architecture: 'cnn-lstm-transformer',
      description: '[DEMO] CNN+LSTM+Transformer hybrid model - draft. Not yet evaluated. Requires training.',
      status: 'draft',
      config: { hiddenDim: 128, numLayers: 2, numHeads: 4, dropoutRate: 0.1, sequenceLength: 50, preprocessingMode: 'parser-free-semantic', device: 'cpu' },
      createdBy: adminUser._id,
    },
    { upsert: true, new: true },
  );
  logger.info('Model registry seeded.');

  // ─── 7. ALERT RULES ──────────────────────────────────────────
  logger.info('Seeding alert rules...');
  await AlertRule.findOneAndUpdate(
    { name: '[DEMO] Critical Anomaly Alert' },
    {
      name: '[DEMO] Critical Anomaly Alert',
      description: 'Alert when a critical severity anomaly is detected.',
      enabled: true,
      conditions: { severityThreshold: 'critical', anomalyScoreThreshold: 0.85 },
      cooldownMinutes: 15,
      notifications: [{ channel: 'in-app', enabled: true }],
      createdBy: adminUser._id,
    },
    { upsert: true, new: true },
  );

  await AlertRule.findOneAndUpdate(
    { name: '[DEMO] High Error Rate' },
    {
      name: '[DEMO] High Error Rate',
      description: 'Alert on high error rate.',
      enabled: true,
      conditions: { severityThreshold: 'high', eventCountInWindow: 10, windowMinutes: 5 },
      cooldownMinutes: 30,
      notifications: [{ channel: 'in-app', enabled: true }, { channel: 'slack', enabled: false, destination: '' }],
      createdBy: adminUser._id,
    },
    { upsert: true, new: true },
  );
  logger.info('Alert rules seeded.');

  // ─── 8. INCIDENTS ────────────────────────────────────────────
  logger.info('Seeding demo incidents...');
  const anomalyDocs = await Anomaly.find({ isDemo: true, severity: 'critical' }).limit(3).lean();

  await Incident.findOneAndUpdate(
    { incidentId: 'INC-DEMO-001' },
    {
      incidentId: 'INC-DEMO-001',
      title: '[DEMO] Authentication Service Brute Force Incident',
      description: 'Multiple failed login attempts detected from suspicious IP range. Possible credential stuffing attack.',
      severity: 'critical',
      status: 'investigating',
      anomalies: anomalyDocs.map(a => a._id),
      affectedServices: ['auth-service', 'api-gateway'],
      environment: 'production',
      assignedTo: analystUser._id,
      createdBy: adminUser._id,
      timeline: [
        { event: 'Incident created automatically from anomaly detection', actor: adminUser._id, at: H(6) },
        { event: 'Assigned to Jane Analyst for investigation', actor: adminUser._id, at: H(5.5) },
      ],
      notes: [{
        content: '[DEMO] Initial triage: 50+ failed auth attempts from IP 10.0.0.5 in a 2-minute window. Checking geolocation and blocking IP.',
        author: analystUser._id,
        createdAt: H(5),
      }],
      isDemo: true,
    },
    { upsert: true, new: true },
  );
  logger.info('Incidents seeded.');

  // ─── 9. SYSTEM SETTINGS ──────────────────────────────────────
  logger.info('Seeding system settings...');
  const defaultSettings = [
    { key: 'preprocessing.mode', value: 'parser-free-semantic', description: 'Active preprocessing mode', category: 'model' },
    { key: 'anomaly.threshold', value: 0.35, description: 'Default anomaly detection threshold', category: 'model' },
    { key: 'sessionization.windowMinutes', value: 5, description: 'Sessionization window in minutes', category: 'ingestion' },
    { key: 'retention.logDays', value: 90, description: 'Log retention period in days', category: 'retention' },
    { key: 'retention.anomalyDays', value: 365, description: 'Anomaly retention period in days', category: 'retention' },
    { key: 'ingestion.maxBatchSize', value: 100, description: 'Maximum batch size for log ingestion', category: 'ingestion' },
    { key: 'llm.provider', value: 'demo-mock', description: 'Active LLM provider (demo-mock when no key configured)', category: 'ai' },
    { key: 'timezone', value: 'UTC', description: 'System timezone', category: 'display' },
  ];

  for (const s of defaultSettings) {
    await SystemSetting.findOneAndUpdate({ key: s.key }, s, { upsert: true });
  }
  logger.info('System settings seeded.');

  logger.info('\n========== DEMO SEED COMPLETE ==========');
  logger.info('Development Credentials (DEMO ONLY - DO NOT USE IN PRODUCTION):');
  logger.info('  Admin:    admin@demo.local   / Admin1234!');
  logger.info('  Analyst:  analyst@demo.local / Analyst1234!');
  logger.info('  Viewer:   viewer@demo.local  / Viewer1234!');
  logger.info('=========================================\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
