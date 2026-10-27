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
import {
  createTestBusiness,
  createTestStaff,
  createTestService
} from '../fixtures/testData.js';

describe('Smart Cancellation Recovery & Waitlist Engine Lifecycle Tests', () => {
  let app;
  let testBusiness;
  let testStaff;
  let testService;
  let otherService;

  beforeEach(async () => {
    app = createApp();

    testBusiness = await createTestBusiness({
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

    testStaff = await createTestStaff(testBusiness._id, {
      displayName: 'Recovery Master',
      email: 'master@studio.com',
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

    testService = await createTestService(testBusiness._id, [testStaff._id], {
      name: 'Primary Session',
      durationMinutes: 45, // 3 cells
      bufferBefore: 0,
      bufferAfter: 15,    // 1 cell -> total 4 cells (60m)
      price: 150
    });

    otherService = await createTestService(testBusiness._id, [testStaff._id], {
      name: 'Unrelated Service',
      durationMinutes: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      price: 80
    });
  });

  it('executes zero-gap cancellation, candidate filtering (skipping ineligible), offer issuance, and booking conversion', async () => {
    // 1. Initial confirmed booking
    const slotTimeUtc = '2026-11-15T10:00:00.000Z';
    const bookRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: slotTimeUtc,
        customer: {
          name: 'Original Customer',
          email: 'original@example.com',
          phone: '+15551112222'
        }
      });

    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.data.booking._id;
    const rawManageToken = bookRes.body.data.manageToken;

    // 2. Candidate 1 joins waitlist for OTHER service (INELIGIBLE candidate)
    await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: otherService._id.toString(),
        preferredDateRange: { startDate: '2026-11-15', endDate: '2026-11-16' },
        timeOfDayPreference: 'ANY',
        customer: {
          name: 'Ineligible Bob',
          email: 'bob@other.com',
          phone: '+15553334444'
        }
      });

    // 3. Candidate 2 joins waitlist for THIS service (ELIGIBLE candidate)
    const waitlistRes = await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: testService._id.toString(),
        preferredStaffId: testStaff._id.toString(),
        preferredDateRange: { startDate: '2026-11-15', endDate: '2026-11-16' },
        timeOfDayPreference: 'MORNING',
        customer: {
          name: 'Eligible Alice',
          email: 'alice@priority.com',
          phone: '+15555556666'
        }
      });
    expect(waitlistRes.status).toBe(201);
    const eligibleCandidateId = waitlistRes.body.data.waitlistEntry._id;

    // 4. Cancel booking via public guest endpoint
    const cancelRes = await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({
        token: rawManageToken,
        reason: 'Emergency trip'
      });

    expect(cancelRes.status).toBe(200);

    // DATABASE ASSERTIONS ON CANCELLATION
    const cancelledBooking = await Booking.findById(bookingId);
    expect(cancelledBooking.status).toBe('CANCELLED');

    const recoveryJob = await RecoveryJob.findOne({ bookingId });
    expect(recoveryJob).not.toBeNull();
    expect(recoveryJob.status).toBe('PENDING');

    const heldCells = await SlotReservation.find({ recoveryJobId: recoveryJob._id });
    expect(heldCells).toHaveLength(4);
    for (const cell of heldCells) {
      expect(cell.reservationType).toBe('HOLD');
      expect(cell.holdType).toBe('RECOVERY_PENDING');
    }

    // 5. Worker claims job via lease fencing
    const workerId = 'worker-qa-node-1';
    const claimedJob = await claimRecoveryJob(workerId);
    expect(claimedJob).not.toBeNull();
    expect(claimedJob._id.toString()).toBe(recoveryJob._id.toString());
    expect(claimedJob.status).toBe('PROCESSING');

    // 6. Process job: must match Eligible Alice and skip Ineligible Bob
    const offerResult = await processClaimedRecoveryJob(claimedJob, workerId, 15);
    expect(offerResult.status).toBe('OFFER_CREATED');
    expect(offerResult.candidateEmail).toBe('alice@priority.com');

    // Verify Ineligible Bob remains in WAITING status
    const bobEntry = await WaitlistEntry.findOne({ 'customer.email': 'bob@other.com' });
    expect(bobEntry.status).toBe('WAITING');

    // Verify Alice is now OFFERED
    const aliceEntry = await WaitlistEntry.findById(eligibleCandidateId);
    expect(aliceEntry.status).toBe('OFFERED');

    // Verify reservation cells transferred to OFFER hold
    const offerHoldCells = await SlotReservation.find({ holdOfferId: offerResult.offerId });
    expect(offerHoldCells).toHaveLength(4);
    for (const cell of offerHoldCells) {
      expect(cell.holdType).toBe('OFFER');
    }

    // 7. Alice accepts offer via public endpoint
    const acceptRes = await request(app)
      .post(`/api/v1/public/offers/${offerResult.offerId}/accept`)
      .send({
        token: offerResult.rawClaimToken
      });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.success).toBe(true);
    const recoveredBookingId = acceptRes.body.data.booking._id;

    // DATABASE ASSERTIONS ON ACCEPTANCE
    const newBooking = await Booking.findById(recoveredBookingId);
    expect(newBooking.status).toBe('CONFIRMED');
    expect(newBooking.source).toBe('WAITLIST_RECOVERY');
    expect(newBooking.customer.email).toBe('alice@priority.com');

    const finalReservations = await SlotReservation.find({ bookingId: recoveredBookingId });
    expect(finalReservations).toHaveLength(4);
    for (const cell of finalReservations) {
      expect(cell.reservationType).toBe('BOOKING');
      expect(cell.holdType).toBeUndefined();
    }

    const completedJob = await RecoveryJob.findById(recoveryJob._id);
    expect(completedJob.status).toBe('COMPLETED');
  });

  it('prevents duplicate bookings when concurrent acceptance requests compete for the same offer', async () => {
    // 1. Setup cancelled booking with pending offer
    const slotTimeUtc = '2026-11-15T14:00:00.000Z';
    const bookRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: slotTimeUtc,
        customer: { name: 'Customer Temp', email: 'temp@race.com', phone: '+15551234567' }
      });

    const bookingId = bookRes.body.data.booking._id;
    const rawManageToken = bookRes.body.data.manageToken;

    await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: testService._id.toString(),
        preferredStaffId: testStaff._id.toString(),
        preferredDateRange: { startDate: '2026-11-15', endDate: '2026-11-15' },
        timeOfDayPreference: 'AFTERNOON',
        customer: { name: 'Racer Charlie', email: 'charlie@race.com', phone: '+15557778888' }
      });

    await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({ token: rawManageToken });

    const workerId = 'worker-qa-node-race';
    const job = await claimRecoveryJob(workerId);
    const offerResult = await processClaimedRecoveryJob(job, workerId, 15);

    // 2. Submit 2 simultaneous acceptance requests with the same claimToken
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/v1/public/offers/${offerResult.offerId}/accept`)
        .send({ token: offerResult.rawClaimToken }),
      request(app)
        .post(`/api/v1/public/offers/${offerResult.offerId}/accept`)
        .send({ token: offerResult.rawClaimToken })
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const conflictRes = res1.status === 409 ? res1 : res2;
    expect(conflictRes.body.error.message).toMatch(/no longer (available|active)/i);

    // Verify DB: exactly 1 booking created
    const bookings = await Booking.find({
      businessId: testBusiness._id,
      startTimeUtc: new Date(slotTimeUtc),
      status: 'CONFIRMED'
    });
    expect(bookings).toHaveLength(1);
  });

  it('requeues work and offers to next candidate when an offer is declined', async () => {
    // 1. Initial booking
    const slotTimeUtc = '2026-11-15T16:00:00.000Z';
    const bookRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: slotTimeUtc,
        customer: { name: 'Customer Initial', email: 'init@declines.com', phone: '+15550001111' }
      });

    const bookingId = bookRes.body.data.booking._id;
    const rawManageToken = bookRes.body.data.manageToken;

    // 2. Add Candidate 1 (will decline) and Candidate 2 (will accept)
    await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: testService._id.toString(),
        preferredStaffId: testStaff._id.toString(),
        preferredDateRange: { startDate: '2026-11-15', endDate: '2026-11-15' },
        timeOfDayPreference: 'AFTERNOON',
        customer: { name: 'Candidate One', email: 'one@declines.com', phone: '+15551110001' }
      });

    await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: testService._id.toString(),
        preferredStaffId: testStaff._id.toString(),
        preferredDateRange: { startDate: '2026-11-15', endDate: '2026-11-15' },
        timeOfDayPreference: 'AFTERNOON',
        customer: { name: 'Candidate Two', email: 'two@declines.com', phone: '+15551110002' }
      });

    // 3. Cancel booking
    await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({ token: rawManageToken });

    // 4. Worker claims and creates offer for Candidate 1
    const worker1 = 'worker-decline-1';
    const job1 = await claimRecoveryJob(worker1);
    const offer1 = await processClaimedRecoveryJob(job1, worker1, 15);
    expect(offer1.candidateEmail).toBe('one@declines.com');

    // 5. Candidate 1 declines offer via public endpoint
    const declineRes = await request(app)
      .post(`/api/v1/public/offers/${offer1.offerId}/decline`)
      .send({ token: offer1.rawClaimToken });

    expect(declineRes.status).toBe(200);

    // Verify Candidate 1 status is CANCELLED and offer is DECLINED
    const offer1Doc = await WaitlistOffer.findById(offer1.offerId);
    expect(offer1Doc.status).toBe('DECLINED');

    // 6. Recovery job is unlocked and reset to PENDING
    const jobReset = await RecoveryJob.findById(job1._id);
    expect(jobReset.status).toBe('PENDING');
    expect(jobReset.lockedUntil).toBeNull();

    // 7. Worker claims again and offers to Candidate 2!
    const worker2 = 'worker-decline-2';
    const job2 = await claimRecoveryJob(worker2);
    const offer2 = await processClaimedRecoveryJob(job2, worker2, 15);
    expect(offer2.status).toBe('OFFER_CREATED');
    expect(offer2.candidateEmail).toBe('two@declines.com');
  });

  it('sweeps expired offers without creating phantom bookings and resets hold cells', async () => {
    // 1. Create cancelled booking and offer
    const slotTimeUtc = '2026-11-16T09:00:00.000Z';
    const bookRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: slotTimeUtc,
        customer: { name: 'Cust Exp', email: 'cust@expiry.com', phone: '+15559990000' }
      });

    const bookingId = bookRes.body.data.booking._id;
    const rawManageToken = bookRes.body.data.manageToken;

    await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/waitlist`)
      .send({
        serviceId: testService._id.toString(),
        preferredStaffId: testStaff._id.toString(),
        preferredDateRange: { startDate: '2026-11-16', endDate: '2026-11-16' },
        timeOfDayPreference: 'MORNING',
        customer: { name: 'Slow Candidate', email: 'slow@expiry.com', phone: '+15559990001' }
      });

    await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({ token: rawManageToken });

    const workerId = 'worker-expiry-node';
    const job = await claimRecoveryJob(workerId);
    const offerResult = await processClaimedRecoveryJob(job, workerId, 15);

    // 2. Fast-forward expiration by setting expiresAt to 10 minutes in the past
    await WaitlistOffer.updateOne(
      { _id: offerResult.offerId },
      { $set: { expiresAt: new Date(Date.now() - 600000) } }
    );

    // 3. Candidate attempts to accept expired offer -> returns 409 Conflict
    const acceptRes = await request(app)
      .post(`/api/v1/public/offers/${offerResult.offerId}/accept`)
      .send({ token: offerResult.rawClaimToken });

    expect(acceptRes.status).toBe(409);
    expect(acceptRes.body.error.message).toMatch(/offer has expired/i);

    // Verify offer status committed as EXPIRED
    const expiredOffer = await WaitlistOffer.findById(offerResult.offerId);
    expect(expiredOffer.status).toBe('EXPIRED');

    // Verify hold cells reset to RECOVERY_PENDING under the recoveryJob
    const holdCells = await SlotReservation.find({ recoveryJobId: job._id });
    expect(holdCells).toHaveLength(4);
    for (const cell of holdCells) {
      expect(cell.holdType).toBe('RECOVERY_PENDING');
      expect(cell.reservationType).toBe('HOLD');
    }

    // Verify zero phantom bookings exist
    const bookings = await Booking.find({
      businessId: testBusiness._id,
      startTimeUtc: new Date(slotTimeUtc),
      status: 'CONFIRMED'
    });
    expect(bookings).toHaveLength(0);
  });

  it('releases all held inventory back to public availability when no waitlist candidates exist', async () => {
    // 1. Create booking and cancel without anyone on waitlist
    const slotTimeUtc = '2026-11-16T12:00:00.000Z';
    const bookRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: slotTimeUtc,
        customer: { name: 'Cust NoWait', email: 'nowait@example.com', phone: '+15558880000' }
      });

    const bookingId = bookRes.body.data.booking._id;
    const rawManageToken = bookRes.body.data.manageToken;

    await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({ token: rawManageToken });

    // 2. Worker claims job
    const workerId = 'worker-nocand-node';
    const job = await claimRecoveryJob(workerId);
    expect(job).not.toBeNull();

    // 3. Process job with zero candidates
    const result = await processClaimedRecoveryJob(job, workerId, 15);
    expect(result.status).toBe('NO_CANDIDATES');
    expect(result.releasedCellsCount).toBe(4);

    // Verify job status in DB
    const finalJob = await RecoveryJob.findById(job._id);
    expect(finalJob.status).toBe('NO_CANDIDATES');

    // Verify all held cells deleted (released)
    const remainingHolds = await SlotReservation.find({ recoveryJobId: job._id });
    expect(remainingHolds).toHaveLength(0);
  });

  it('enforces worker lease fencing: prevents concurrent claim and recovers after lease expiry', async () => {
    // 1. Create a pending job
    const testJob = await RecoveryJob.create({
      businessId: testBusiness._id,
      bookingId: new mongoose.Types.ObjectId(),
      vacatedInterval: {
        staffId: testStaff._id,
        serviceId: testService._id,
        startTimeUtc: new Date('2026-11-17T10:00:00.000Z'),
        endTimeUtc: new Date('2026-11-17T10:45:00.000Z'),
        vacatedDurationMinutes: 45
      },
      status: 'PENDING',
      lockedUntil: null
    });

    // 2. Worker 1 claims job with 1000ms lease
    const claimedByWorker1 = await claimRecoveryJob('worker-alpha', 1000);
    expect(claimedByWorker1).not.toBeNull();
    expect(claimedByWorker1._id.toString()).toBe(testJob._id.toString());
    expect(claimedByWorker1.lockedByWorkerId).toBe('worker-alpha');

    // 3. Worker 2 attempts to claim while lease is active -> receives null
    const claimedByWorker2 = await claimRecoveryJob('worker-beta', 1000);
    expect(claimedByWorker2).toBeNull();

    // 4. Manually expire lease to simulate Worker 1 crash
    await RecoveryJob.updateOne(
      { _id: testJob._id },
      { $set: { lockedUntil: new Date(Date.now() - 5000) } }
    );

    // 5. Worker 2 now successfully claims the crashed worker's job!
    const recoveredByWorker2 = await claimRecoveryJob('worker-beta', 5000);
    expect(recoveredByWorker2).not.toBeNull();
    expect(recoveredByWorker2._id.toString()).toBe(testJob._id.toString());
    expect(recoveredByWorker2.lockedByWorkerId).toBe('worker-beta');
  });
});
