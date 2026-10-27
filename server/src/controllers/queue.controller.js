import { z } from 'zod';
import mongoose from 'mongoose';
import { QueueTicket } from '../models/QueueTicket.js';
import { Business } from '../models/Business.js';
import { Service } from '../models/Service.js';
import { calculateQueueWaitEstimate, generateNextTicketNumber } from '../services/queue.service.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const joinQueueSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  preferredStaffId: z.string().optional().nullable(),
  customer: z.object({
    name: z.string().min(2, 'Customer name is required'),
    phone: z.string().min(5, 'Valid phone number is required'),
    email: z.string().email().optional()
  }),
  notes: z.string().optional()
});

const updateTicketStatusSchema = z.object({
  status: z.enum(['CALLED', 'IN_SERVICE', 'COMPLETED', 'NO_SHOW', 'CANCELLED']),
  assignedStaffId: z.string().optional().nullable()
});

// PUBLIC ENDPOINTS

export async function joinPublicQueue(req, res, next) {
  try {
    const { slug } = req.params;
    const data = joinQueueSchema.parse(req.body);

    const business = await Business.findOne({ slug, isActive: true });
    if (!business) {
      throw new NotFoundError(`Business workspace "${slug}" not found.`);
    }

    const service = await Service.findOne({ _id: data.serviceId, businessId: business._id });
    if (!service) {
      throw new NotFoundError('Service not found.');
    }

    const ticketNumber = await generateNextTicketNumber(business._id);
    const estimatedWaitMinutes = await calculateQueueWaitEstimate({
      businessId: business._id,
      serviceId: service._id
    });

    const ticket = await QueueTicket.create({
      businessId: business._id,
      ticketNumber,
      customer: data.customer,
      serviceId: service._id,
      preferredStaffId: data.preferredStaffId ? new mongoose.Types.ObjectId(data.preferredStaffId) : null,
      estimatedWaitMinutes,
      notes: data.notes,
      status: 'WAITING'
    });

    res.status(201).json({
      success: true,
      message: `You are in line! Your ticket is ${ticketNumber}.`,
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicTicketStatus(req, res, next) {
  try {
    const { id } = req.params;

    const ticket = await QueueTicket.findById(id)
      .populate('serviceId', 'name durationMinutes price')
      .populate('businessId', 'name slug timezone')
      .populate('assignedStaffId', 'displayName');

    if (!ticket) throw new NotFoundError('Queue ticket not found.');

    // Count tickets ahead
    let positionAhead = 0;
    if (ticket.status === 'WAITING') {
      positionAhead = await QueueTicket.countDocuments({
        businessId: ticket.businessId._id,
        status: 'WAITING',
        createdAt: { $lt: ticket.createdAt }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ticket,
        positionAhead: positionAhead + 1
      }
    });
  } catch (error) {
    next(error);
  }
}

// PROTECTED DASHBOARD ENDPOINTS

export async function listQueueTickets(req, res, next) {
  try {
    const { status } = req.query;

    const query = { businessId: req.business._id };
    if (status) {
      query.status = status;
    } else {
      // By default list today's active tickets (WAITING, CALLED, IN_SERVICE)
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      query.createdAt = { $gte: startOfDay };
    }

    const tickets = await QueueTicket.find(query)
      .populate('serviceId', 'name durationMinutes price')
      .populate('preferredStaffId', 'displayName')
      .populate('assignedStaffId', 'displayName')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: { tickets }
    });
  } catch (error) {
    next(error);
  }
}

export async function createStaffQueueTicket(req, res, next) {
  try {
    const data = joinQueueSchema.parse(req.body);

    const service = await Service.findOne({ _id: data.serviceId, businessId: req.business._id });
    if (!service) throw new NotFoundError('Service not found.');

    const ticketNumber = await generateNextTicketNumber(req.business._id);
    const estimatedWaitMinutes = await calculateQueueWaitEstimate({
      businessId: req.business._id,
      serviceId: service._id
    });

    const ticket = await QueueTicket.create({
      businessId: req.business._id,
      ticketNumber,
      customer: data.customer,
      serviceId: service._id,
      preferredStaffId: data.preferredStaffId ? new mongoose.Types.ObjectId(data.preferredStaffId) : null,
      estimatedWaitMinutes,
      notes: data.notes,
      status: 'WAITING'
    });

    res.status(201).json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTicketStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status: targetStatus, assignedStaffId } = updateTicketStatusSchema.parse(req.body);

    const ticket = await QueueTicket.findOne({ _id: id, businessId: req.business._id });
    if (!ticket) throw new NotFoundError('Queue ticket not found.');

    const now = new Date();
    ticket.status = targetStatus;

    if (assignedStaffId) {
      ticket.assignedStaffId = new mongoose.Types.ObjectId(assignedStaffId);
    }
    if (targetStatus === 'CALLED') ticket.calledAtUtc = now;
    if (targetStatus === 'IN_SERVICE') ticket.serviceStartedAtUtc = now;
    if (targetStatus === 'COMPLETED') ticket.completedAtUtc = now;

    await ticket.save();

    res.status(200).json({
      success: true,
      message: `Queue ticket updated to ${targetStatus}`,
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
}
