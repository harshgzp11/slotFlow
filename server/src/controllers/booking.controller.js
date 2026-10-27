import { z } from 'zod';
import mongoose from 'mongoose';
import { Business } from '../models/Business.js';
import { Booking } from '../models/Booking.js';
import { getAvailableSlots } from '../services/availability.service.js';
import {
  createBooking,
  cancelBookingWithZeroGap,
  rescheduleBooking,
  verifyActionToken
} from '../services/booking.service.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../middleware/errorHandler.js';

const createBookingSchema = z.object({
  slug: z.string(),
  serviceId: z.string(),
  staffId: z.string(),
  startTimeUtc: z.string().datetime(),
  customer: z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().min(5, 'Valid phone number is required')
  })
});

const rescheduleSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newStartTimeUtc: z.string().datetime()
});

const cancelSchema = z.object({
  token: z.string().optional(),
  reason: z.string().optional()
});

// PUBLIC ENDPOINTS

export async function getPublicAvailability(req, res, next) {
  try {
    const { slug, serviceId, date, staffId } = req.query;

    if (!slug || !serviceId || !date) {
      throw new ValidationError('slug, serviceId, and date query parameters are required.');
    }

    const business = await Business.findOne({ slug: String(slug), isActive: true });
    if (!business) {
      throw new NotFoundError(`Business workspace "${slug}" not found.`);
    }

    const slots = await getAvailableSlots({
      businessId: business._id,
      serviceId: new mongoose.Types.ObjectId(String(serviceId)),
      dateStr: String(date),
      staffId: staffId ? new mongoose.Types.ObjectId(String(staffId)) : undefined
    });

    res.status(200).json({
      success: true,
      data: {
        business: {
          id: business._id,
          name: business.name,
          timezone: business.timezone,
          currency: business.currency
        },
        date,
        slotsCount: slots.length,
        slots
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createPublicBooking(req, res, next) {
  try {
    const data = createBookingSchema.parse(req.body);

    const business = await Business.findOne({ slug: data.slug, isActive: true });
    if (!business) {
      throw new NotFoundError(`Business workspace "${data.slug}" not found.`);
    }

    const { booking, rawManageToken } = await createBooking({
      businessId: business._id,
      serviceId: new mongoose.Types.ObjectId(data.serviceId),
      staffId: new mongoose.Types.ObjectId(data.staffId),
      startTimeUtc: new Date(data.startTimeUtc),
      customer: data.customer,
      source: 'PUBLIC'
    });

    res.status(201).json({
      success: true,
      data: {
        booking,
        manageToken: rawManageToken,
        manageUrl: `/appointments/${booking._id}/manage?token=${rawManageToken}`
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getManageBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      throw new UnauthorizedError('Management token is required.');
    }

    const booking = await Booking.findById(id)
      .populate('serviceId', 'name durationMinutes price')
      .populate('staffId', 'displayName email')
      .populate('businessId', 'name slug timezone currency');

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (!verifyActionToken(booking.manageTokenHash, String(token))) {
      throw new UnauthorizedError('Invalid management token.');
    }

    res.status(200).json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelPublicBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { token, reason } = cancelSchema.parse(req.body);

    if (!token) {
      throw new UnauthorizedError('Management token is required.');
    }

    const booking = await Booking.findById(id);
    if (!booking) throw new NotFoundError('Booking not found.');

    const updatedBooking = await cancelBookingWithZeroGap({
      bookingId: booking._id,
      businessId: booking.businessId,
      reason,
      rawToken: token
    });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Time slot released.',
      data: { booking: updatedBooking }
    });
  } catch (error) {
    next(error);
  }
}

export async function reschedulePublicBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { token, newStartTimeUtc } = rescheduleSchema.parse(req.body);

    const booking = await Booking.findById(id);
    if (!booking) throw new NotFoundError('Booking not found.');

    const updatedBooking = await rescheduleBooking({
      bookingId: booking._id,
      businessId: booking.businessId,
      newStartTimeUtc: new Date(newStartTimeUtc),
      rawToken: token
    });

    res.status(200).json({
      success: true,
      message: 'Booking rescheduled successfully.',
      data: { booking: updatedBooking }
    });
  } catch (error) {
    next(error);
  }
}

// PROTECTED STAFF / OWNER ENDPOINTS

export async function listBookings(req, res, next) {
  try {
    const { date, staffId, status, search } = req.query;

    const query = { businessId: req.business._id };

    if (status) {
      query.status = status;
    }
    if (staffId && mongoose.Types.ObjectId.isValid(String(staffId))) {
      query.staffId = new mongoose.Types.ObjectId(String(staffId));
    }
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      query.startTimeUtc = { $gte: startOfDay, $lte: endOfDay };
    }
    if (search) {
      query.$or = [
        { 'customer.name': { $regex: String(search), $options: 'i' } },
        { 'customer.email': { $regex: String(search), $options: 'i' } },
        { 'customer.phone': { $regex: String(search), $options: 'i' } }
      ];
    }

    const bookings = await Booking.find(query)
      .populate('serviceId', 'name durationMinutes price')
      .populate('staffId', 'displayName')
      .sort({ startTimeUtc: 1 });

    res.status(200).json({
      success: true,
      data: { bookings }
    });
  } catch (error) {
    next(error);
  }
}

export async function getBookingById(req, res, next) {
  try {
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, businessId: req.business._id })
      .populate('serviceId')
      .populate('staffId');

    if (!booking) throw new NotFoundError('Booking not found.');

    res.status(200).json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelStaffBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await cancelBookingWithZeroGap({
      bookingId: new mongoose.Types.ObjectId(id),
      businessId: req.business._id,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled by staff. Slot converted to recovery hold.',
      data: { booking }
    });
  } catch (error) {
    next(error);
  }
}
