import { Router } from 'express';
import { requireAuth, tenantGuard, requireRole } from '../middleware/auth.js';
import {
  listQueueTickets,
  createStaffQueueTicket,
  updateTicketStatus
} from '../controllers/queue.controller.js';

const router = Router();

router.use(requireAuth, tenantGuard);
router.use(requireRole(['OWNER', 'MANAGER', 'STAFF']));

router.get('/', listQueueTickets);
router.post('/', createStaffQueueTicket);
router.patch('/:id/status', updateTicketStatus);

export default router;
