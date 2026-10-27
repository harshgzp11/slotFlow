import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {'BOOKING' | 'HOLD'} ReservationType
 * @typedef {'RECOVERY_PENDING' | 'OFFER'} HoldType
 */

const slotReservationSchema = new Schema(
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

// Compound Unique Index: Prevents double-booking across any 15-minute reservation cell
slotReservationSchema.index(
  { businessId: 1, staffId: 1, slotStartTimeUtc: 1 },
  { unique: true }
);

export const SlotReservation = mongoose.model('SlotReservation', slotReservationSchema);
