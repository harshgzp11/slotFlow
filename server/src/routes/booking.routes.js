import { Router } from 'express';
import {
  listBookings,
  getBookingById,
  cancelStaffBooking,
  updateBookingStatus
} from '../controllers/booking.controller.js';
import { requireAuth, tenantGuard } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, tenantGuard);

router.get('/', listBookings);
router.get('/:id', getBookingById);
router.patch('/:id/status', updateBookingStatus);
router.post('/:id/cancel', cancelStaffBooking);

export default router;
