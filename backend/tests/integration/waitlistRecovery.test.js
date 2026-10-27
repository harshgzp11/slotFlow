import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { Booking } from '../../src/models/Booking.js';
import { SlotReservation } from '../../src/models/SlotReservation.js';
import { RecoveryJob } from '../../src/models/RecoveryJob.js';
import { WaitlistEntry } from '../../src/models/WaitlistEntry.js';
import { WaitlistOffer } from '../../src/models/WaitlistOffer.js';
import {
  claimRecoveryJob,
  processClaimedRecoveryJob,
  acceptWaitlistOffer,
  declineWaitlistOffer
} from '../../src/services/recovery.service.js';

describe('Waitlist & Smart Cancellation Recovery Engine Tests (JavaScript ESM)', () => {
  let app;
  let testBusiness;
  let testService;
  let testStaff;

  beforeEach(async () => {
    app = createApp();

    testBusiness = await Business.create({
      name: 'Recovery Studio',
      slug: `recovery-studio-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timezone: 'UTC',
      currency: 'USD',
      workingHours: [
        { dayOfWeek: 0, isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { dayOfWeek: 1, isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { dayOfWeek: 2, isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { dayOfWeek: 3, isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { dayOfWeek: 4, isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { dayOfWeek: 5, isOpen: true, openTime: '08:00', closeTime: '20:00' },
        { dayOfWeek: 6, isOpen: true, openTime: '08:00', closeTime: '20:00' }
      ]
    });

    testStaff = await Staff.create({
      businessId: testBusiness._id,
      displayName: 'Master Specialist',
      email: 'specialist@studio.com',
      weeklySchedule: [
        { dayOfWeek: 0, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] },
        { dayOfWeek: 1, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] },
        { dayOfWeek: 2, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] },
        { dayOfWeek: 3, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] },
        { dayOfWeek: 4, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] },
        { dayOfWeek: 5, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] },
        { dayOfWeek: 6, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] }
      ]
    });

    testService = await Service.create({
      businessId: testBusiness._id,
      name: 'Full Treatment Session',
      durationMinutes: 45, // 3 cells
      bufferBefore: 0,
      bufferAfter: 15,    // 1 cleanup cell -> total 4 cells (60 mins)
      price: 120,
      qualifiedStaffIds: [testStaff._id]
    });
  });

  it('allows public customer to join waitlist with preferences', async () => {
    const res = await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: testService._id.toString(),
        preferredDateRange: {
          startDate: '2026-11-01',
          endDate: '2026-11-05'
        },
        timeOfDayPreference: 'MORNING',
        flexibleDays: 1,
        customer: {
          name: 'Sarah Connor',
          email: 'sarah@resistance.com',
          phone: '+15551234567'
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.waitlistEntry.customer.name).toBe('Sarah Connor');
    expect(res.body.data.waitlistEntry.status).toBe('WAITING');
  });

  it('executes full zero-gap cancellation recovery flow from hold to offer to booking conversion', async () => {
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 3);
    appointmentDate.setUTCHours(10, 0, 0, 0); // 10:00 AM UTC (MORNING)

    // 1. Initial public booking
    const bookRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: appointmentDate.toISOString(),
        customer: {
          name: 'Original Client',
          email: 'original@client.com',
          phone: '+15550001111'
        }
      });

    expect(bookRes.status).toBe(201);
    const originalBookingId = bookRes.body.data.booking._id;
    const manageToken = bookRes.body.data.manageToken;

    // Verify 4 discrete 15-minute cells reserved
    const initialCells = await SlotReservation.find({
      bookingId: originalBookingId,
      reservationType: 'BOOKING'
    });
    expect(initialCells.length).toBe(4);

    // 2. Candidate registers on waitlist for this window
    const targetDateStr = appointmentDate.toISOString().split('T')[0];
    const waitlistRes = await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: testService._id.toString(),
        preferredDateRange: {
          startDate: targetDateStr,
          endDate: targetDateStr
        },
        timeOfDayPreference: 'MORNING',
        customer: {
          name: 'Waitlist VIP Candidate',
          email: 'vip@waitlist.com',
          phone: '+15559998888'
        }
      });
    expect(waitlistRes.status).toBe(201);
    const candidateId = waitlistRes.body.data.waitlistEntry._id;

    // 3. Original client cancels booking: triggers zero-gap hold conversion
    const cancelRes = await request(app)
      .post(`/api/v1/public/bookings/${originalBookingId}/cancel`)
      .send({
        token: manageToken,
        reason: 'Client travel plans changed'
      });
    expect(cancelRes.status).toBe(200);

    // Verify durable RecoveryJob created in PENDING status
    const recoveryJob = await RecoveryJob.findOne({ bookingId: originalBookingId });
    expect(recoveryJob).not.toBeNull();
    expect(recoveryJob.status).toBe('PENDING');

    // Verify reservation cells converted to HOLD with RECOVERY_PENDING
    const heldCells = await SlotReservation.find({
      recoveryJobId: recoveryJob._id,
      reservationType: 'HOLD',
      holdType: 'RECOVERY_PENDING'
    });
    expect(heldCells.length).toBe(4);

    // 4. Recovery Worker claims job with lease token fencing
    const workerId = 'worker-test-alpha';
    const claimedJob = await claimRecoveryJob(workerId);
    expect(claimedJob).not.toBeNull();
    expect(claimedJob.status).toBe('PROCESSING');
    expect(claimedJob.lockedByWorkerId).toBe(workerId);
    expect(claimedJob.leaseToken).toBeDefined();

    // 5. Worker processes job: matches candidate and creates active offer
    const processResult = await processClaimedRecoveryJob(claimedJob, workerId);
    expect(processResult.status).toBe('OFFER_CREATED');
    expect(processResult.candidateEmail).toBe('vip@waitlist.com');
    const rawClaimToken = processResult.rawClaimToken;

    // Verify candidate state updated to OFFERED
    const candidateDoc = await WaitlistEntry.findById(candidateId);
    expect(candidateDoc.status).toBe('OFFERED');
    expect(candidateDoc.offersCount).toBe(1);

    // Verify cells transferred to HOLD with holdType OFFER
    const offerCells = await SlotReservation.find({
      holdOfferId: processResult.offerId,
      reservationType: 'HOLD',
      holdType: 'OFFER'
    });
    expect(offerCells.length).toBe(4);

    // 6. Verify Public Conflict Prevention: Public cannot steal the offered slot
    const conflictRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: appointmentDate.toISOString(),
        customer: {
          name: 'Public Intruder',
          email: 'intruder@public.com',
          phone: '+15554443333'
        }
      });
    expect(conflictRes.status).toBe(409);

    // 7. Candidate claims offer via secure action token
    const acceptRes = await request(app)
      .post(`/api/v1/public/offers/${processResult.offerId}/accept`)
      .send({
        token: rawClaimToken
      });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.success).toBe(true);
    const newBooking = acceptRes.body.data.booking;
    expect(newBooking.source).toBe('WAITLIST_RECOVERY');
    expect(newBooking.customer.email).toBe('vip@waitlist.com');
    expect(newBooking.reservationCellCountSnapshot).toBe(4);

    // Verify hold cells converted to confirmed BOOKING cells for newBooking
    const finalBookingCells = await SlotReservation.find({
      bookingId: newBooking._id,
      reservationType: 'BOOKING'
    });
    expect(finalBookingCells.length).toBe(4);

    // Verify offer and job marked completed
    const finalOffer = await WaitlistOffer.findById(processResult.offerId);
    expect(finalOffer.status).toBe('ACCEPTED');

    const finalJob = await RecoveryJob.findById(recoveryJob._id);
    expect(finalJob.status).toBe('COMPLETED');
  });

  it('enforces worker lease-token fencing: aborts transaction if lease was stolen', async () => {
    // Create a pending job
    const job = await RecoveryJob.create({
      businessId: testBusiness._id,
      bookingId: new mongoose.Types.ObjectId(),
      vacatedInterval: {
        staffId: testStaff._id,
        serviceId: testService._id,
        startTimeUtc: new Date(),
        endTimeUtc: new Date(Date.now() + 3600000),
        vacatedDurationMinutes: 45
      },
      status: 'PROCESSING',
      leaseToken: 'token-worker-A',
      lockedByWorkerId: 'worker-A',
      lockedUntil: new Date(Date.now() + 30000)
    });

    // Worker B steals the lease by updating leaseToken in the database
    await RecoveryJob.updateOne(
      { _id: job._id },
      { $set: { leaseToken: 'token-worker-B', lockedByWorkerId: 'worker-B' } }
    );

    // Worker A tries to process using stale job document
    await expect(processClaimedRecoveryJob(job, 'worker-A')).rejects.toThrow(
      /lease expired or preempted/i
    );
  });
});
