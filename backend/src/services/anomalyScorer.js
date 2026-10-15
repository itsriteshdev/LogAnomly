/**
 * Anomaly Scorer Service
 * 
 * This is the backend scoring bridge. It calls the Python AI service for
 * the actual CNN/LSTM/Transformer hybrid model inference when available,
 * and falls back to a statistical baseline when the AI service is unreachable.
 * 
 * IMPORTANT: Returned scores from the baseline are labeled as BASELINE method.
 * Do not present baseline results as hybrid model results.
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || '';

// Severity thresholds derived from configured policy
const SCORE_THRESHOLDS = {
  critical: 0.85,
  high: 0.70,
  medium: 0.50,
  low: 0.35,
};

function deriveSeverity(score) {
  if (score >= SCORE_THRESHOLDS.critical) return 'critical';
  if (score >= SCORE_THRESHOLDS.high) return 'high';
  if (score >= SCORE_THRESHOLDS.medium) return 'medium';
  if (score >= SCORE_THRESHOLDS.low) return 'low';
  return 'info';
}

function deriveCategory(message, severity) {
  const msg = message.toLowerCase();
  if (/auth|login|password|credential|unauthorized|403|401/.test(msg)) return 'auth-failure';
  if (/cpu|memory|ram|heap|oom|out of memory/.test(msg)) return 'resource-spike';
  if (/connection refused|timeout|service unavailable|503|504/.test(msg)) return 'service-failure';
  if (/database|db|sql|mongo|query|deadlock/.test(msg)) return 'database-anomaly';
  if (/network|socket|tcp|udp|packet|latency/.test(msg)) return 'network-anomaly';
  if (/error|exception|panic|crash|fatal/.test(msg) && severity === 'CRITICAL') return 'error-burst';
  return 'unknown';
}

/**
 * Baseline statistical scorer: uses keyword and severity heuristics.
 * Label: BASELINE/DEMO - not the trained hybrid model.
 */
function baselineScore(logEvent) {
  const { severity, message } = logEvent;
  
  let score = 0.1; // base score for normal events

  // Severity contribution
  const severityScores = { CRITICAL: 0.6, ERROR: 0.4, WARNING: 0.2, INFO: 0.05, DEBUG: 0.02, TRACE: 0.01 };
  score += severityScores[severity] || 0.05;

  // Keyword contribution
  const highRiskKeywords = ['crash', 'fatal', 'panic', 'deadlock', 'out of memory', 'connection refused', 'unauthorized'];
  const medRiskKeywords = ['error', 'exception', 'timeout', 'failed', 'refused', 'denied'];
  
  const msg = message.toLowerCase();
  if (highRiskKeywords.some(k => msg.includes(k))) score += 0.3;
  else if (medRiskKeywords.some(k => msg.includes(k))) score += 0.15;

  // Clamp to [0, 1]
  score = Math.min(1, Math.max(0, score));

  // Add small random variation to simulate variability (deterministic per message)
  const hash = message.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variation = ((hash % 20) - 10) / 100; // ±0.1
  score = Math.min(1, Math.max(0, score + variation));

  return score;
}

export async function scoreLogEvent(logEvent) {
  const threshold = 0.35; // Default anomaly detection threshold
  
  try {
    // Try the AI service first
    const response = await axios.post(
      `${AI_SERVICE_URL}/score`,
      {
        eventId: logEvent.eventId,
        message: logEvent.message,
        severity: logEvent.severity,
        serviceName: logEvent.serviceName,
        timestamp: logEvent.timestamp,
        structuredFields: logEvent.structuredFields || {},
      },
      {
        headers: { 'X-API-Key': AI_SERVICE_API_KEY, 'Content-Type': 'application/json' },
        timeout: 5000,
      },
    );

    const { score, method, modelVersion, category } = response.data;
    return {
      score,
      threshold,
      isAnomaly: score >= threshold,
      severity: deriveSeverity(score),
      method: method || 'hybrid',
      modelVersion: modelVersion || 'unknown',
      category: category || deriveCategory(logEvent.message, logEvent.severity),
    };
  } catch (err) {
    // Fallback to baseline
    logger.debug(`AI service unavailable for scoring, using baseline: ${err.message}`);
    const score = baselineScore(logEvent);
    return {
      score,
      threshold,
      isAnomaly: score >= threshold,
      severity: deriveSeverity(score),
      method: 'baseline',
      modelVersion: 'baseline-v1',
      category: deriveCategory(logEvent.message, logEvent.severity),
    };
  }
}
