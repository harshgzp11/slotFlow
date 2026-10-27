import { Router } from 'express';
import publicRoutes from './public.routes.js';
import authRoutes from './auth.routes.js';
import businessRoutes from './business.routes.js';
import serviceRoutes from './service.routes.js';
import staffRoutes from './staff.routes.js';
import bookingRoutes from './booking.routes.js';
import waitlistRoutes from './waitlist.routes.js';
import analyticsRoutes from './analytics.routes.js';
import queueRoutes from './queue.routes.js';

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { getRecoveryWorkerStatus } from '../workers/recovery.worker.js';

const router = Router();

// Health check endpoint with database connectivity check
router.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;
  const workerStatus = getRecoveryWorkerStatus();

  // env.ENABLE_BACKGROUND_WORKER is parsed as boolean by zod (handles boolean or 'true' string safely)
  const isWorkerConfigured = env.ENABLE_BACKGROUND_WORKER === true || env.ENABLE_BACKGROUND_WORKER === 'true';

  const healthData = {
    status: isDbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'slotflow-api',
    uptime: Math.floor(process.uptime()),
    database: {
      status: isDbConnected ? 'connected' : 'disconnected',
      readyState: dbState
    },
    worker: {
      configured: isWorkerConfigured,
      enabled: isWorkerConfigured,
      running: workerStatus.running,
      workerId: workerStatus.workerId,
      intervalMs: workerStatus.intervalMs || env.WORKER_INTERVAL_MS,
      lastIterationAt: workerStatus.lastIterationAt
    }
  };

  const statusCode = isDbConnected ? 200 : 503;
  res.status(statusCode).json(healthData);
});

router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/businesses', businessRoutes);
router.use('/services', serviceRoutes);
router.use('/staff', staffRoutes);
router.use('/bookings', bookingRoutes);
router.use('/waitlist', waitlistRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/queue', queueRoutes);

export default router;
