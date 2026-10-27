import { Router } from 'express';
import {
  createBusiness,
  getCurrentBusiness,
  updateCurrentBusiness,
  getPublicBusinessBySlug
} from '../controllers/business.controller';
import { requireAuth, tenantGuard, requireRole } from '../middleware/auth';

const router = Router();

// Public route for customer booking page
router.get('/public/:slug', getPublicBusinessBySlug);

// Protected routes
router.post('/', requireAuth, createBusiness);
router.get('/current', requireAuth, tenantGuard, getCurrentBusiness);
router.patch('/current', requireAuth, tenantGuard, requireRole(['OWNER', 'MANAGER']), updateCurrentBusiness);

export default router;
