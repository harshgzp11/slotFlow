import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { validateBookingSchedule } from '../../src/services/booking.service.js';
import { ValidationError } from '../../src/middleware/errorHandler.js';

describe('Booking Schedule Enforcement (Finding 2)', () => {
  const staffId = new mongoose.Types.ObjectId();
  const unqualifiedStaffId = new mongoose.Types.ObjectId();

  const business = {
    timezone: 'UTC',
    workingHours: [
      { dayOfWeek: 0, isOpen: false, openTime: '10:00', closeTime: '16:00' }, // Sunday closed
      { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '18:00' },  // Monday 9-18
      { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '18:00' }
    ],
    bookingPolicies: {
      minNoticeHours: 2,
      maxHorizonDays: 14
    }
  };

  const service = {
    durationMinutes: 45,
    bufferBefore: 15, // 1 cell before
    bufferAfter: 15,  // 1 cell after -> total block: 75 minutes
    qualifiedStaffIds: [staffId]
  };

  const staff = {
    _id: staffId,
    weeklySchedule: [
      { dayOfWeek: 0, isWorking: false, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] },
      {
        dayOfWeek: 1,
        isWorking: true,
        shiftStart: '09:00',
        shiftEnd: '17:00',
        breaks: [{ start: '12:00', end: '13:00' }] // Lunch break 12:00 to 13:00
      }
    ]
  };

  it('rejects appointments not aligned to 15-minute grid boundaries (e.g. :07, :12)', () => {
    // 2026-11-02 is Monday
    const unalignedTime = new Date('2026-11-02T10:07:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: unalignedTime
      })
    ).toThrowError(ValidationError);

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: unalignedTime
      })
    ).toThrow(/15-minute slot boundary/);
  });

  it('rejects appointments violating minimum advance notice policy', () => {
    // 30 minutes in the future (policy requires 2 hours notice)
    const now = new Date();
    const noticeViolation = new Date(now.getTime() + 30 * 60 * 1000);
    // Align minutes to 00
    noticeViolation.setMinutes(0, 0, 0);

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: noticeViolation
      })
    ).toThrowError(ValidationError);

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: noticeViolation
      })
    ).toThrow(/minimum advance notice policy/);
  });

  it('rejects appointments beyond maximum booking horizon', () => {
    // 20 days in the future (policy allows max 14 days)
    const now = new Date();
    const horizonViolation = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    horizonViolation.setMinutes(0, 0, 0);

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: horizonViolation
      })
    ).toThrowError(ValidationError);

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: horizonViolation
      })
    ).toThrow(/maximum booking horizon/);
  });

  it('rejects appointments when staff is not qualified for the service', () => {
    const unqualifiedStaff = {
      ...staff,
      _id: unqualifiedStaffId
    };
    const validTime = new Date('2026-11-02T10:00:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff: unqualifiedStaff,
        startTimeUtc: validTime
      })
    ).toThrow(/not qualified/);
  });

  it('rejects appointments on days when business is closed', () => {
    // 2026-11-01 is Sunday (closed)
    const sundayTime = new Date('2026-11-01T11:00:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: sundayTime
      })
    ).toThrow(/business is closed/);
  });

  it('rejects appointments where bufferBefore starts before business opening hours', () => {
    // Monday business opens at 09:00. Appointment at 09:00 with 15m bufferBefore starts at 08:45
    const earlyTime = new Date('2026-11-02T09:00:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: earlyTime
      })
    ).toThrow(/fall entirely within business operating hours/);
  });

  it('rejects appointments where duration + bufferAfter extends past business close', () => {
    // Business closes at 18:00. Appointment at 17:15 + 45m duration + 15m buffer = 18:15
    const lateTime = new Date('2026-11-02T17:15:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: lateTime
      })
    ).toThrow(/operating hours/);
  });

  it('rejects appointments when staff is not scheduled to work that day', () => {
    // Sunday staff isWorking = false
    const closedStaffBiz = {
      ...business,
      workingHours: [{ dayOfWeek: 0, isOpen: true, openTime: '09:00', closeTime: '17:00' }]
    };
    const sundayTime = new Date('2026-11-01T10:00:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business: closedStaffBiz,
        service,
        staff,
        startTimeUtc: sundayTime
      })
    ).toThrow(/not scheduled to work/);
  });

  it('rejects appointments where bufferBefore starts before staff shiftStart', () => {
    // Business is open 08:00 to 20:00, but staff shift begins at 10:00
    const earlyBiz = {
      ...business,
      workingHours: [{ dayOfWeek: 1, isOpen: true, openTime: '08:00', closeTime: '20:00' }]
    };
    const lateStaff = {
      ...staff,
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '10:00', shiftEnd: '18:00', breaks: [] }
      ]
    };
    // Appointment at 10:00 with 15m bufferBefore starts at 09:45 (before 10:00 shiftStart)
    const appointmentAtShiftStart = new Date('2026-11-02T10:00:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business: earlyBiz,
        service,
        staff: lateStaff,
        startTimeUtc: appointmentAtShiftStart
      })
    ).toThrow(/scheduled shift/);
  });

  it('rejects appointments where bufferAfter extends past staff shiftEnd', () => {
    // Business is open until 20:00, but staff shift ends at 16:00
    const lateBiz = {
      ...business,
      workingHours: [{ dayOfWeek: 1, isOpen: true, openTime: '08:00', closeTime: '20:00' }]
    };
    const earlyStaff = {
      ...staff,
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '16:00', breaks: [] }
      ]
    };
    // Appointment at 15:15 + 45m duration + 15m bufferAfter = 16:15 (past 16:00 shiftEnd)
    const appointmentAtShiftEnd = new Date('2026-11-02T15:15:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business: lateBiz,
        service,
        staff: earlyStaff,
        startTimeUtc: appointmentAtShiftEnd
      })
    ).toThrow(/scheduled shift/);
  });

  it('rejects appointments that collide with staff breaks', () => {
    // Break is 12:00 to 13:00. Appointment at 12:15 collides directly
    const breakCollision = new Date('2026-11-02T12:15:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: breakCollision
      })
    ).toThrow(/scheduled staff break/);
  });

  it('rejects appointments where bufferBefore collides with staff break end', () => {
    // Break is 12:00 to 13:00. Appointment at 13:00 with bufferBefore of 15m begins at 12:45 (collides!)
    const breakBufferCollision = new Date('2026-11-02T13:00:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: breakBufferCollision
      })
    ).toThrow(/scheduled staff break/);
  });

  it('accepts valid appointments that satisfy all business, shift, break, notice, horizon, and buffer constraints', () => {
    // Appointment at 10:00 on Monday. BufferBefore is 09:45 (after 09:00).
    // Ends at 10:45 + 15m buffer = 11:00 (before 12:00 lunch break).
    const validSlot = new Date('2026-11-02T10:00:00.000Z');

    expect(() =>
      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: validSlot
      })
    ).not.toThrow();
  });
});
