import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IService extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  name: string;
  description?: string;
  durationMinutes: number; // Multiple of 15 (e.g. 15, 30, 45, 60, 90)
  bufferBefore: number;    // Multiple of 15 (default 0)
  bufferAfter: number;     // Multiple of 15 (default 0)
  price: number;
  qualifiedStaffIds: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
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
        validator: (v: number) => v % 15 === 0,
        message: 'durationMinutes must be a multiple of 15'
      }
    },
    bufferBefore: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: (v: number) => v % 15 === 0,
        message: 'bufferBefore must be a multiple of 15'
      }
    },
    bufferAfter: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: (v: number) => v % 15 === 0,
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

export const Service = mongoose.model<IService>('Service', serviceSchema);
