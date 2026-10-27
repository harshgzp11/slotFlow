import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Business } from '../models/Business';
import { Membership } from '../models/Membership';
import { Service } from '../models/Service';
import { Staff } from '../models/Staff';
import { ConflictError, NotFoundError } from '../middleware/errorHandler';

const createBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  timezone: z.string().default('UTC'),
  currency: z.string().default('USD')
});

const updateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  workingHours: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6),
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string()
    })
  ).optional(),
  bookingPolicies: z.object({
    minNoticeHours: z.number().min(0).optional(),
    maxHorizonDays: z.number().min(1).optional(),
    cancelCutoffHours: z.number().min(0).optional()
  }).optional()
});

export async function createBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createBusinessSchema.parse(req.body);

    const existingSlug = await Business.findOne({ slug: data.slug });
    if (existingSlug) {
      throw new ConflictError(`The business handle / slug "${data.slug}" is already taken.`);
    }

    const business = await Business.create({
      name: data.name,
      slug: data.slug,
      description: data.description,
      timezone: data.timezone,
      currency: data.currency
    });

    // Create OWNER membership
    const membership = await Membership.create({
      userId: req.user!._id,
      businessId: business._id,
      role: 'OWNER'
    });

    // Set as active workspace in session
    req.session.activeBusinessId = business._id.toString();

    res.status(201).json({
      success: true,
      data: {
        business,
        membership
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({
      success: true,
      data: {
        business: req.business,
        membership: req.membership
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCurrentBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateBusinessSchema.parse(req.body);

    const business = await Business.findByIdAndUpdate(
      req.business!._id,
      { $set: data },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: { business }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicBusinessBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;

    const business = await Business.findOne({ slug, isActive: true }).select(
      'name slug description timezone currency workingHours bookingPolicies'
    );

    if (!business) {
      throw new NotFoundError(`Business workspace with slug "${slug}" not found.`);
    }

    const [services, staff] = await Promise.all([
      Service.find({ businessId: business._id, isActive: true }).select(
        'name description durationMinutes bufferBefore bufferAfter price qualifiedStaffIds'
      ),
      Staff.find({ businessId: business._id, isActive: true }).select(
        'displayName servicesOffered weeklySchedule'
      )
    ]);

    res.status(200).json({
      success: true,
      data: {
        business,
        services,
        staff
      }
    });
  } catch (error) {
    next(error);
  }
}
