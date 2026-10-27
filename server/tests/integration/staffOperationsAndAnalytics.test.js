import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Business } from '../../src/models/Business.js';
import { Membership } from '../../src/models/Membership.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { Booking } from '../../src/models/Booking.js';
import { computeBusinessAnalytics } from '../../src/services/analytics.service.js';

describe('Staff Operations & Business Analytics Tests (JavaScript ESM)', () => {
  let app;
  let testUser;
  let testBusiness;
  let testService;
  let testStaff;
  let authCookie;

  beforeEach(async () => {
    app = createApp();

    // Register user through auth endpoint to establish authentic session
    const userEmail = `ops-${Date.now()}-${Math.random().toString(36).substring(7)}@slotflow.io`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Operations Manager',
        email: userEmail,
        password: 'Password123!'
      });
    authCookie = regRes.headers['set-cookie'];
    testUser = await User.findOne({ email: userEmail });

    testBusiness = await Business.create({
      name: 'Analytics & Ops Lounge',
      slug: `ops-lounge-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timezone: 'UTC',
      currency: 'USD'
    });

    await Membership.create({
      userId: testUser._id,
      businessId: testBusiness._id,
      role: 'OWNER'
    });

    testStaff = await Staff.create({
      businessId: testBusiness._id,
      displayName: 'Staff Stylist',
      email: 'stylist@lounge.com',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] },
        { dayOfWeek: 2, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] },
        { dayOfWeek: 3, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] },
        { dayOfWeek: 4, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] },
        { dayOfWeek: 5, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] }
      ]
    });

    testService = await Service.create({
      businessId: testBusiness._id,
      name: 'Deluxe Service',
      durationMinutes: 60,
      bufferBefore: 0,
      bufferAfter: 0,
      price: 150,
      qualifiedStaffIds: [testStaff._id]
    });
  });

  it('enforces appointment lifecycle state machine transitions with timestamps', async () => {
    // Create confirmed booking
    const booking = await Booking.create({
      businessId: testBusiness._id,
      serviceId: testService._id,
      staffId: testStaff._id,
      customer: {
        name: 'John Wick',
        email: 'john@continental.com',
        phone: '+15554321000'
      },
      startTimeUtc: new Date(),
      endTimeUtc: new Date(Date.now() + 3600000),
      status: 'CONFIRMED',
      source: 'PUBLIC',
      priceSnapshot: 150,
      durationMinutesSnapshot: 60,
      bufferBeforeSnapshot: 0,
      bufferAfterSnapshot: 0,
      reservationCellCountSnapshot: 4,
      manageTokenHash: 'mock_token_hash',
      manageTokenExpiresAt: new Date(Date.now() + 86400000)
    });

    // 1. Illegal transition: CONFIRMED -> COMPLETED directly should fail with 400
    const illegalRes = await request(app)
      .patch(`/api/v1/bookings/${booking._id}/status`)
      .set('Cookie', authCookie)
      .set('x-business-id', testBusiness._id.toString())
      .send({ status: 'COMPLETED' });

    expect(illegalRes.status).toBe(400);
    expect(illegalRes.body.success).toBe(false);

    // 2. Legal transition: CONFIRMED -> CHECKED_IN
    const checkInRes = await request(app)
      .patch(`/api/v1/bookings/${booking._id}/status`)
      .set('Cookie', authCookie)
      .set('x-business-id', testBusiness._id.toString())
      .send({ status: 'CHECKED_IN' });

    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.data.booking.status).toBe('CHECKED_IN');
    expect(checkInRes.body.data.booking.checkedInAtUtc).toBeDefined();

    // 3. Legal transition: CHECKED_IN -> IN_SERVICE
    const inServiceRes = await request(app)
      .patch(`/api/v1/bookings/${booking._id}/status`)
      .set('Cookie', authCookie)
      .set('x-business-id', testBusiness._id.toString())
      .send({ status: 'IN_SERVICE' });

    expect(inServiceRes.status).toBe(200);
    expect(inServiceRes.body.data.booking.status).toBe('IN_SERVICE');
    expect(inServiceRes.body.data.booking.serviceStartedAtUtc).toBeDefined();

    // 4. Legal transition: IN_SERVICE -> COMPLETED
    const completeRes = await request(app)
      .patch(`/api/v1/bookings/${booking._id}/status`)
      .set('Cookie', authCookie)
      .set('x-business-id', testBusiness._id.toString())
      .send({ status: 'COMPLETED' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.booking.status).toBe('COMPLETED');
    expect(completeRes.body.data.booking.completedAtUtc).toBeDefined();
  });

  it('computes accurate MongoDB aggregation analytics for revenue, utilization, and recovery', async () => {
    // Seed 1 public completed booking ($150)
    await Booking.create({
      businessId: testBusiness._id,
      serviceId: testService._id,
      staffId: testStaff._id,
      customer: { name: 'Alice', email: 'alice@example.com', phone: '111' },
      startTimeUtc: new Date(),
      endTimeUtc: new Date(Date.now() + 3600000),
      status: 'COMPLETED',
      source: 'PUBLIC',
      priceSnapshot: 150,
      durationMinutesSnapshot: 60,
      bufferBeforeSnapshot: 0,
      bufferAfterSnapshot: 0,
      reservationCellCountSnapshot: 4,
      manageTokenHash: 'h1',
      manageTokenExpiresAt: new Date(Date.now() + 86400000)
    });

    // Seed 1 recovered booking from waitlist ($150)
    await Booking.create({
      businessId: testBusiness._id,
      serviceId: testService._id,
      staffId: testStaff._id,
      customer: { name: 'Bob', email: 'bob@example.com', phone: '222' },
      startTimeUtc: new Date(),
      endTimeUtc: new Date(Date.now() + 3600000),
      status: 'COMPLETED',
      source: 'WAITLIST_RECOVERY',
      priceSnapshot: 150,
      durationMinutesSnapshot: 60,
      bufferBeforeSnapshot: 0,
      bufferAfterSnapshot: 0,
      reservationCellCountSnapshot: 4,
      manageTokenHash: 'h2',
      manageTokenExpiresAt: new Date(Date.now() + 86400000)
    });

    // Seed 1 cancelled booking ($150)
    await Booking.create({
      businessId: testBusiness._id,
      serviceId: testService._id,
      staffId: testStaff._id,
      customer: { name: 'Charlie', email: 'charlie@example.com', phone: '333' },
      startTimeUtc: new Date(),
      endTimeUtc: new Date(Date.now() + 3600000),
      status: 'CANCELLED',
      source: 'PUBLIC',
      priceSnapshot: 150,
      durationMinutesSnapshot: 60,
      bufferBeforeSnapshot: 0,
      bufferAfterSnapshot: 0,
      reservationCellCountSnapshot: 4,
      manageTokenHash: 'h3',
      manageTokenExpiresAt: new Date(Date.now() + 86400000)
    });

    const analytics = await computeBusinessAnalytics({ businessId: testBusiness._id });

    expect(analytics.metrics.totalBookings).toBe(3);
    expect(analytics.metrics.completedBookings).toBe(2);
    expect(analytics.metrics.cancelledBookings).toBe(1);
    expect(analytics.metrics.totalRevenue).toBe(300);
    expect(analytics.metrics.recoveredRevenue).toBe(150);
    expect(analytics.metrics.recoveredBookingsCount).toBe(1);
    expect(analytics.metrics.cancellationRate).toBe(33.3);
    expect(analytics.metrics.capacityUtilizationPercentage).toBeGreaterThan(0);
  });
});
