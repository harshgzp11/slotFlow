import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {'WAITING' | 'CALLED' | 'IN_SERVICE' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'} QueueStatus
 */

const queueTicketSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    ticketNumber: {
      type: String,
      required: true
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, lowercase: true }
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    preferredStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null
    },
    assignedStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null
    },
    status: {
      type: String,
      enum: ['WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
      default: 'WAITING',
      index: true
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 15
    },
    calledAtUtc: {
      type: Date
    },
    serviceStartedAtUtc: {
      type: Date
    },
    completedAtUtc: {
      type: Date
    },
    notes: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

queueTicketSchema.index({ businessId: 1, status: 1, createdAt: 1 });

export const QueueTicket = mongoose.model('QueueTicket', queueTicketSchema);
