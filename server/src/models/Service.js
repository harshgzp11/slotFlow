import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {Object} Service
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {import('mongoose').Types.ObjectId} businessId
 * @property {string} name
 * @property {string} [description]
 * @property {number} durationMinutes
 * @property {number} bufferBefore
 * @property {number} bufferAfter
 * @property {number} price
 * @property {import('mongoose').Types.ObjectId[]} qualifiedStaffIds
 * @property {boolean} isActive
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

const serviceSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
      validate: {
        validator: (v) => v % 15 === 0,
        message: 'durationMinutes must be a multiple of 15'
      }
    },
    bufferBefore: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: (v) => v % 15 === 0,
        message: 'bufferBefore must be a multiple of 15'
      }
    },
    bufferAfter: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: (v) => v % 15 === 0,
        message: 'bufferAfter must be a multiple of 15'
      }
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    qualifiedStaffIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Staff'
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

serviceSchema.index({ businessId: 1, name: 1 });

export const Service = mongoose.model('Service', serviceSchema);
