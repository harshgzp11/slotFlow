import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {'CONFIRMED' | 'CHECKED_IN' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'} BookingStatus
 * @typedef {'PUBLIC' | 'STAFF' | 'WALK_IN' | 'WAITLIST_RECOVERY'} BookingSource
 */

const customerDetailsSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true
    },
    customer: {
      type: customerDetailsSchema,
      required: true
    },
    startTimeUtc: {
      type: Date,
      required: true,
      index: true
    },
    endTimeUtc: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'CONFIRMED',
      index: true
    },
    source: {
      type: String,
      enum: ['PUBLIC', 'STAFF', 'WALK_IN', 'WAITLIST_RECOVERY'],
      default: 'PUBLIC'
    },
    priceSnapshot: {
      type: Number,
      required: true,
      min: 0
    },

    // Immutable snapshots protecting against mutable service configurations
    durationMinutesSnapshot: {
      type: Number,
      required: true
    },
    bufferBeforeSnapshot: {
      type: Number,
      required: true,
      default: 0
    },
    bufferAfterSnapshot: {
      type: Number,
      required: true,
      default: 0
    },
    reservationCellCountSnapshot: {
      type: Number,
      required: true
    },

    manageTokenHash: {
      type: String,
      required: true,
      index: true
    },
    manageTokenExpiresAt: {
      type: Date,
      required: true
    },

    cancellationReason: {
      type: String
    },
    cancelledAtUtc: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

bookingSchema.index({ businessId: 1, startTimeUtc: 1, status: 1 });
bookingSchema.index({ businessId: 1, 'customer.email': 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
