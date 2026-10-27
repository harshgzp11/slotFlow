import { Router } from 'express';
import { requireAuth, tenantGuard, requireRole } from '../middleware/auth.js';
import { listWaitlistEntries, triggerRecoveryCycle } from '../controllers/waitlist.controller.js';

const router = Router();

router.use(requireAuth, tenantGuard);

router.get('/', listWaitlistEntries);
router.post('/trigger-recovery', requireRole(['OWNER', 'MANAGER', 'STAFF']), triggerRecoveryCycle);

export default router;
