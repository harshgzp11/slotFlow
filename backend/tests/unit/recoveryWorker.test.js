import { describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import { runWorkerIteration, startRecoveryWorker, MAX_RECOVERY_RETRIES } from '../../src/workers/recovery.worker.js';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { Booking } from '../../src/models/Booking.js';
import { WaitlistEntry } from '../../src/models/WaitlistEntry.js';
import { WaitlistOffer } from '../../src/models/WaitlistOffer.js';
import { RecoveryJob } from '../../src/models/RecoveryJob.js';
import { SlotReservation } from '../../src/models/SlotReservation.js';

describe('Recovery Worker Unit Tests', () => {
  it('sweeps and expires pending offers that have passed their deadline', async () => {
    const business = await Business.create({
      name: 'Worker Test Clinic',
      slug: 'worker-test-clinic',
      timezone: 'UTC',
      operatingHours: {
        monday: { isOpen: true, open: '09:00', close: '17:00' }
      }
    });

    const service = await Service.create({
      businessId: business._id,
      name: 'Haircut',
      durationMinutes: 30,
      price: 40
    });

    const staff = await Staff.create({
      businessId: business._id,
      displayName: 'Alex Staff',
      servicesOffered: [service._id]
    });

    const entry = await WaitlistEntry.create({
      businessId: business._id,
      serviceId: service._id,
      customer: { name: 'Late Responder', email: 'late@example.com', phone: '1234567890' },
      preferredStaffId: staff._id,
      preferredDateRange: { startDate: new Date('2026-11-02T00:00:00Z'), endDate: new Date('2026-11-02T23:59:59Z') },
      timeOfDayPreference: 'ANY',
      status: 'OFFERED'
    });

    const dummyBookingId = new mongoose.Types.ObjectId();

    const job = await RecoveryJob.create({
      businessId: business._id,
      bookingId: dummyBookingId,
      vacatedInterval: {
        staffId: staff._id,
        serviceId: service._id,
        startTimeUtc: new Date('2026-11-02T10:00:00Z'),
        endTimeUtc: new Date('2026-11-02T10:30:00Z'),
        vacatedDurationMinutes: 30
      },
      status: 'PROCESSING',
      lockedUntil: new Date(Date.now() - 5000)
    });

    const holdCell1 = await SlotReservation.create({
      businessId: business._id,
      staffId: staff._id,
      slotStartTimeUtc: new Date('2026-11-02T10:00:00Z'),
      reservationType: 'HOLD',
      holdType: 'OFFER',
      recoveryJobId: job._id
    });

    const expiredOffer = await WaitlistOffer.create({
      businessId: business._id,
      waitlistEntryId: entry._id,
      recoveryJobId: job._id,
      serviceId: service._id,
      staffId: staff._id,
      offeredInterval: {
        startTimeUtc: new Date('2026-11-02T10:00:00Z'),
        endTimeUtc: new Date('2026-11-02T10:30:00Z'),
        durationMinutes: 30,
        reservationCellCount: 1
      },
      claimTokenHash: 'mockedhash',
      expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
      status: 'PENDING',
      holdSlotReservationIds: [holdCell1._id]
    });

    // Run iteration
    const result = await runWorkerIteration('test-worker-1');

    expect(result.expiredOffersProcessed).toBe(1);

    // Verify offer status changed to EXPIRED
    const updatedOffer = await WaitlistOffer.findById(expiredOffer._id);
    expect(updatedOffer.status).toBe('EXPIRED');

    // Verify candidate waitlist entry changed to EXPIRED
    const updatedEntry = await WaitlistEntry.findById(entry._id);
    expect(updatedEntry.status).toBe('EXPIRED');
  });

  it('marks poison-pill jobs as FAILED and releases held cells when max retries exceeded', async () => {
    const businessId = new mongoose.Types.ObjectId();
    const staffId = new mongoose.Types.ObjectId();
    const serviceId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();

    const poisonJob = await RecoveryJob.create({
      businessId,
      bookingId,
      vacatedInterval: {
        staffId,
        serviceId,
        startTimeUtc: new Date('2026-11-02T14:00:00Z'),
        endTimeUtc: new Date('2026-11-02T14:30:00Z'),
        vacatedDurationMinutes: 30
      },
      status: 'PENDING',
      retryCount: MAX_RECOVERY_RETRIES + 1, // Exceeded
      lockedUntil: null
    });

    const cell = await SlotReservation.create({
      businessId,
      staffId,
      slotStartTimeUtc: new Date('2026-11-02T14:00:00Z'),
      reservationType: 'HOLD',
      holdType: 'RECOVERY_PENDING',
      recoveryJobId: poisonJob._id
    });

    const result = await runWorkerIteration('test-worker-poison');

    expect(result.jobsProcessed).toBe(1);
    expect(result.status).toBe('FAILED');
    expect(result.reason).toBe('MAX_RETRIES_EXCEEDED');

    const updatedJob = await RecoveryJob.findById(poisonJob._id);
    expect(updatedJob.status).toBe('FAILED');

    // Verify held cells were released
    const remainingCell = await SlotReservation.findById(cell._id);
    expect(remainingCell).toBeNull();
  });

  it('starts and stops continuous worker loop cleanly and reports status', async () => {
    const { getRecoveryWorkerStatus } = await import('../../src/workers/recovery.worker.js');

    expect(getRecoveryWorkerStatus().running).toBe(false);

    const worker = startRecoveryWorker({ intervalMs: 500, workerId: 'test-timer-worker' });
    expect(worker.isRunning()).toBe(true);
    expect(worker.workerId).toBe('test-timer-worker');

    const statusRunning = getRecoveryWorkerStatus();
    expect(statusRunning.running).toBe(true);
    expect(statusRunning.workerId).toBe('test-timer-worker');
    expect(statusRunning.intervalMs).toBe(500);

    worker.stop();
    expect(worker.isRunning()).toBe(false);
    expect(getRecoveryWorkerStatus().running).toBe(false);
  });

  it('prevents accidental duplicate worker startup when already running', async () => {
    const worker1 = startRecoveryWorker({ intervalMs: 1000, workerId: 'primary-worker' });
    expect(worker1.isRunning()).toBe(true);

    // Attempt starting a second worker
    const worker2 = startRecoveryWorker({ intervalMs: 2000, workerId: 'duplicate-worker' });

    // Should return the active worker1 instance and not create a second loop
    expect(worker2).toBe(worker1);
    expect(worker2.workerId).toBe('primary-worker');

    worker1.stop();
    expect(worker1.isRunning()).toBe(false);
  });
});
