import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Staff } from '../models/Staff';
import { Service } from '../models/Service';
import { NotFoundError } from '../middleware/errorHandler';

const dayScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isWorking: z.boolean(),
  shiftStart: z.string(),
  shiftEnd: z.string(),
  breaks: z.array(
    z.object({
      start: z.string(),
      end: z.string()
    })
  ).default([])
});

const staffInputSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  email: z.string().email().optional(),
  servicesOffered: z.array(z.string()).default([]),
  weeklySchedule: z.array(dayScheduleSchema).optional(),
  isActive: z.boolean().default(true)
});

export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await Staff.find({ businessId: req.business!._id })
      .populate('servicesOffered', 'name durationMinutes price')
      .sort({ displayName: 1 });

    res.status(200).json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    next(error);
  }
}

export async function createStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const data = staffInputSchema.parse(req.body);

    const staff = await Staff.create({
      businessId: req.business!._id,
      ...data
    });

    // Synchronize Service.qualifiedStaffIds
    if (data.servicesOffered.length > 0) {
      await Service.updateMany(
        { _id: { $in: data.servicesOffered }, businessId: req.business!._id },
        { $addToSet: { qualifiedStaffIds: staff._id } }
      );
    }

    res.status(201).json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = staffInputSchema.partial().parse(req.body);

    const staff = await Staff.findOneAndUpdate(
      { _id: id, businessId: req.business!._id },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    // Synchronize Service qualifications if servicesOffered changed
    if (data.servicesOffered) {
      await Service.updateMany(
        { businessId: req.business!._id, _id: { $nin: data.servicesOffered } },
        { $pull: { qualifiedStaffIds: staff._id } }
      );
      await Service.updateMany(
        { businessId: req.business!._id, _id: { $in: data.servicesOffered } },
        { $addToSet: { qualifiedStaffIds: staff._id } }
      );
    }

    res.status(200).json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStaffSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { weeklySchedule } = z.object({ weeklySchedule: z.array(dayScheduleSchema) }).parse(req.body);

    const staff = await Staff.findOneAndUpdate(
      { _id: id, businessId: req.business!._id },
      { $set: { weeklySchedule } },
      { new: true, runValidators: true }
    );

    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    res.status(200).json({
      success: true,
      data: { staff }
    });
  } catch (error) {
    next(error);
  }
}
