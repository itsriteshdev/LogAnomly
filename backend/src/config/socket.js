import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';

let ioInstance = null;

export function initSocketIO(io) {
  ioInstance = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user: ${socket.userId}`);

    socket.join(`user:${socket.userId}`);
    socket.join('dashboard');

    socket.on('subscribe:logs', () => {
      socket.join('live-logs');
    });
    socket.on('unsubscribe:logs', () => {
      socket.leave('live-logs');
    });
    socket.on('subscribe:anomalies', () => {
      socket.join('anomalies');
    });
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

export function getIO() {
  return ioInstance;
}

export function emitToRoom(room, event, data) {
  if (ioInstance) {
    ioInstance.to(room).emit(event, data);
  }
}

export function emitNewLog(logEvent) {
  emitToRoom('live-logs', 'log:new', logEvent);
  emitToRoom('dashboard', 'metrics:update', { type: 'log' });
}

export function emitNewAnomaly(anomaly) {
  emitToRoom('anomalies', 'anomaly:new', anomaly);
  emitToRoom('dashboard', 'anomaly:new', anomaly);
  emitToRoom('live-logs', 'anomaly:detected', anomaly);
}

export function emitAnomalyUpdate(anomaly) {
  emitToRoom('dashboard', 'anomaly:updated', anomaly);
}

export function emitIngestionUpdate(data) {
  emitToRoom('dashboard', 'ingestion:update', data);
}

export function emitTrainingProgress(jobId, progress) {
  emitToRoom('dashboard', 'training:progress', { jobId, ...progress });
}
