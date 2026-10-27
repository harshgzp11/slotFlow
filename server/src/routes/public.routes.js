import { Router } from 'express';
import {
  getPublicAvailability,
  createPublicBooking,
  getManageBooking,
  cancelPublicBooking,
  reschedulePublicBooking
} from '../controllers/booking.controller.js';
import { getPublicBusinessBySlug } from '../controllers/business.controller.js';

const router = Router();

// Public Business Profile & Catalog
router.get('/businesses/:slug', getPublicBusinessBySlug);

// Public Availability & Booking
router.get('/availability', getPublicAvailability);
router.post('/bookings', createPublicBooking);

// Guest Booking Management via Secure Action Token
router.get('/bookings/:id/manage', getManageBooking);
router.post('/bookings/:id/cancel', cancelPublicBooking);
router.post('/bookings/:id/reschedule', reschedulePublicBooking);

export default router;
