import { z } from 'zod';
import mongoose from 'mongoose';
import { Business } from '../models/Business.js';
import { WaitlistEntry } from '../models/WaitlistEntry.js';
import { WaitlistOffer } from '../models/WaitlistOffer.js';
import { Service } from '../models/Service.js';
import {
  claimRecoveryJob,
  processClaimedRecoveryJob,
  acceptWaitlistOffer,
  declineWaitlistOffer,
  hashClaimToken
} from '../services/recovery.service.js';
import { NotFoundError, UnauthorizedError, ValidationError, ConflictError } from '../middleware/errorHandler.js';

const joinWaitlistSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  preferredStaffId: z.string().optional().nullable(),
  preferredDateRange: z.object({
    startDate: z.string(),
    endDate: z.string()
  }),
  timeOfDayPreference: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANY']).default('ANY'),
  flexibleDays: z.number().min(0).max(7).default(0),
  notes: z.string().optional(),
  customer: z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().min(5, 'Valid phone number is required')
  })
});

const offerActionSchema = z.object({
  token: z.string().min(1, 'Claim token is required')
});

// PUBLIC ENDPOINTS

export async function joinPublicWaitlist(req, res, next) {
  try {
    const { slug } = req.params;
    const data = joinWaitlistSchema.parse(req.body);

    const business = await Business.findOne({ slug, isActive: true });
    if (!business) {
      throw new NotFoundError(`Business workspace "${slug}" not found.`);
    }

    const service = await Service.findOne({ _id: data.serviceId, businessId: business._id });
    if (!service) {
      throw new NotFoundError('Selected service not found.');
    }

    const entry = await WaitlistEntry.create({
      businessId: business._id,
      customer: data.customer,
      serviceId: service._id,
      preferredStaffId: data.preferredStaffId ? new mongoose.Types.ObjectId(data.preferredStaffId) : null,
      preferredDateRange: {
        startDate: new Date(data.preferredDateRange.startDate),
        endDate: new Date(data.preferredDateRange.endDate)
      },
      timeOfDayPreference: data.timeOfDayPreference,
      flexibleDays: data.flexibleDays,
      notes: data.notes,
      status: 'WAITING',
      priorityScore: 100
    });

    res.status(201).json({
      success: true,
      message: 'You have been added to the priority waitlist. We will notify you when a slot opens.',
      data: { waitlistEntry: entry }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicOffer(req, res, next) {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      throw new UnauthorizedError('Offer claim token is required.');
    }

    const offer = await WaitlistOffer.findById(id)
      .populate('serviceId', 'name durationMinutes price')
      .populate('staffId', 'displayName')
      .populate('businessId', 'name slug timezone currency');

    if (!offer) {
      throw new NotFoundError('Waitlist offer not found.');
    }

    if (offer.claimTokenHash !== hashClaimToken(String(token))) {
      throw new UnauthorizedError('Invalid claim token.');
    }

    const isExpired = offer.status === 'PENDING' && offer.expiresAt < new Date();

    res.status(200).json({
      success: true,
      data: {
        offer,
        isExpired,
        secondsRemaining: Math.max(0, Math.floor((offer.expiresAt.getTime() - Date.now()) / 1000))
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptPublicOffer(req, res, next) {
  try {
    const { id } = req.params;
    const { token } = offerActionSchema.parse(req.body);

    const result = await acceptWaitlistOffer({
      offerId: id,
      rawClaimToken: token
    });

    res.status(200).json({
      success: true,
      message: 'Waitlist offer accepted! Your appointment is confirmed.',
      data: {
        booking: result.booking,
        manageToken: result.rawManageToken,
        manageUrl: `/appointments/${result.booking._id}/manage?token=${result.rawManageToken}`
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function declinePublicOffer(req, res, next) {
  try {
    const { id } = req.params;
    const { token } = offerActionSchema.parse(req.body);

    await declineWaitlistOffer(id, token);

    res.status(200).json({
      success: true,
      message: 'Offer declined. The slot will be offered to the next candidate.'
    });
  } catch (error) {
    next(error);
  }
}

// PROTECTED DASHBOARD ENDPOINTS

export async function listWaitlistEntries(req, res, next) {
  try {
    const { status, serviceId } = req.query;

    const query = { businessId: req.business._id };
    if (status) query.status = status;
    if (serviceId && mongoose.Types.ObjectId.isValid(String(serviceId))) {
      query.serviceId = new mongoose.Types.ObjectId(String(serviceId));
    }

    const entries = await WaitlistEntry.find(query)
      .populate('serviceId', 'name durationMinutes price')
      .populate('preferredStaffId', 'displayName')
      .sort({ priorityScore: -1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: { waitlistEntries: entries }
    });
  } catch (error) {
    next(error);
  }
}

export async function triggerRecoveryCycle(req, res, next) {
  try {
    const workerId = `worker-${Date.now()}`;
    const job = await claimRecoveryJob(workerId);

    if (!job) {
      return res.status(200).json({
        success: true,
        message: 'No pending recovery jobs found to process.',
        data: null
      });
    }

    const result = await processClaimedRecoveryJob(job, workerId);

    res.status(200).json({
      success: true,
      message: 'Recovery job processed successfully.',
      data: { job, result }
    });
  } catch (error) {
    next(error);
  }
}
