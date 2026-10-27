import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Business } from '../../src/models/Business.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { getAvailableSlots } from '../../src/services/availability.service.js';

describe('Staff Qualification in Availability (Finding 4 Regression Test)', () => {
  let business;
  let qualifiedStaff;
  let unqualifiedStaff;
  let service;

  beforeEach(async () => {
    business = await Business.create({
      name: 'Qualification Test Salon',
      slug: `qual-salon-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timezone: 'UTC',
      currency: 'USD',
      workingHours: [
        { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' } // Monday open
      ],
      bookingPolicies: {
        minNoticeHours: 0,
        maxHorizonDays: 30
      }
    });

    qualifiedStaff = await Staff.create({
      businessId: business._id,
      displayName: 'Senior Stylist Alice',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] }
      ]
    });

    unqualifiedStaff = await Staff.create({
      businessId: business._id,
      displayName: 'Junior Apprentice Bob',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] }
      ]
    });

    service = await Service.create({
      businessId: business._id,
      name: 'Advanced Balayage',
      durationMinutes: 60,
      bufferBefore: 0,
      bufferAfter: 0,
      price: 250,
      qualifiedStaffIds: [qualifiedStaff._id] // ONLY Alice is qualified!
    });
  });

  it('returns available slots when requesting with qualified staffId', async () => {
    // 2026-11-02 is Monday
    const slots = await getAvailableSlots({
      businessId: business._id,
      serviceId: service._id,
      dateStr: '2026-11-02',
      staffId: qualifiedStaff._id
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.staffId.toString() === qualifiedStaff._id.toString())).toBe(true);
  });

  it('preserves qualifiedStaffIds filter and returns empty array when unqualified staffId is requested', async () => {
    // Bob is working on Monday, but NOT qualified for Advanced Balayage
    const slots = await getAvailableSlots({
      businessId: business._id,
      serviceId: service._id,
      dateStr: '2026-11-02',
      staffId: unqualifiedStaff._id
    });

    expect(slots).toEqual([]);
    expect(slots.length).toBe(0);
  });
});
