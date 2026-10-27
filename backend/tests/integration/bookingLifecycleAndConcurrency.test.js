import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { Booking } from '../../src/models/Booking.js';
import { SlotReservation } from '../../src/models/SlotReservation.js';
import {
  createTestBusiness,
  createTestStaff,
  createTestService
} from '../fixtures/testData.js';

describe('Availability, Booking Lifecycle, and Concurrency Integration Tests', () => {
  let app;
  let testBusiness;
  let testStaff;
  let testService;

  beforeEach(async () => {
    app = createApp();

    // Business in Asia/Kolkata timezone with 9:00 - 19:00 IST open hours
    testBusiness = await createTestBusiness({
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      workingHours: [
        { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '19:00' },
        { dayOfWeek: 0, isOpen: false, openTime: '10:00', closeTime: '18:00' }
      ],
      bookingPolicies: {
        minNoticeHours: 1,
        maxHorizonDays: 60,
        cancelCutoffHours: 2
      }
    });

    // Staff working 9:00 - 19:00 IST with break 13:00 - 14:00 IST
    testStaff = await createTestStaff(testBusiness._id, {
      displayName: 'Vikram Singh',
      email: 'vikram@salon.in',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 2, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 3, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 4, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 5, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 6, isWorking: true, shiftStart: '09:00', shiftEnd: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
        { dayOfWeek: 0, isWorking: false, shiftStart: '09:00', shiftEnd: '19:00', breaks: [] }
      ]
    });

    // Service: 30m duration + 15m bufferBefore + 15m bufferAfter = 60m (4 cells of 15m)
    testService = await createTestService(testBusiness._id, [testStaff._id], {
      name: 'Haircut & Beard Styling',
      durationMinutes: 30,
      bufferBefore: 15,
      bufferAfter: 15,
      price: 600
    });
  });

  it('correctly calculates available slots accounting for duration, buffers, and breaks', async () => {
    // 2026-11-09 is a Monday. Query slots for this date.
    const res = await request(app)
      .get('/api/v1/public/availability')
      .query({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        date: '2026-11-09'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const slots = res.body.data.slots;
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);

    // Verify slots do NOT overlap staff break (13:00 - 14:00 IST = 07:30 - 08:30 UTC)
    for (const slot of slots) {
      const slotTimeUtc = new Date(slot.startTimeUtc);
      const minutesUtc = slotTimeUtc.getUTCHours() * 60 + slotTimeUtc.getUTCMinutes();
      const breakStartUtcMinutes = 7 * 60 + 30; // 07:30 UTC
      const breakEndUtcMinutes = 8 * 60 + 30;   // 08:30 UTC

      // Slot with buffers: bufferBefore is 15m, duration is 30m, bufferAfter is 15m
      const blockStart = minutesUtc - 15;
      const blockEnd = minutesUtc + 30 + 15;

      const collides = Math.max(blockStart, breakStartUtcMinutes) < Math.min(blockEnd, breakEndUtcMinutes);
      expect(collides, `Slot ${slot.startTimeUtc} collides with staff break`).toBe(false);
    }
  });

  it('persists booking in database with immutable snapshots and exact reservation cells', async () => {
    // Monday 2026-11-09 at 10:00 AM IST = 04:30 AM UTC
    const startTimeUtc = '2026-11-09T04:30:00.000Z';

    const res = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc,
        customer: {
          name: 'Arjun Rampal',
          email: 'arjun@bollywood.in',
          phone: '+919876543210'
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const bookingData = res.body.data.booking;
    expect(bookingData.status).toBe('CONFIRMED');
    expect(bookingData.customer.name).toBe('Arjun Rampal');
    expect(res.body.data.manageToken).toBeDefined();

    // DATABASE ASSERTIONS
    // 1. Verify Booking document
    const persistedBooking = await Booking.findById(bookingData._id);
    expect(persistedBooking).not.toBeNull();
    expect(persistedBooking.status).toBe('CONFIRMED');
    expect(persistedBooking.priceSnapshot).toBe(600);
    expect(persistedBooking.durationMinutesSnapshot).toBe(30);
    expect(persistedBooking.bufferBeforeSnapshot).toBe(15);
    expect(persistedBooking.bufferAfterSnapshot).toBe(15);
    expect(persistedBooking.reservationCellCountSnapshot).toBe(4);
    expect(persistedBooking.manageTokenHash).toBeDefined();

    // 2. Verify discrete 15-minute SlotReservation cells
    const reservations = await SlotReservation.find({ bookingId: persistedBooking._id });
    // Total block = 15m bufferBefore + 30m duration + 15m bufferAfter = 60m -> 4 cells of 15m
    expect(reservations).toHaveLength(4);
    for (const r of reservations) {
      expect(r.reservationType).toBe('BOOKING');
      expect(r.staffId.toString()).toBe(testStaff._id.toString());
      expect(r.businessId.toString()).toBe(testBusiness._id.toString());
    }

    // Reservation cells should span:
    // Cell 0: 04:15 UTC (bufferBefore)
    // Cell 1: 04:30 UTC (appointment start)
    // Cell 2: 04:45 UTC (appointment mid)
    // Cell 3: 05:00 UTC (bufferAfter, appointment ends at 05:00)
    const cellTimes = reservations.map((r) => r.slotStartTimeUtc.toISOString()).sort();
    expect(cellTimes).toEqual([
      '2026-11-09T04:15:00.000Z',
      '2026-11-09T04:30:00.000Z',
      '2026-11-09T04:45:00.000Z',
      '2026-11-09T05:00:00.000Z'
    ]);
  });

  it('rejects booking attempts that violate 15-minute alignment, advance notice, or conflict with existing booking', async () => {
    // 1. Unaligned time (e.g. 04:37 UTC instead of :00, :15, :30, :45)
    const unalignedRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: '2026-11-09T04:37:00.000Z',
        customer: {
          name: 'Unaligned Cust',
          email: 'unaligned@example.com',
          phone: '+919876543210'
        }
      });

    expect(unalignedRes.status).toBe(400);
    expect(unalignedRes.body.error.message).toMatch(/15-minute slot boundary/i);

    // 2. Past appointment time / violates advance notice policy
    const pastRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: '2020-01-01T04:30:00.000Z',
        customer: {
          name: 'Past Cust',
          email: 'past@example.com',
          phone: '+919876543210'
        }
      });

    expect(pastRes.status).toBe(400);
    expect(pastRes.body.error.message).toMatch(/advance notice policy/i);

    // 3. Conflict: first booking succeeds, overlapping second booking fails
    const slotTimeUtc = '2026-11-09T05:30:00.000Z';
    const firstRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: slotTimeUtc,
        customer: {
          name: 'First Booker',
          email: 'first@example.com',
          phone: '+919876543210'
        }
      });
    expect(firstRes.status).toBe(201);

    // Competing attempt for the same slot
    const conflictRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: slotTimeUtc,
        customer: {
          name: 'Second Booker',
          email: 'second@example.com',
          phone: '+919876543210'
        }
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.message).toMatch(/no longer available/i);
  });

  it('allows rescheduling via guest management token and updates database cells atomically', async () => {
    // Initial booking at 06:30 UTC
    const initialSlot = '2026-11-09T06:30:00.000Z';
    const bookRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: initialSlot,
        customer: {
          name: 'Deepak Chopra',
          email: 'deepak@wellness.in',
          phone: '+919876543210'
        }
      });

    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.data.booking._id;
    const rawManageToken = bookRes.body.data.manageToken;

    // View manage booking
    const manageRes = await request(app)
      .get(`/api/v1/public/bookings/${bookingId}/manage`)
      .query({ token: rawManageToken });

    expect(manageRes.status).toBe(200);
    expect(manageRes.body.data.booking.customer.name).toBe('Deepak Chopra');

    // Reschedule to 09:00 UTC (14:30 IST, well clear of 13:00-14:00 IST break)
    const newSlot = '2026-11-09T09:00:00.000Z';
    const rescheduleRes = await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/reschedule`)
      .send({
        token: rawManageToken,
        newStartTimeUtc: newSlot
      });

    expect(rescheduleRes.status).toBe(200);
    expect(rescheduleRes.body.success).toBe(true);

    // Verify DB update
    const updatedBooking = await Booking.findById(bookingId);
    expect(updatedBooking.startTimeUtc.toISOString()).toBe(newSlot);

    // Verify old reservation cells are removed and new reservation cells exist
    const updatedReservations = await SlotReservation.find({ bookingId });
    expect(updatedReservations).toHaveLength(4);
    const newCellTimes = updatedReservations.map((r) => r.slotStartTimeUtc.toISOString()).sort();
    // 09:00 - 15m bufferBefore = 08:45 UTC
    expect(newCellTimes[0]).toBe('2026-11-09T08:45:00.000Z');
    expect(newCellTimes[1]).toBe('2026-11-09T09:00:00.000Z');
  });

  it('handles 5 concurrent booking requests atomically: exactly 1 succeeds and 4 receive 409 Conflict', async () => {
    // Shared contention slot: Monday 2026-11-09 at 10:30 UTC
    const contentionSlotUtc = '2026-11-09T10:30:00.000Z';

    const requests = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/v1/public/bookings')
        .send({
          slug: testBusiness.slug,
          serviceId: testService._id.toString(),
          staffId: testStaff._id.toString(),
          startTimeUtc: contentionSlotUtc,
          customer: {
            name: `Contender ${i + 1}`,
            email: `contender${i + 1}@race.com`,
            phone: `+91987654321${i}`
          }
        })
    );

    const responses = await Promise.all(requests);

    const successResponses = responses.filter((r) => r.status === 201);
    const conflictResponses = responses.filter((r) => r.status === 409);

    expect(successResponses).toHaveLength(1);
    expect(conflictResponses).toHaveLength(4);

    for (const conf of conflictResponses) {
      expect(conf.body.success).toBe(false);
      expect(conf.body.error.message).toMatch(/no longer available/i);
    }

    // STRICT DATABASE ASSERTIONS
    // 1. Exactly 1 confirmed booking exists for this slot
    const bookingsInDb = await Booking.find({
      businessId: testBusiness._id,
      staffId: testStaff._id,
      startTimeUtc: new Date(contentionSlotUtc),
      status: 'CONFIRMED'
    });
    expect(bookingsInDb).toHaveLength(1);

    // 2. Exactly 4 reservation cells exist for this block (no duplicate or phantom cells)
    const winningBookingId = bookingsInDb[0]._id;
    const reservedCells = await SlotReservation.find({
      businessId: testBusiness._id,
      staffId: testStaff._id,
      bookingId: winningBookingId
    });
    expect(reservedCells).toHaveLength(4);
  });
});
