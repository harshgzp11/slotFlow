import mongoose, { Document, Schema, Types } from 'mongoose';

export type MembershipRole = 'OWNER' | 'MANAGER' | 'STAFF';

export interface IMembership extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  businessId: Types.ObjectId;
  role: MembershipRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
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

export const Membership = mongoose.model<IMembership>('Membership', membershipSchema);
