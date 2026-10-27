import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Service } from '../models/Service';
import { Staff } from '../models/Staff';
import { NotFoundError } from '../middleware/errorHandler';

const serviceInputSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters'),
  description: z.string().optional(),
  durationMinutes: z.number().min(15).refine((val) => val % 15 === 0, {
    message: 'Duration must be a multiple of 15 minutes'
  }),
  bufferBefore: z.number().min(0).default(0).refine((val) => val % 15 === 0, {
    message: 'Buffer before must be a multiple of 15 minutes'
  }),
  bufferAfter: z.number().min(0).default(0).refine((val) => val % 15 === 0, {
    message: 'Buffer after must be a multiple of 15 minutes'
  }),
  price: z.number().min(0, 'Price must be non-negative'),
  qualifiedStaffIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});

export async function listServices(req: Request, res: Response, next: NextFunction) {
  try {
    const services = await Service.find({ businessId: req.business!._id })
      .populate('qualifiedStaffIds', 'displayName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { services }
    });
  } catch (error) {
    next(error);
  }
}

export async function createService(req: Request, res: Response, next: NextFunction) {
  try {
    const data = serviceInputSchema.parse(req.body);

    const service = await Service.create({
      businessId: req.business!._id,
      ...data
    });

    // Synchronize Staff.servicesOffered
    if (data.qualifiedStaffIds.length > 0) {
      await Staff.updateMany(
        { _id: { $in: data.qualifiedStaffIds }, businessId: req.business!._id },
        { $addToSet: { servicesOffered: service._id } }
      );
    }

    res.status(201).json({
      success: true,
      data: { service }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateService(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = serviceInputSchema.partial().parse(req.body);

    const service = await Service.findOneAndUpdate(
      { _id: id, businessId: req.business!._id },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    // If qualified staff were updated, synchronize
    if (data.qualifiedStaffIds) {
      // Remove service from staff not in list
      await Staff.updateMany(
        { businessId: req.business!._id, _id: { $nin: data.qualifiedStaffIds } },
        { $pull: { servicesOffered: service._id } }
      );
      // Add service to staff in list
      await Staff.updateMany(
        { businessId: req.business!._id, _id: { $in: data.qualifiedStaffIds } },
        { $addToSet: { servicesOffered: service._id } }
      );
    }

    res.status(200).json({
      success: true,
      data: { service }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteService(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const service = await Service.findOneAndUpdate(
      { _id: id, businessId: req.business!._id },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    res.status(200).json({
      success: true,
      message: 'Service deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
}
