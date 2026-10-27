import mongoose from 'mongoose';
import request from 'supertest';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { User } from '../../src/models/User.js';
import { Membership } from '../../src/models/Membership.js';

/**
 * Creates a unique test business with configurable timezone and operating hours
 */
export async function createTestBusiness(overrides = {}) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return await Business.create({
    name: `Test Business ${uniqueId}`,
    slug: `test-biz-${uniqueId}`,
    timezone: overrides.timezone || 'Asia/Kolkata',
    currency: overrides.currency || 'INR',
    workingHours: overrides.workingHours || [
      { dayOfWeek: 0, isOpen: false, openTime: '10:00', closeTime: '18:00' },
      { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '19:00' },
      { dayOfWeek: 6, isOpen: true, openTime: '10:00', closeTime: '18:00' }
    ],
    bookingPolicies: overrides.bookingPolicies || {
      minNoticeHours: 2,
      maxHorizonDays: 30,
      cancelCutoffHours: 4
    },
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides
  });
}

/**
 * Creates a test staff member with shift schedule and break
 */
export async function createTestStaff(businessId, overrides = {}) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return await Staff.create({
    businessId,
    displayName: overrides.displayName || `Staff Specialist ${uniqueId}`,
    email: overrides.email || `staff-${uniqueId}@example.com`,
    weeklySchedule: overrides.weeklySchedule || [
      { dayOfWeek: 0, isWorking: false, shiftStart: '09:00', shiftEnd: '18:00', breaks: [] },
      { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 2, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 3, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 4, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 5, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 6, isWorking: true, shiftStart: '10:00', shiftEnd: '17:00', breaks: [] }
    ],
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides
  });
}

/**
 * Creates a test service with duration, buffers, and qualified staff
 */
export async function createTestService(businessId, qualifiedStaffIds = [], overrides = {}) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return await Service.create({
    businessId,
    name: overrides.name || `Service ${uniqueId}`,
    durationMinutes: overrides.durationMinutes !== undefined ? overrides.durationMinutes : 30,
    bufferBefore: overrides.bufferBefore !== undefined ? overrides.bufferBefore : 15,
    bufferAfter: overrides.bufferAfter !== undefined ? overrides.bufferAfter : 15,
    price: overrides.price !== undefined ? overrides.price : 500,
    qualifiedStaffIds,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides
  });
}

/**
 * Registers a user and returns { user, cookie, authHeader }
 */
export async function registerAndAuthenticateUser(app, overrides = {}) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const email = overrides.email || `user-${uniqueId}@example.com`;
  const password = overrides.password || 'StrongPassword123!';
  const name = overrides.name || `Test User ${uniqueId}`;

  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password });

  const cookie = res.headers['set-cookie'];
  const user = await User.findOne({ email });

  return { user, cookie, email, password };
}
