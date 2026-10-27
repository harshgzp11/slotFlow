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
import {
  joinPublicQueue,
  getPublicTicketStatus
} from '../controllers/queue.controller.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const publicBookingLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many booking attempts from this IP. Please wait a few minutes before trying again.'
});

// Public Business Profile & Catalog
router.get('/businesses/:slug', getPublicBusinessBySlug);

// Public Availability & Booking
router.get('/availability', getPublicAvailability);
router.post('/bookings', publicBookingLimiter, createPublicBooking);

// Public Waitlist Intake
router.post('/businesses/:slug/waitlist', joinPublicWaitlist);

// Public Walk-In Queue Intake & Tracking
router.post('/businesses/:slug/queue', joinPublicQueue);
router.get('/queue/tickets/:id', getPublicTicketStatus);

// Public Waitlist Recovery Offer Actions
router.get('/offers/:id', getPublicOffer);
router.post('/offers/:id/accept', acceptPublicOffer);
router.post('/offers/:id/decline', declinePublicOffer);

// Guest Booking Management via Secure Action Token
router.get('/bookings/:id/manage', getManageBooking);
router.post('/bookings/:id/cancel', cancelPublicBooking);
router.post('/bookings/:id/reschedule', reschedulePublicBooking);

export default router;
