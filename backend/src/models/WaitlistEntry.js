import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {'WAITING' | 'OFFERED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'} WaitlistStatus
 * @typedef {'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'} TimeOfDayPreference
 */

const waitlistEntrySchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true }
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true
    },
    preferredStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
      index: true
    },
    // Desired date window
    preferredDateRange: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true }
    },
    timeOfDayPreference: {
      type: String,
      enum: ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'],
      default: 'ANY'
    },
    // Flexible days expands preferredDateRange by +/- N days
    flexibleDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 7
    },
    status: {
      type: String,
      enum: ['WAITING', 'OFFERED', 'CONFIRMED', 'EXPIRED', 'CANCELLED'],
      default: 'WAITING',
      index: true
    },
    offersCount: {
      type: Number,
      default: 0
    },
    lastOfferedAt: {
      type: Date
    },
    notes: {
      type: String
    },
    priorityScore: {
      type: Number,
      default: 100 // baseline score, can be weighted by membership / wait duration
    }
  },
  {
    timestamps: true
  }
);

// Compound index for deterministic recovery candidate matching
waitlistEntrySchema.index({
  businessId: 1,
  serviceId: 1,
  status: 1,
  priorityScore: -1,
  createdAt: 1
});

export const WaitlistEntry = mongoose.model('WaitlistEntry', waitlistEntrySchema);
