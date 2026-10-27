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

const router = Router();

// Health check endpoint with database connectivity check
router.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;

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
      enabled: env.ENABLE_BACKGROUND_WORKER === 'true'
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
