import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'} OfferStatus
 */

const waitlistOfferSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    waitlistEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'WaitlistEntry',
      required: true,
      index: true
    },
    recoveryJobId: {
      type: Schema.Types.ObjectId,
      ref: 'RecoveryJob',
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
      required: true
    },
    offeredInterval: {
      startTimeUtc: { type: Date, required: true },
      endTimeUtc: { type: Date, required: true },
      durationMinutes: { type: Number, required: true },
      reservationCellCount: { type: Number, required: true }
    },
    claimTokenHash: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
      default: 'PENDING',
      index: true
    },
    holdSlotReservationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SlotReservation'
      }
    ],
    responseReceivedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

waitlistOfferSchema.index({ businessId: 1, status: 1, expiresAt: 1 });

export const WaitlistOffer = mongoose.model('WaitlistOffer', waitlistOfferSchema);
