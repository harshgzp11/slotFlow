import { Router } from 'express';
import {
  listBookings,
  getBookingById,
  cancelStaffBooking
} from '../controllers/booking.controller.js';
import { requireAuth, tenantGuard } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, tenantGuard);

router.get('/', listBookings);
router.get('/:id', getBookingById);
router.post('/:id/cancel', cancelStaffBooking);

export default router;
