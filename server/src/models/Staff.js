import mongoose, { Schema } from 'mongoose';

const breakSchema = new Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  { _id: false }
);

const dayScheduleSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isWorking: { type: Boolean, default: true },
    shiftStart: { type: String, default: '09:00' },
    shiftEnd: { type: String, default: '17:00' },
    breaks: { type: [breakSchema], default: [] }
  },
  { _id: false }
);

const staffSchema = new Schema(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    servicesOffered: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Service'
      }
    ],
    weeklySchedule: {
      type: [dayScheduleSchema],
      default: () => [
        { dayOfWeek: 0, isWorking: false, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] },
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 2, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 3, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 4, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 5, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 6, isWorking: false, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] }
      ]
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

staffSchema.index({ businessId: 1, displayName: 1 });

export const Staff = mongoose.model('Staff', staffSchema);
