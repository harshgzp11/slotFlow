import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Booking } from '../../src/models/Booking.js';
import { SlotReservation } from '../../src/models/SlotReservation.js';
import { Service } from '../../src/models/Service.js';

describe('Booking & Concurrency Conflict Tests (JavaScript ESM)', () => {
  const app = createApp();

  it('handles simultaneous booking requests atomically: exactly 1 succeeds and 1 conflicts with 409', async () => {
    // 1. Setup Owner, Business, Service, Staff
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Studio Manager',
      email: 'manager@studio.com',
      password: 'Password123!'
    });
    const cookie = userRes.headers['set-cookie'];

    const bizRes = await request(app).post('/api/v1/businesses').set('Cookie', cookie).send({
      name: 'Precision Barbershop',
      slug: 'precision-barbershop',
      timezone: 'UTC'
    });
    const businessId = bizRes.body.data.business._id;

    const staffRes = await request(app).post('/api/v1/staff').set('Cookie', cookie).set('x-business-id', businessId).send({
      displayName: 'Master Barber Alex',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [] }
      ]
    });
    const staffId = staffRes.body.data.staff._id;

    const serviceRes = await request(app).post('/api/v1/services').set('Cookie', cookie).set('x-business-id', businessId).send({
      name: 'Fade & Beard Trim',
      durationMinutes: 30,
      bufferBefore: 15,
      bufferAfter: 15,
      price: 45,
      qualifiedStaffIds: [staffId]
    });
    const serviceId = serviceRes.body.data.service._id;

    const slotTimeUtc = '2026-11-02T14:00:00.000Z'; // Monday

    // 2. Fire 2 parallel booking requests for the exact same slot
    const [res1, res2] = await Promise.all([
      request(app).post('/api/v1/public/bookings').send({
        slug: 'precision-barbershop',
        serviceId,
        staffId,
        startTimeUtc: slotTimeUtc,
        customer: { name: 'Customer A', email: 'customera@test.com', phone: '1234567890' }
      }),
      request(app).post('/api/v1/public/bookings').send({
        slug: 'precision-barbershop',
        serviceId,
        staffId,
        startTimeUtc: slotTimeUtc,
        customer: { name: 'Customer B', email: 'customerb@test.com', phone: '0987654321' }
      })
    ]);

    // Assert API outcomes: exactly 1 Created (201) and 1 Conflict (409)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Assert Database state: exactly 1 booking persisted
    const bookings = await Booking.find({ businessId, startTimeUtc: new Date(slotTimeUtc) });
    expect(bookings.length).toBe(1);

    const confirmedBooking = bookings[0];
    expect(confirmedBooking.status).toBe('CONFIRMED');

    // Total duration: 15m bufferBefore + 30m duration + 15m bufferAfter = 60m = 4 cells of 15m
    expect(confirmedBooking.durationMinutesSnapshot).toBe(30);
    expect(confirmedBooking.bufferBeforeSnapshot).toBe(15);
    expect(confirmedBooking.bufferAfterSnapshot).toBe(15);
    expect(confirmedBooking.reservationCellCountSnapshot).toBe(4);

    // Assert SlotReservation cells: exactly 4 discrete cells reserved under compound unique index
    const cells = await SlotReservation.find({ bookingId: confirmedBooking._id });
    expect(cells.length).toBe(4);
    expect(cells.every((c) => c.reservationType === 'BOOKING')).toBe(true);

    // 3. Test Zero-Gap Cancellation with Snapshot Protection:
    // Even if service configuration changes later, cancellation uses immutable snapshot!
    await Service.findByIdAndUpdate(serviceId, { durationMinutes: 60, bufferBefore: 30 }); // mutates service

    const cancelRes = await request(app)
      .post(`/api/v1/public/bookings/${confirmedBooking._id}/cancel`)
      .send({
        token: (res1.status === 201 ? res1.body.data.manageToken : res2.body.data.manageToken),
        reason: 'Customer schedule conflict'
      });

    expect(cancelRes.status).toBe(200);

    // Verify booking marked CANCELLED
    const cancelledBooking = await Booking.findById(confirmedBooking._id);
    expect(cancelledBooking?.status).toBe('CANCELLED');

    // Verify cells converted to RECOVERY_PENDING hold
    const heldCells = await SlotReservation.find({ recoveryJobId: { $exists: true } });
    expect(heldCells.length).toBe(4);
    expect(heldCells.every((c) => c.reservationType === 'HOLD' && c.holdType === 'RECOVERY_PENDING')).toBe(true);
  });
});
