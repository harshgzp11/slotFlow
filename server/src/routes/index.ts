import { Router } from 'express';
import publicRoutes from './public.routes';
import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import serviceRoutes from './service.routes';
import staffRoutes from './staff.routes';
import bookingRoutes from './booking.routes';

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

export default router;
