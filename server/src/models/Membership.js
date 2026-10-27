import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {'OWNER' | 'MANAGER' | 'STAFF'} MembershipRole
 * @typedef {Object} Membership
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {import('mongoose').Types.ObjectId} userId
 * @property {import('mongoose').Types.ObjectId} businessId
 * @property {MembershipRole} role
 * @property {boolean} isActive
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

const membershipSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['OWNER', 'MANAGER', 'STAFF'],
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index: A user has at most one membership per business
membershipSchema.index({ userId: 1, businessId: 1 }, { unique: true });

export const Membership = mongoose.model('Membership', membershipSchema);
