import { Router } from 'express';
import publicRoutes from './public.routes.js';
import authRoutes from './auth.routes.js';
import businessRoutes from './business.routes.js';
import serviceRoutes from './service.routes.js';
import staffRoutes from './staff.routes.js';
import bookingRoutes from './booking.routes.js';
import waitlistRoutes from './waitlist.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'slotflow-api',
    uptime: process.uptime()
  });
});

router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/businesses', businessRoutes);
router.use('/services', serviceRoutes);
router.use('/staff', staffRoutes);
router.use('/bookings', bookingRoutes);
router.use('/waitlist', waitlistRoutes);

export default router;
