import { describe, it, expect, beforeEach } from 'vitest';
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
  hashClaimToken
} from '../../src/services/recovery.service.js';
import { ConflictError } from '../../src/middleware/errorHandler.js';

describe('Waitlist Offer Expiry Race Condition (Finding 3)', () => {
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

    // Create offer that expires 50ms in the past (expired offer race condition simulation)
    const pastExpiresAt = new Date(Date.now() - 500);

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
      expiresAt: pastExpiresAt,
      status: 'PENDING',
      holdSlotReservationIds: [cell1._id, cell2._id]
    });

    // Link offer to hold cells
    await SlotReservation.updateMany(
      { _id: { $in: [cell1._id, cell2._id] } },
      { $set: { holdOfferId: offer._id, holdExpiresAtUtc: pastExpiresAt } }
    );
  });

  it('atomically rejects an expired offer inside acceptance transaction and rolls back holds safely', async () => {
    // Attempting to accept an expired offer must throw ConflictError
    await expect(
      acceptWaitlistOffer({
        offerId: offer._id,
        rawClaimToken
      })
    ).rejects.toThrowError(ConflictError);

    // 1. Verify offer status was updated to EXPIRED
    const updatedOffer = await WaitlistOffer.findById(offer._id);
    expect(updatedOffer.status).toBe('EXPIRED');

    // 2. Verify candidate waitlist entry status was updated to EXPIRED
    const updatedCandidate = await WaitlistEntry.findById(candidate._id);
    expect(updatedCandidate.status).toBe('EXPIRED');

    // 3. Verify held reservation cells were safely reverted to RECOVERY_PENDING without losing hold
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

    // 4. Verify RecoveryJob status was reset to PENDING and unlocked for reassignment
    const updatedJob = await RecoveryJob.findById(recoveryJob._id);
    expect(updatedJob.status).toBe('PENDING');
    expect(updatedJob.lockedUntil).toBeNull();
    expect(updatedJob.leaseToken).toBeNull();

    // 5. Verify NO confirmed booking was created
    const createdBookings = await Booking.find({ businessId: business._id });
    expect(createdBookings.length).toBe(0);
  });
});
