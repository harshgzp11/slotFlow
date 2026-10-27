import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { WaitlistEntry } from '../../src/models/WaitlistEntry.js';
import { findNextEligibleCandidate } from '../../src/services/recovery.service.js';

describe('Timezone-Safe Waitlist Matching (Finding 5)', () => {
  let businessKolkata;
  let service;
  let staff;

  beforeEach(async () => {
    // Business located in India (Asia/Kolkata = UTC+05:30)
    businessKolkata = await Business.create({
      name: 'Bengaluru Precision Wellness',
      slug: `bengaluru-wellness-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      workingHours: [
        { dayOfWeek: 1, isOpen: true, openTime: '06:00', closeTime: '22:00' }
      ]
    });

    staff = await Staff.create({
      businessId: businessKolkata._id,
      displayName: 'Dr. Ramesh Sharma',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '06:00', shiftEnd: '22:00', breaks: [] }
      ]
    });

    service = await Service.create({
      businessId: businessKolkata._id,
      name: 'Physiotherapy Consultation',
      durationMinutes: 45,
      bufferBefore: 0,
      bufferAfter: 15,
      price: 1500,
      qualifiedStaffIds: [staff._id]
    });
  });

  it('correctly matches candidate when UTC date differs from local Asia/Kolkata date across midnight boundary', async () => {
    // Vacated slot timestamp: 2026-11-01T20:30:00.000Z
    // In UTC: 2026-11-01 (Nov 1) at 20:30 (8:30 PM)
    // In Asia/Kolkata (+05:30): 2026-11-02 (Nov 2) at 02:00 (2:00 AM) -> MORNING
    const vacatedStartTimeUtc = new Date('2026-11-01T20:30:00.000Z');

    // Candidate 1 requested Nov 2 local date with MORNING preference
    const candidateKolkata = await WaitlistEntry.create({
      businessId: businessKolkata._id,
      serviceId: service._id,
      customer: {
        name: 'Aarav Patel',
        email: 'aarav@wellness.in',
        phone: '+919876543210'
      },
      preferredDateRange: {
        startDate: new Date('2026-11-02'),
        endDate: new Date('2026-11-02')
      },
      timeOfDayPreference: 'MORNING', // Local hour 2 AM in Kolkata < 12 => MORNING
      flexibleDays: 0,
      status: 'WAITING',
      priorityScore: 100
    });

    const match = await findNextEligibleCandidate({
      businessId: businessKolkata._id,
      serviceId: service._id,
      staffId: staff._id,
      startTimeUtc: vacatedStartTimeUtc
    });

    expect(match).not.toBeNull();
    expect(match._id.toString()).toBe(candidateKolkata._id.toString());
  });

  it('correctly filters out candidates whose preferred local date does not match the local timezone date', async () => {
    // Vacated slot timestamp: 2026-11-01T20:30:00.000Z
    // In UTC it is 2026-11-01, but in Kolkata it is 2026-11-02!
    const vacatedStartTimeUtc = new Date('2026-11-01T20:30:00.000Z');

    // Candidate wanted Nov 1st strictly (without flexibleDays)
    await WaitlistEntry.create({
      businessId: businessKolkata._id,
      serviceId: service._id,
      customer: {
        name: 'Pooja Reddy',
        email: 'pooja@reddy.in',
        phone: '+919876500000'
      },
      preferredDateRange: {
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-01')
      },
      timeOfDayPreference: 'ANY',
      flexibleDays: 0,
      status: 'WAITING',
      priorityScore: 100
    });

    const match = await findNextEligibleCandidate({
      businessId: businessKolkata._id,
      serviceId: service._id,
      staffId: staff._id,
      startTimeUtc: vacatedStartTimeUtc
    });

    // In Kolkata, the vacated slot is on Nov 2nd, so Pooja (who only wanted Nov 1st) should NOT match
    expect(match).toBeNull();
  });

  it('correctly calculates local time of day in Asia/Kolkata (AFTERNOON for 14:00 IST = 08:30 UTC)', async () => {
    // Vacated slot at 08:30 UTC = 14:00 IST (2:00 PM in Kolkata -> AFTERNOON)
    const afternoonSlotUtc = new Date('2026-11-02T08:30:00.000Z');

    const morningCandidate = await WaitlistEntry.create({
      businessId: businessKolkata._id,
      serviceId: service._id,
      customer: {
        name: 'Morning Seeker',
        email: 'morning@test.in',
        phone: '+919800000001'
      },
      preferredDateRange: {
        startDate: new Date('2026-11-02'),
        endDate: new Date('2026-11-02')
      },
      timeOfDayPreference: 'MORNING', // Doesn't match 14:00 local
      status: 'WAITING',
      priorityScore: 150
    });

    const afternoonCandidate = await WaitlistEntry.create({
      businessId: businessKolkata._id,
      serviceId: service._id,
      customer: {
        name: 'Afternoon Seeker',
        email: 'afternoon@test.in',
        phone: '+919800000002'
      },
      preferredDateRange: {
        startDate: new Date('2026-11-02'),
        endDate: new Date('2026-11-02')
      },
      timeOfDayPreference: 'AFTERNOON', // Matches 14:00 local!
      status: 'WAITING',
      priorityScore: 100
    });

    const match = await findNextEligibleCandidate({
      businessId: businessKolkata._id,
      serviceId: service._id,
      staffId: staff._id,
      startTimeUtc: afternoonSlotUtc
    });

    expect(match).not.toBeNull();
    expect(match._id.toString()).toBe(afternoonCandidate._id.toString());
  });
});
