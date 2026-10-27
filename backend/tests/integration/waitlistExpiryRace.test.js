import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { Booking } from '../../src/models/Booking.js';
import { SlotReservation } from '../../src/models/SlotReservation.js';
import { RecoveryJob } from '../../src/models/RecoveryJob.js';
import { WaitlistEntry } from '../../src/models/WaitlistEntry.js';
import { WaitlistOffer } from '../../src/models/WaitlistOffer.js';
import {
  acceptWaitlistOffer,
  claimRecoveryJob,
  hashClaimToken
} from '../../src/services/recovery.service.js';
import { ConflictError } from '../../src/middleware/errorHandler.js';

describe('Waitlist Offer Expiry Race Condition (Finding 3 & Transaction Bug Fix)', () => {
  let business;
  let service;
  let staff;
  let candidate;
  let recoveryJob;
  let offer;
  let rawClaimToken;
  let reservationCells;

  beforeEach(async () => {
    business = await Business.create({
      name: 'Expiry Test Spa',
      slug: `expiry-spa-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timezone: 'UTC',
      currency: 'USD',
      workingHours: [
        { dayOfWeek: 1, isOpen: true, openTime: '08:00', closeTime: '20:00' }
      ]
    });

    staff = await Staff.create({
      businessId: business._id,
      displayName: 'Therapist Leo',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '08:00', shiftEnd: '20:00', breaks: [] }
      ]
    });

    service = await Service.create({
      businessId: business._id,
      name: 'Deep Tissue Massage',
      durationMinutes: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      price: 100,
      qualifiedStaffIds: [staff._id]
    });

    candidate = await WaitlistEntry.create({
      businessId: business._id,
      serviceId: service._id,
      customer: {
        name: 'John Connor',
        email: 'john@rebellion.org',
        phone: '+15559998888'
      },
      preferredDateRange: {
        startDate: new Date('2026-11-02'),
        endDate: new Date('2026-11-02')
      },
      timeOfDayPreference: 'ANY',
      status: 'OFFERED',
      priorityScore: 100
    });

    const appointmentTimeUtc = new Date('2026-11-02T10:00:00.000Z');
    const appointmentEndTimeUtc = new Date('2026-11-02T10:30:00.000Z');

    recoveryJob = await RecoveryJob.create({
      businessId: business._id,
      bookingId: new mongoose.Types.ObjectId(),
      vacatedInterval: {
        staffId: staff._id,
        serviceId: service._id,
        startTimeUtc: appointmentTimeUtc,
        endTimeUtc: appointmentEndTimeUtc,
        vacatedDurationMinutes: 30
      },
      status: 'PROCESSING',
      lockedUntil: new Date(Date.now() + 60000),
      retryCount: 1
    });

    // Create 2 held reservation cells (15m each for 30m duration)
    const cell1 = await SlotReservation.create({
      businessId: business._id,
      staffId: staff._id,
      slotStartTimeUtc: appointmentTimeUtc,
      reservationType: 'HOLD',
      holdType: 'OFFER',
      recoveryJobId: recoveryJob._id
    });

    const cell2 = await SlotReservation.create({
      businessId: business._id,
      staffId: staff._id,
      slotStartTimeUtc: new Date(appointmentTimeUtc.getTime() + 15 * 60 * 1000),
      reservationType: 'HOLD',
      holdType: 'OFFER',
      recoveryJobId: recoveryJob._id
    });

    reservationCells = [cell1, cell2];

    rawClaimToken = crypto.randomBytes(24).toString('hex');
    const claimTokenHash = hashClaimToken(rawClaimToken);

    // Initial offer expires in the future (30 seconds)
    const futureExpiresAt = new Date(Date.now() + 30000);

    offer = await WaitlistOffer.create({
      businessId: business._id,
      waitlistEntryId: candidate._id,
      recoveryJobId: recoveryJob._id,
      serviceId: service._id,
      staffId: staff._id,
      offeredInterval: {
        startTimeUtc: appointmentTimeUtc,
        endTimeUtc: appointmentEndTimeUtc,
        durationMinutes: 30,
        reservationCellCount: 2
      },
      claimTokenHash,
      expiresAt: futureExpiresAt,
      status: 'PENDING',
      holdSlotReservationIds: [cell1._id, cell2._id]
    });

    // Link offer to hold cells
    await SlotReservation.updateMany(
      { _id: { $in: [cell1._id, cell2._id] } },
      { $set: { holdOfferId: offer._id, holdExpiresAtUtc: futureExpiresAt } }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles offer expiring between initial precheck and transactional check: commits expiry updates and throws 409', async () => {
    // Intercept WaitlistOffer.findById: returns the still-valid offer to the initial precheck,
    // but right after precheck runs, the offer in the DB expires before the transaction checks it!
    const originalFindById = WaitlistOffer.findById.bind(WaitlistOffer);
    vi.spyOn(WaitlistOffer, 'findById').mockImplementation(async (...args) => {
      const result = await originalFindById(...args);
      // Simulate offer expiring between initial precheck and transaction
      await WaitlistOffer.updateOne(
        { _id: offer._id },
        { $set: { expiresAt: new Date(Date.now() - 5000) } }
      );
      return result;
    });

    // Attempting to accept the offer must throw ConflictError (translated to HTTP 409)
    await expect(
      acceptWaitlistOffer({
        offerId: offer._id,
        rawClaimToken
      })
    ).rejects.toThrowError(ConflictError);

    // 1. Assert that the offer remains EXPIRED in the database (persisted by transaction commit)
    const updatedOffer = await WaitlistOffer.findById(offer._id);
    expect(updatedOffer.status).toBe('EXPIRED');

    // 2. Assert that candidate waitlist entry status was updated and persisted as EXPIRED
    const updatedCandidate = await WaitlistEntry.findById(candidate._id);
    expect(updatedCandidate.status).toBe('EXPIRED');

    // 3. Assert that reservation cells safely returned to RECOVERY_PENDING without losing hold
    const updatedCells = await SlotReservation.find({
      _id: { $in: reservationCells.map((c) => c._id) }
    });
    expect(updatedCells.length).toBe(2);
    for (const cell of updatedCells) {
      expect(cell.reservationType).toBe('HOLD');
      expect(cell.holdType).toBe('RECOVERY_PENDING');
      expect(cell.recoveryJobId.toString()).toBe(recoveryJob._id.toString());
      expect(cell.holdOfferId).toBeUndefined();
    }

    // 4. Assert that RecoveryJob became eligible for reassignment (status: PENDING, null locks)
    const updatedJob = await RecoveryJob.findById(recoveryJob._id);
    expect(updatedJob.status).toBe('PENDING');
    expect(updatedJob.lockedUntil).toBeNull();
    expect(updatedJob.leaseToken).toBeNull();

    // Verify a worker can immediately claim it for reassignment
    const claimedJob = await claimRecoveryJob('worker-reassignment-test');
    expect(claimedJob).not.toBeNull();
    expect(claimedJob._id.toString()).toBe(recoveryJob._id.toString());
    expect(claimedJob.status).toBe('PROCESSING');

    // 5. Assert that NO confirmed booking was created
    const createdBookings = await Booking.find({ businessId: business._id });
    expect(createdBookings.length).toBe(0);
  });
});

