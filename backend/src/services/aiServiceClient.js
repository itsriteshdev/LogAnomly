/**
 * AI Service HTTP Client
 * 
 * Mediates calls from the Express backend to the Python FastAPI AI service.
 * Frontend never has direct access to AI service or its credentials.
 * Falls back gracefully when AI service is unavailable.
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

const AI_BASE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_KEY = process.env.AI_SERVICE_API_KEY || '';
const TIMEOUT_MS = 30000;

const aiClient = axios.create({
  baseURL: AI_BASE_URL,
  timeout: TIMEOUT_MS,
  headers: {
    'X-API-Key': AI_API_KEY,
    'Content-Type': 'application/json',
  },
});

/**
 * Call AI service endpoint with safe fallback.
 * Returns { success: true, data } or { success: false, error, fallback: true }
 */
export async function callAIService(endpoint, body = {}) {
  try {
    const response = await aiClient.post(endpoint, body);
    return { success: true, data: response.data };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.response?.status >= 500) {
      logger.warn(`AI service unavailable at ${endpoint}: ${err.message}`);
      return {
        success: false,
        fallback: true,
        error: 'AI service is currently unavailable. LangChain analysis requires a running AI service.',
        note: 'Start the AI service with: cd ai-service && uvicorn main:app --reload',
      };
    }
    logger.error(`AI service error at ${endpoint}: ${err.message}`);
    return {
      success: false,
      fallback: false,
      error: err.response?.data?.detail || err.message,
    };
  }
}

export async function getAIServiceHealth() {
  try {
    const response = await aiClient.get('/health', { timeout: 3000 });
    return { available: true, data: response.data };
  } catch {
    return { available: false, data: null };
  }
}
