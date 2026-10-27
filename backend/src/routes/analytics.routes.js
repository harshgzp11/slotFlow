import { Router } from 'express';
import { requireAuth, tenantGuard, requireRole } from '../middleware/auth.js';
import { getAnalyticsOverview } from '../controllers/analytics.controller.js';

const router = Router();

router.use(requireAuth, tenantGuard);
router.use(requireRole(['OWNER', 'MANAGER', 'STAFF']));

router.get('/overview', getAnalyticsOverview);

export default router;
