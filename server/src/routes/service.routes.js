import { Router } from 'express';
import {
  listServices,
  createService,
  updateService,
  deleteService
} from '../controllers/service.controller.js';
import { requireAuth, tenantGuard, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, tenantGuard);

router.get('/', listServices);
router.post('/', requireRole(['OWNER', 'MANAGER']), createService);
router.patch('/:id', requireRole(['OWNER', 'MANAGER']), updateService);
router.delete('/:id', requireRole(['OWNER', 'MANAGER']), deleteService);

export default router;
