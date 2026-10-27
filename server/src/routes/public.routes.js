import { Router } from 'express';
import {
  getPublicAvailability,
  createPublicBooking,
  getManageBooking,
  cancelPublicBooking,
  reschedulePublicBooking
} from '../controllers/booking.controller.js';
import { getPublicBusinessBySlug } from '../controllers/business.controller.js';
import {
  joinPublicWaitlist,
  getPublicOffer,
  acceptPublicOffer,
  declinePublicOffer
} from '../controllers/waitlist.controller.js';

const router = Router();

// Public Business Profile & Catalog
router.get('/businesses/:slug', getPublicBusinessBySlug);

// Public Availability & Booking
router.get('/availability', getPublicAvailability);
router.post('/bookings', createPublicBooking);

// Public Waitlist Intake
router.post('/businesses/:slug/waitlist', joinPublicWaitlist);

// Public Waitlist Recovery Offer Actions
router.get('/offers/:id', getPublicOffer);
router.post('/offers/:id/accept', acceptPublicOffer);
router.post('/offers/:id/decline', declinePublicOffer);

// Guest Booking Management via Secure Action Token
router.get('/bookings/:id/manage', getManageBooking);
router.post('/bookings/:id/cancel', cancelPublicBooking);
router.post('/bookings/:id/reschedule', reschedulePublicBooking);

export default router;
