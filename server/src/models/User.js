import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {Object} User
 * @property {import('mongoose').Types.ObjectId} _id
 * @property {string} name
 * @property {string} email
 * @property {string} passwordHash
 * @property {'USER' | 'ADMIN'} systemRole
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    systemRole: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER'
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model('User', userSchema);
