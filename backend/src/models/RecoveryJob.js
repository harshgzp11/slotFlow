import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {'PENDING' | 'PROCESSING' | 'COMPLETED' | 'NO_CANDIDATES' | 'FAILED'} RecoveryJobStatus
 */

const vacatedIntervalSchema = new Schema(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    startTimeUtc: { type: Date, required: true },
    endTimeUtc: { type: Date, required: true },
    vacatedDurationMinutes: { type: Number, required: true }
  },
  { _id: false }
);

const recoveryJobSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true // Guarantees idempotent cancellation handling: 1 job per booking
    },
    vacatedInterval: {
      type: vacatedIntervalSchema,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'NO_CANDIDATES', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    leaseToken: {
      type: String
    },
    lockedUntil: {
      type: Date,
      default: null,
      index: true
    },
    lockedByWorkerId: {
      type: String
    },
    retryCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

recoveryJobSchema.index({ status: 1, lockedUntil: 1 });

export const RecoveryJob = mongoose.model('RecoveryJob', recoveryJobSchema);
