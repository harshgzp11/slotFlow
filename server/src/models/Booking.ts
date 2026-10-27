import mongoose, { Document, Schema, Types } from 'mongoose';

export type BookingStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type BookingSource = 'PUBLIC' | 'STAFF' | 'WALK_IN' | 'WAITLIST_RECOVERY';

export interface ICustomerDetails {
  name: string;
  email: string;
  phone: string;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  serviceId: Types.ObjectId;
  staffId: Types.ObjectId;
  customer: ICustomerDetails;
  startTimeUtc: Date;
  endTimeUtc: Date;
  status: BookingStatus;
  source: BookingSource;
  priceSnapshot: number;

  // Immutable snapshots taken at creation time
  durationMinutesSnapshot: number;
  bufferBeforeSnapshot: number;
  bufferAfterSnapshot: number;
  reservationCellCountSnapshot: number;

  // Guest Management Security
  manageTokenHash: string; // SHA-256 hash of raw manage token
  manageTokenExpiresAt: Date;

  // Cancellation Audit
  cancellationReason?: string;
  cancelledAtUtc?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const customerDetailsSchema = new Schema<ICustomerDetails>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const bookingSchema = new Schema<IBooking>(
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

    // Snapshots protecting against mutable service configurations
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

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
