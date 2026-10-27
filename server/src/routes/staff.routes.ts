import { Router } from 'express';
import {
  listStaff,
  createStaff,
  updateStaff,
  updateStaffSchedule
} from '../controllers/staff.controller';
import { requireAuth, tenantGuard, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, tenantGuard);

router.get('/', listStaff);
router.post('/', requireRole(['OWNER', 'MANAGER']), createStaff);
router.patch('/:id', requireRole(['OWNER', 'MANAGER']), updateStaff);
router.put('/:id/schedule', requireRole(['OWNER', 'MANAGER']), updateStaffSchedule);

export default router;
