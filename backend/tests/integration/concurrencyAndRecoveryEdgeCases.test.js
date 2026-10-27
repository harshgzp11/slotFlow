import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
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
  hashClaimToken
} from '../../src/services/recovery.service.js';
import { createRateLimiter } from '../../src/middleware/rateLimiter.js';

describe('Concurrency, Expiry, and Recovery Edge Cases Integration Tests', () => {
  let app;
  let testBusiness;
  let testService;
  let testStaff;

  beforeEach(async () => {
    app = createApp();

    testBusiness = await Business.create({
      name: 'Resilience Clinic',
      slug: `resilience-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
      displayName: 'Lead Practitioner',
      email: `staff-${Date.now()}-${Math.random().toString(36).substring(7)}@clinic.com`,
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
      name: 'Therapy Session',
      durationMinutes: 30, // 2 cells
      bufferBefore: 0,
      bufferAfter: 0,
      price: 100,
      qualifiedStaffIds: [testStaff._id]
    });
  });

  it('rejects double cancellation with 409 Conflict on the second attempt', async () => {
    const startTimeUtc = new Date();
    startTimeUtc.setDate(startTimeUtc.getDate() + 2);
    startTimeUtc.setUTCHours(10, 0, 0, 0);

    // Create booking via public API
    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: startTimeUtc.toISOString(),
        customer: {
          name: 'Alice Springs',
          email: 'alice@example.com',
          phone: '+15551234567'
        }
      });

    expect(bookingRes.status).toBe(201);
    const bookingId = bookingRes.body.data.booking._id;
    const rawManageToken = bookingRes.body.data.manageToken;

    // First cancellation: succeeds
    const cancel1 = await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({
        token: rawManageToken,
        reason: 'Change of schedule'
      });
    expect(cancel1.status).toBe(200);
    expect(cancel1.body.success).toBe(true);

    // Second cancellation: rejected with 409
    const cancel2 = await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({
        token: rawManageToken,
        reason: 'Duplicate cancellation attempt'
      });
    expect(cancel2.status).toBe(409);
    expect(cancel2.body.error.message).toContain('Cannot cancel booking with current status: CANCELLED');
  });

  it('rejects expired guest management token with 401 Unauthorized', async () => {
    const startTimeUtc = new Date();
    startTimeUtc.setDate(startTimeUtc.getDate() + 2);
    startTimeUtc.setUTCHours(11, 0, 0, 0);

    const bookingRes = await request(app)
      .post('/api/v1/public/bookings')
      .send({
        slug: testBusiness.slug,
        serviceId: testService._id.toString(),
        staffId: testStaff._id.toString(),
        startTimeUtc: startTimeUtc.toISOString(),
        customer: {
          name: 'Bob Marley',
          email: 'bob@example.com',
          phone: '+15559876543'
        }
      });

    expect(bookingRes.status).toBe(201);
    const bookingId = bookingRes.body.data.booking._id;
    const rawManageToken = bookingRes.body.data.manageToken;

    // Fast-forward expiration: set manageTokenExpiresAt to the past
    await Booking.findByIdAndUpdate(bookingId, {
      manageTokenExpiresAt: new Date(Date.now() - 3600000) // 1 hour ago
    });

    // 1. Manage GET should be rejected with 401
    const getRes = await request(app)
      .get(`/api/v1/public/bookings/${bookingId}/manage?token=${rawManageToken}`);
    expect(getRes.status).toBe(401);
    expect(getRes.body.error.message).toContain('Management token has expired.');

    // 2. Cancel POST should be rejected with 401
    const cancelRes = await request(app)
      .post(`/api/v1/public/bookings/${bookingId}/cancel`)
      .send({
        token: rawManageToken,
        reason: 'Trying to cancel with expired token'
      });
    expect(cancelRes.status).toBe(401);
    expect(cancelRes.body.error.message).toContain('Management token has expired.');
  });

  it('handles two concurrent attempts to accept the same waitlist offer atomically (exactly 1 succeeds, 1 conflicts)', async () => {
    const startTimeUtc = new Date();
    startTimeUtc.setDate(startTimeUtc.getDate() + 3);
    startTimeUtc.setUTCHours(14, 0, 0, 0);
    const endTimeUtc = new Date(startTimeUtc.getTime() + 30 * 60000);

    // Create durable recovery job with required bookingId
    const recoveryJob = await RecoveryJob.create({
      businessId: testBusiness._id,
      bookingId: new mongoose.Types.ObjectId(),
      vacatedInterval: {
        staffId: testStaff._id,
        serviceId: testService._id,
        startTimeUtc,
        endTimeUtc,
        vacatedDurationMinutes: 30
      },
      status: 'PROCESSING',
      retryCount: 0
    });

    // Create HOLD reservation cells with valid holdType OFFER
    const heldCells = await SlotReservation.create([
      {
        businessId: testBusiness._id,
        staffId: testStaff._id,
        slotStartTimeUtc: startTimeUtc,
        reservationType: 'HOLD',
        holdType: 'OFFER',
        recoveryJobId: recoveryJob._id
      },
      {
        businessId: testBusiness._id,
        staffId: testStaff._id,
        slotStartTimeUtc: new Date(startTimeUtc.getTime() + 15 * 60000),
        reservationType: 'HOLD',
        holdType: 'OFFER',
        recoveryJobId: recoveryJob._id
      }
    ]);

    // Create waitlist entry with valid status OFFERED
    const waitlistEntry = await WaitlistEntry.create({
      businessId: testBusiness._id,
      serviceId: testService._id,
      preferredStaffId: testStaff._id,
      customer: {
        name: 'Concurrent Charlie',
        email: 'charlie@example.com',
        phone: '+15553334444'
      },
      preferredDateRange: {
        startDate: startTimeUtc.toISOString().split('T')[0],
        endDate: startTimeUtc.toISOString().split('T')[0]
      },
      timeOfDayPreference: 'AFTERNOON',
      status: 'OFFERED'
    });

    // Create WaitlistOffer
    const rawClaimToken = crypto.randomBytes(24).toString('hex');
    const claimTokenHash = hashClaimToken(rawClaimToken);
    const offer = await WaitlistOffer.create({
      businessId: testBusiness._id,
      recoveryJobId: recoveryJob._id,
      waitlistEntryId: waitlistEntry._id,
      serviceId: testService._id,
      staffId: testStaff._id,
      customer: waitlistEntry.customer,
      offeredInterval: {
        startTimeUtc,
        endTimeUtc,
        durationMinutes: 30,
        reservationCellCount: 2
      },
      claimTokenHash,
      expiresAt: new Date(Date.now() + 15 * 60000),
      holdSlotReservationIds: heldCells.map((c) => c._id),
      status: 'PENDING'
    });

    // Fire two concurrent acceptances
    const [result1, result2] = await Promise.allSettled([
      acceptWaitlistOffer({ offerId: offer._id.toString(), rawClaimToken }),
      acceptWaitlistOffer({ offerId: offer._id.toString(), rawClaimToken })
    ]);

    const successes = [result1, result2].filter((r) => r.status === 'fulfilled');
    const failures = [result1, result2].filter((r) => r.status === 'rejected');

    // Exactly 1 must succeed and 1 must fail with ConflictError (409)
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].reason.statusCode).toBe(409);

    // Verify booking was created exactly once
    const bookings = await Booking.find({ businessId: testBusiness._id });
    expect(bookings.length).toBe(1);
    expect(bookings[0].customer.email).toBe('charlie@example.com');
  });

  it('worker lease fencing aborts processing when lease is stolen or expired', async () => {
    const startTimeUtc = new Date();
    startTimeUtc.setDate(startTimeUtc.getDate() + 3);
    startTimeUtc.setUTCHours(9, 0, 0, 0);

    const job = await RecoveryJob.create({
      businessId: testBusiness._id,
      bookingId: new mongoose.Types.ObjectId(),
      vacatedInterval: {
        staffId: testStaff._id,
        serviceId: testService._id,
        startTimeUtc,
        endTimeUtc: new Date(startTimeUtc.getTime() + 30 * 60000),
        vacatedDurationMinutes: 30
      },
      status: 'PENDING',
      retryCount: 0
    });

    const workerAId = 'worker-node-A';
    const workerBId = 'worker-node-B';

    // Worker A claims the job
    const claimedJobA = await claimRecoveryJob(workerAId, 30000);
    expect(claimedJobA).not.toBeNull();
    expect(claimedJobA._id.toString()).toBe(job._id.toString());
    const workerALeaseToken = claimedJobA.leaseToken;

    // Simulate Worker B stealing/re-claiming job due to lease expiration
    await RecoveryJob.findByIdAndUpdate(job._id, {
      lockedUntil: new Date(Date.now() - 1000)
    });
    const claimedJobB = await claimRecoveryJob(workerBId, 30000);
    expect(claimedJobB).not.toBeNull();
    expect(claimedJobB.leaseToken).not.toBe(workerALeaseToken);

    // Worker A tries to process the job with stale leaseToken / workerId
    const staleWorkerJob = { ...claimedJobA._doc, leaseToken: workerALeaseToken };
    await expect(processClaimedRecoveryJob(staleWorkerJob, workerAId)).rejects.toThrow(
      'Recovery worker lease expired or preempted by another worker. Transaction aborted.'
    );
  });

  it('skips waitlist candidate whose timeOfDayPreference does not match the vacated slot', async () => {
    // Vacated slot in the MORNING (09:00 UTC)
    const startTimeUtc = new Date();
    startTimeUtc.setDate(startTimeUtc.getDate() + 4);
    startTimeUtc.setUTCHours(9, 0, 0, 0);
    const dateStr = startTimeUtc.toISOString().split('T')[0];

    // Waitlist candidate only wants EVENING (17:00+)
    const entry = await WaitlistEntry.create({
      businessId: testBusiness._id,
      serviceId: testService._id,
      customer: {
        name: 'Evening Only Dan',
        email: 'dan@example.com',
        phone: '+15554445555'
      },
      preferredDateRange: {
        startDate: dateStr,
        endDate: dateStr
      },
      timeOfDayPreference: 'EVENING',
      flexibleDays: 0,
      status: 'WAITING'
    });

    const job = await RecoveryJob.create({
      businessId: testBusiness._id,
      bookingId: new mongoose.Types.ObjectId(),
      vacatedInterval: {
        staffId: testStaff._id,
        serviceId: testService._id,
        startTimeUtc,
        endTimeUtc: new Date(startTimeUtc.getTime() + 30 * 60000),
        vacatedDurationMinutes: 30
      },
      status: 'PENDING',
      retryCount: 0
    });

    const workerId = 'worker-matcher';
    const claimedJob = await claimRecoveryJob(workerId, 30000);
    expect(claimedJob).not.toBeNull();

    const outcome = await processClaimedRecoveryJob(claimedJob, workerId);
    // Because the only candidate wants EVENING, they are ineligible for this 09:00 AM slot
    expect(outcome.status).toBe('NO_CANDIDATES');

    // Candidate should remain WAITING
    const reloadedEntry = await WaitlistEntry.findById(entry._id);
    expect(reloadedEntry.status).toBe('WAITING');
  });

  it('returns 400 INVALID_ID_FORMAT for malformed MongoDB ObjectIds instead of 500', async () => {
    const res = await request(app)
      .get('/api/v1/public/bookings/not-a-valid-object-id/manage?token=someToken');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_ID_FORMAT');
    expect(res.body.error.message).toContain('Invalid identifier format');
  });

  it('sliding window rate limiter enforces maximum request thresholds with HTTP 429', async () => {
    const testLimiter = createRateLimiter({
      windowMs: 60000,
      max: 3,
      message: 'Rate limit test exceeded',
      skipInTest: false
    });

    let lastResStatus = 200;
    let rateLimitMessage = '';
    let retryAfterHeader = '';

    for (let i = 0; i < 5; i++) {
      const mockReq = { ip: '192.168.1.100', socket: { remoteAddress: '192.168.1.100' } };
      let statusCalled = 200;
      let jsonPayload = null;

      const mockRes = {
        setHeader: (name, val) => {
          if (name === 'Retry-After') retryAfterHeader = val;
        },
        status: (code) => {
          statusCalled = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            }
          };
        }
      };
      const mockNext = (err) => {
        if (err && err.statusCode === 429) {
          statusCalled = 429;
          rateLimitMessage = err.message;
        }
      };

      testLimiter(mockReq, mockRes, mockNext);

      if (statusCalled === 429) {
        lastResStatus = 429;
      }
    }

    expect(lastResStatus).toBe(429);
    expect(rateLimitMessage).toBe('Rate limit test exceeded');
    expect(retryAfterHeader).toBeDefined();
  });
});
