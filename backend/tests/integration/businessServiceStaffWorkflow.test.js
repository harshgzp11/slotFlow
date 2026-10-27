import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { Membership } from '../../src/models/Membership.js';
import {
  createTestBusiness,
  createTestStaff,
  createTestService,
  registerAndAuthenticateUser
} from '../fixtures/testData.js';

describe('Business, Service, and Staff Setup & Validation Workflow', () => {
  let app;
  let owner;
  let business;
  let qualifiedStaff;
  let unqualifiedStaff;
  let inactiveStaff;
  let validService;

  beforeEach(async () => {
    app = createApp();

    // 1. Authenticate owner
    owner = await registerAndAuthenticateUser(app);

    // 2. Create business configured with Asia/Kolkata timezone
    business = await createTestBusiness({
      name: 'Kolkata Wellness Studio',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      workingHours: [
        { dayOfWeek: 0, isOpen: false, openTime: '10:00', closeTime: '18:00' }, // Sunday closed
        { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '19:00' }
      ],
      bookingPolicies: {
        minNoticeHours: 1,
        maxHorizonDays: 30,
        cancelCutoffHours: 4
      }
    });

    await Membership.create({
      userId: owner.user._id,
      businessId: business._id,
      role: 'OWNER'
    });

    // 3. Create active qualified staff with shift & lunch break (13:00 - 14:00)
    qualifiedStaff = await createTestStaff(business._id, {
      displayName: 'Aarav Sharma',
      email: 'aarav@wellness.in',
      weeklySchedule: [
        { dayOfWeek: 0, isWorking: false, shiftStart: '09:00', shiftEnd: '19:00', breaks: [] },
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 2, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 3, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 4, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 5, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 6, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] }
      ],
      isActive: true
    });

    // 4. Create active unqualified staff
    unqualifiedStaff = await createTestStaff(business._id, {
      displayName: 'Priya Patel',
      email: 'priya@wellness.in',
      isActive: true
    });

    // 5. Create inactive staff member
    inactiveStaff = await createTestStaff(business._id, {
      displayName: 'Rohan Verma',
      email: 'rohan@wellness.in',
      isActive: false
    });

    // 6. Create valid service qualified only for Aarav
    validService = await createTestService(business._id, [qualifiedStaff._id], {
      name: 'Ayurvedic Therapy',
      durationMinutes: 45,
      bufferBefore: 15,
      bufferAfter: 15,
      price: 1500,
      isActive: true
    });
  });

  it('validates 15-minute slot multiples for service duration and buffers upon creation', async () => {
    // 1. Invalid duration (not multiple of 15)
    const badDurationRes = await request(app)
      .post('/api/v1/services')
      .set('Cookie', owner.cookie)
      .set('x-business-id', business._id.toString())
      .send({
        name: 'Invalid Duration Service',
        durationMinutes: 25,
        bufferBefore: 0,
        bufferAfter: 0,
        price: 500,
        qualifiedStaffIds: [qualifiedStaff._id.toString()]
      });

    expect(badDurationRes.status).toBe(400);
    expect(badDurationRes.body.success).toBe(false);
    expect(JSON.stringify(badDurationRes.body.error)).toMatch(/multiple of 15/i);

    // 2. Invalid bufferBefore (not multiple of 15)
    const badBufferBeforeRes = await request(app)
      .post('/api/v1/services')
      .set('Cookie', owner.cookie)
      .set('x-business-id', business._id.toString())
      .send({
        name: 'Invalid Buffer Service',
        durationMinutes: 30,
        bufferBefore: 10,
        bufferAfter: 0,
        price: 500,
        qualifiedStaffIds: [qualifiedStaff._id.toString()]
      });

    expect(badBufferBeforeRes.status).toBe(400);
    expect(badBufferBeforeRes.body.success).toBe(false);
    expect(JSON.stringify(badBufferBeforeRes.body.error)).toMatch(/multiple of 15/i);

    // 3. Valid service creation succeeds
    const validRes = await request(app)
      .post('/api/v1/services')
      .set('Cookie', owner.cookie)
      .set('x-business-id', business._id.toString())
      .send({
        name: 'Full Body Massage',
        durationMinutes: 60,
        bufferBefore: 15,
        bufferAfter: 15,
        price: 2000,
        qualifiedStaffIds: [qualifiedStaff._id.toString()]
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.data.service.durationMinutes).toBe(60);
    expect(validRes.body.data.service.bufferBefore).toBe(15);
    expect(validRes.body.data.service.bufferAfter).toBe(15);
  });

  it('correctly reads public business profile and service catalog with Asia/Kolkata timezone', async () => {
    const res = await request(app).get(`/api/v1/public/businesses/${business.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.business.timezone).toBe('Asia/Kolkata');
    expect(res.body.data.business.currency).toBe('INR');

    // Services list includes validService
    const serviceIds = res.body.data.services.map((s) => s._id.toString());
    expect(serviceIds).toContain(validService._id.toString());

    // Inactive staff is excluded or identified
    const activeStaffIds = res.body.data.staff.map((st) => st._id.toString());
    expect(activeStaffIds).toContain(qualifiedStaff._id.toString());
    expect(activeStaffIds).not.toContain(inactiveStaff._id.toString());
  });

  it('rejects booking when staff is inactive', async () => {
    // Attempt booking with inactiveStaff
    // 2026-11-02 is a Monday (working day). 10:00 AM IST = 04:30 AM UTC
    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: business.slug,
        serviceId: validService._id.toString(),
        staffId: inactiveStaff._id.toString(),
        startTimeUtc: '2026-11-02T04:30:00.000Z',
        customer: {
          name: 'Customer One',
          email: 'cust1@example.com',
          phone: '+919876543210'
        }
      });

    expect(bookingRes.status).toBe(404);
    expect(bookingRes.body.success).toBe(false);
    expect(bookingRes.body.error.message).toMatch(/Staff member not found or inactive/i);
  });

  it('rejects booking when staff is unqualified for the requested service', async () => {
    // Attempt booking validService with unqualifiedStaff
    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: business.slug,
        serviceId: validService._id.toString(),
        staffId: unqualifiedStaff._id.toString(),
        startTimeUtc: '2026-11-02T04:30:00.000Z',
        customer: {
          name: 'Customer Two',
          email: 'cust2@example.com',
          phone: '+919876543210'
        }
      });

    expect(bookingRes.status).toBe(400);
    expect(bookingRes.body.success).toBe(false);
    expect(bookingRes.body.error.message).toMatch(/not qualified for this service/i);
  });

  it('rejects booking during scheduled staff break in Asia/Kolkata timezone', async () => {
    // Staff break is 13:00 - 14:00 IST on Monday 2026-11-02.
    // In UTC: 13:00 IST minus 5 hours 30 mins = 07:30 UTC.
    // If appointment starts at 13:00 IST (07:30 UTC), it collides with break!
    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: business.slug,
        serviceId: validService._id.toString(),
        staffId: qualifiedStaff._id.toString(),
        startTimeUtc: '2026-11-02T07:30:00.000Z',
        customer: {
          name: 'Customer Break',
          email: 'custbreak@example.com',
          phone: '+919876543210'
        }
      });

    expect(bookingRes.status).toBe(400);
    expect(bookingRes.body.success).toBe(false);
    expect(bookingRes.body.error.message).toMatch(/conflict with a scheduled staff break/i);
  });

  it('rejects booking when business is closed on Sunday', async () => {
    // 2026-11-01 is a Sunday (business is closed).
    // 11:00 AM IST = 05:30 AM UTC
    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: business.slug,
        serviceId: validService._id.toString(),
        staffId: qualifiedStaff._id.toString(),
        startTimeUtc: '2026-11-01T05:30:00.000Z',
        customer: {
          name: 'Customer Sunday',
          email: 'custsun@example.com',
          phone: '+919876543210'
        }
      });

    expect(bookingRes.status).toBe(400);
    expect(bookingRes.body.success).toBe(false);
    expect(bookingRes.body.error.message).toMatch(/business is closed on the selected day/i);
  });

  it('rejects booking outside business operating hours', async () => {
    // Business closes at 19:00 IST (13:30 UTC).
    // Appointment at 20:00 IST (14:30 UTC) is outside business hours.
    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: business.slug,
        serviceId: validService._id.toString(),
        staffId: qualifiedStaff._id.toString(),
        startTimeUtc: '2026-11-02T14:30:00.000Z',
        customer: {
          name: 'Customer Late',
          email: 'custlate@example.com',
          phone: '+919876543210'
        }
      });

    expect(bookingRes.status).toBe(400);
    expect(bookingRes.body.success).toBe(false);
    expect(bookingRes.body.error.message).toMatch(/fall entirely within business operating hours/i);
  });

  it('successfully creates booking when staff is active, qualified, and time falls in valid shift outside break', async () => {
    // Monday 2026-11-02 at 10:00 AM IST = 04:30 AM UTC.
    // Duration: 45 min + 15 min bufferBefore + 15 min bufferAfter = 75 min (09:45 - 11:00 IST).
    // Valid shift (09:00 - 19:00 IST), outside lunch break (13:00 - 14:00 IST).
    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: business.slug,
        serviceId: validService._id.toString(),
        staffId: qualifiedStaff._id.toString(),
        startTimeUtc: '2026-11-02T04:30:00.000Z',
        customer: {
          name: 'Ramesh Gupta',
          email: 'ramesh@example.com',
          phone: '+919876543210'
        }
      });

    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body.success).toBe(true);
    expect(bookingRes.body.data.booking.status).toBe('CONFIRMED');
    expect(bookingRes.body.data.booking.customer.name).toBe('Ramesh Gupta');
    expect(bookingRes.body.data.booking.totalPrice).toBe(1500);
    expect(bookingRes.body.data.manageUrl).toBeDefined();
  });
});
