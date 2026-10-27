import mongoose, { Document, Schema, Types } from 'mongoose';

export type ReservationType = 'BOOKING' | 'HOLD';
export type HoldType = 'RECOVERY_PENDING' | 'OFFER';

export interface ISlotReservation extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  staffId: Types.ObjectId;
  slotStartTimeUtc: Date;
  reservationType: ReservationType;
  holdType?: HoldType;
  bookingId?: Types.ObjectId;
  holdOfferId?: Types.ObjectId;
  recoveryJobId?: Types.ObjectId;
  holdExpiresAtUtc?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const slotReservationSchema = new Schema<ISlotReservation>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true
    },
    slotStartTimeUtc: {
      type: Date,
      required: true
    },
    reservationType: {
      type: String,
      enum: ['BOOKING', 'HOLD'],
      required: true
    },
    holdType: {
      type: String,
      enum: ['RECOVERY_PENDING', 'OFFER']
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking'
    },
    holdOfferId: {
      type: Schema.Types.ObjectId,
      ref: 'WaitlistOffer'
    },
    recoveryJobId: {
      type: Schema.Types.ObjectId,
      ref: 'RecoveryJob'
    },
    holdExpiresAtUtc: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// COMPOUND UNIQUE INDEX: Prevents double-booking across any 15-minute reservation cell
slotReservationSchema.index(
  { businessId: 1, staffId: 1, slotStartTimeUtc: 1 },
  { unique: true }
);

export const SlotReservation = mongoose.model<ISlotReservation>(
  'SlotReservation',
  slotReservationSchema
);
