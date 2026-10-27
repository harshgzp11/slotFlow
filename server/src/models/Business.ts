import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWorkingHour {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isOpen: boolean;
  openTime: string;  // "HH:mm", e.g. "09:00"
  closeTime: string; // "HH:mm", e.g. "18:00"
}

export interface IBookingPolicies {
  minNoticeHours: number;    // e.g. 2 hours
  maxHorizonDays: number;    // e.g. 30 days
  cancelCutoffHours: number; // e.g. 4 hours
}

export interface IBusiness extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  timezone: string;
  currency: string;
  workingHours: IWorkingHour[];
  bookingPolicies: IBookingPolicies;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workingHourSchema = new Schema<IWorkingHour>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, default: '09:00' },
    closeTime: { type: String, default: '18:00' }
  },
  { _id: false }
);

const bookingPoliciesSchema = new Schema<IBookingPolicies>(
  {
    minNoticeHours: { type: Number, default: 2, min: 0 },
    maxHorizonDays: { type: Number, default: 30, min: 1 },
    cancelCutoffHours: { type: Number, default: 4, min: 0 }
  },
  { _id: false }
);

const businessSchema = new Schema<IBusiness>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    timezone: {
      type: String,
      required: true,
      default: 'UTC'
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true
    },
    workingHours: {
      type: [workingHourSchema],
      default: () => [
        { dayOfWeek: 0, isOpen: false, openTime: '10:00', closeTime: '16:00' }, // Sun closed
        { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayOfWeek: 6, isOpen: true, openTime: '10:00', closeTime: '16:00' }
      ]
    },
    bookingPolicies: {
      type: bookingPoliciesSchema,
      default: () => ({
        minNoticeHours: 2,
        maxHorizonDays: 30,
        cancelCutoffHours: 4
      })
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

export const Business = mongoose.model<IBusiness>('Business', businessSchema);
