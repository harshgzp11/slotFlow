import mongoose, { Document, Schema, Types } from 'mongoose';

export type RecoveryJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'NO_CANDIDATES' | 'FAILED';

export interface IVacatedInterval {
  staffId: Types.ObjectId;
  serviceId: Types.ObjectId;
  startTimeUtc: Date;
  endTimeUtc: Date;
  vacatedDurationMinutes: number;
}

export interface IRecoveryJob extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  bookingId: Types.ObjectId;
  vacatedInterval: IVacatedInterval;
  status: RecoveryJobStatus;
  leaseToken?: string;
  lockedUntil?: Date | null;
  lockedByWorkerId?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const vacatedIntervalSchema = new Schema<IVacatedInterval>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    startTimeUtc: { type: Date, required: true },
    endTimeUtc: { type: Date, required: true },
    vacatedDurationMinutes: { type: Number, required: true }
  },
  { _id: false }
);

const recoveryJobSchema = new Schema<IRecoveryJob>(
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

export const RecoveryJob = mongoose.model<IRecoveryJob>('RecoveryJob', recoveryJobSchema);
