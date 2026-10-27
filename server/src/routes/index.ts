import { Router } from 'express';
import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import serviceRoutes from './service.routes';
import staffRoutes from './staff.routes';

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

router.use('/auth', authRoutes);
router.use('/businesses', businessRoutes);
router.use('/services', serviceRoutes);
router.use('/staff', staffRoutes);

export default router;
