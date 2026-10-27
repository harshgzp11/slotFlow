import mongoose from 'mongoose';
import crypto from 'crypto';
import { addMinutes, isBefore, isAfter, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Business } from '../models/Business.js';
import { Service } from '../models/Service.js';
import { Staff } from '../models/Staff.js';
import { Booking } from '../models/Booking.js';
import { SlotReservation } from '../models/SlotReservation.js';
import { RecoveryJob } from '../models/RecoveryJob.js';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../middleware/errorHandler.js';
import { parseTimeToMinutes } from './availability.service.js';


/**
 * Generates an array of discrete 15-minute start timestamps for the full booking block
 * @param {Object} params
 * @param {Date} params.startTimeUtc
 * @param {number} params.durationMinutes
 * @param {number} params.bufferBefore
 * @param {number} params.bufferAfter
 * @returns {Date[]}
 */
export function generateReservationCells(params) {
  const { startTimeUtc, durationMinutes, bufferBefore, bufferAfter } = params;
  const blockStartUtc = addMinutes(startTimeUtc, -bufferBefore);
  const blockEndUtc = addMinutes(startTimeUtc, durationMinutes + bufferAfter);

  const cells = [];
  let current = new Date(blockStartUtc);

  while (current.getTime() < blockEndUtc.getTime()) {
    cells.push(new Date(current));
    current = addMinutes(current, 15);
  }

  return cells;
}

/**
 * Constant-time comparison between stored SHA-256 hash and incoming raw token
 * @param {string} storedHash
 * @param {string} incomingToken
 * @returns {boolean}
 */
export function verifyActionToken(storedHash, incomingToken) {
  if (!storedHash || !incomingToken) {
    return false;
  }
  const incomingHash = crypto.createHash('sha256').update(incomingToken).digest('hex');
  const storedBuf = Buffer.from(storedHash, 'hex');
  const incomingBuf = Buffer.from(incomingHash, 'hex');

  if (storedBuf.length !== incomingBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuf, incomingBuf);
}

/**
 * Server-side schedule validator for business hours, staff shifts, breaks, notice, horizon, qualification, and grid
 * @param {Object} params
 * @param {Object} params.business
 * @param {Object} params.service
 * @param {Object} params.staff
 * @param {Date} params.startTimeUtc
 */
export function validateBookingSchedule(params) {
  const { business, service, staff, startTimeUtc } = params;

  // 1. Validate 15-minute slot boundary alignment
  const minutes = startTimeUtc.getUTCMinutes();
  const seconds = startTimeUtc.getUTCSeconds();
  const ms = startTimeUtc.getUTCMilliseconds();
  if (minutes % 15 !== 0 || seconds !== 0 || ms !== 0) {
    throw new ValidationError(
      'Appointments must start on a 15-minute slot boundary (e.g., :00, :15, :30, :45).'
    );
  }

  // 2. Minimum advance notice enforcement
  const now = new Date();
  const minNoticeHours = business.bookingPolicies?.minNoticeHours ?? 0;
  if (minNoticeHours > 0) {
    const earliestAllowedUtc = addMinutes(now, minNoticeHours * 60);
    if (isBefore(startTimeUtc, earliestAllowedUtc)) {
      throw new ValidationError(
        `Appointment violates the minimum advance notice policy (${minNoticeHours} hours).`
      );
    }
  }

  // 3. Maximum booking horizon enforcement
  const maxHorizonDays = business.bookingPolicies?.maxHorizonDays;
  if (maxHorizonDays && maxHorizonDays > 0) {
    const latestAllowedUtc = addDays(now, maxHorizonDays);
    if (isAfter(startTimeUtc, latestAllowedUtc)) {
      throw new ValidationError(
        `Appointment exceeds the maximum booking horizon (${maxHorizonDays} days in advance).`
      );
    }
  }

  // 4. Staff qualification enforcement
  if (!service.qualifiedStaffIds.some((id) => id.toString() === staff._id.toString())) {
    throw new ValidationError('Selected staff member is not qualified for this service.');
  }

  // 5. Business hours enforcement in business timezone
  const tz = business.timezone || 'UTC';
  const dayOfWeek = parseInt(formatInTimeZone(startTimeUtc, tz, 'i'), 10) % 7; // 0 = Sun
  const businessDay = business.workingHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!businessDay || !businessDay.isOpen) {
    throw new ValidationError('The business is closed on the selected day.');
  }

  const localTimeStr = formatInTimeZone(startTimeUtc, tz, 'HH:mm');
  const startMinutes = parseTimeToMinutes(localTimeStr);
  const bufferBefore = service.bufferBefore || 0;
  const bufferAfter = service.bufferAfter || 0;
  const durationMinutes = service.durationMinutes;

  const blockStartMinutes = startMinutes - bufferBefore;
  const blockEndMinutes = startMinutes + durationMinutes + bufferAfter;

  const bizOpenMinutes = parseTimeToMinutes(businessDay.openTime);
  const bizCloseMinutes = parseTimeToMinutes(businessDay.closeTime);

  if (blockStartMinutes < bizOpenMinutes || blockEndMinutes > bizCloseMinutes) {
    throw new ValidationError(
      'Appointment and its buffers must fall entirely within business operating hours.'
    );
  }

  // 6. Staff shift schedule enforcement
  const staffDay = staff.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
  if (!staffDay || !staffDay.isWorking) {
    throw new ValidationError('Selected staff member is not scheduled to work on this day.');
  }

  const staffShiftStartMinutes = parseTimeToMinutes(staffDay.shiftStart);
  const staffShiftEndMinutes = parseTimeToMinutes(staffDay.shiftEnd);

  if (blockStartMinutes < staffShiftStartMinutes || blockEndMinutes > staffShiftEndMinutes) {
    throw new ValidationError(
      "Appointment and its buffers must fall entirely within the staff member's scheduled shift."
    );
  }

  // 7. Staff break collision enforcement
  const staffBreaks = (staffDay.breaks || []).map((b) => ({
    start: parseTimeToMinutes(b.start),
    end: parseTimeToMinutes(b.end)
  }));

  const collidesWithBreak = staffBreaks.some(
    (b) => Math.max(blockStartMinutes, b.start) < Math.min(blockEndMinutes, b.end)
  );
  if (collidesWithBreak) {
    throw new ValidationError(
      'Appointment or its buffers conflict with a scheduled staff break.'
    );
  }
}

/**
 * Creates a confirmed booking and reserves 15-minute cells atomically under transaction
 * @param {Object} params
 */
export async function createBooking(params) {
  const { businessId, serviceId, staffId, startTimeUtc, customer, source = 'PUBLIC' } = params;

  // 1. Fetch Service and Staff
  const [business, service, staff] = await Promise.all([
    Business.findOne({ _id: businessId, isActive: true }),
    Service.findOne({ _id: serviceId, businessId, isActive: true }),
    Staff.findOne({ _id: staffId, businessId, isActive: true })
  ]);

  if (!business) throw new NotFoundError('Business not found or inactive.');
  if (!service) throw new NotFoundError('Service not found or inactive.');
  if (!staff) throw new NotFoundError('Staff member not found or inactive.');

  // Validate appointment schedule strictly on server
  validateBookingSchedule({
    business,
    service,
    staff,
    startTimeUtc
  });


  const { durationMinutes, bufferBefore, bufferAfter, price } = service;
  const endTimeUtc = addMinutes(startTimeUtc, durationMinutes);

  // 2. Generate 15-minute discrete reservation cells
  const cellStartTimes = generateReservationCells({
    startTimeUtc,
    durationMinutes,
    bufferBefore,
    bufferAfter
  });

  const expectedCellCount = cellStartTimes.length;

  // 3. Generate secure guest manage token
  const rawManageToken = crypto.randomBytes(32).toString('hex');
  const manageTokenHash = crypto.createHash('sha256').update(rawManageToken).digest('hex');
  const manageTokenExpiresAt = addMinutes(endTimeUtc, 30 * 24 * 60);

  // 4. ATOMIC TRANSACTION: Insert reservation cells and booking
  const session = await mongoose.startSession();
  try {
    const booking = await session.withTransaction(async () => {
      // Create Booking with immutable snapshots
      const [newBooking] = await Booking.create(
        [
          {
            businessId,
            serviceId,
            staffId,
            customer,
            startTimeUtc,
            endTimeUtc,
            status: 'CONFIRMED',
            source,
            priceSnapshot: price,
            durationMinutesSnapshot: durationMinutes,
            bufferBeforeSnapshot: bufferBefore,
            bufferAfterSnapshot: bufferAfter,
            reservationCellCountSnapshot: expectedCellCount,
            manageTokenHash,
            manageTokenExpiresAt
          }
        ],
        { session }
      );

      // Reserve all 15-minute discrete cells under the compound unique index
      const reservationDocs = cellStartTimes.map((cellTime) => ({
        businessId,
        staffId,
        slotStartTimeUtc: cellTime,
        reservationType: 'BOOKING',
        bookingId: newBooking._id
      }));

      try {
        await SlotReservation.insertMany(reservationDocs, { session });
      } catch (err) {
        if (err.code === 11000) {
          throw new ConflictError(
            'The selected time slot is no longer available. Please select another time.'
          );
        }
        throw err;
      }

      return newBooking;
    });

    return { booking, rawManageToken };
  } finally {
    await session.endSession();
  }
}

/**
 * Cancels a booking with ZERO GAP: converts cells directly to RECOVERY_PENDING hold
 * @param {Object} params
 */
export async function cancelBookingWithZeroGap(params) {
  const { bookingId, businessId, reason, rawToken } = params;

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: bookingId,
        businessId
      }).session(session);

      if (!booking) {
        throw new NotFoundError('Booking not found.');
      }

      if (booking.status !== 'CONFIRMED') {
        throw new ConflictError(`Cannot cancel booking with current status: ${booking.status}`);
      }

      // If token provided (guest cancellation), verify it and check expiration
      if (rawToken) {
        if (!verifyActionToken(booking.manageTokenHash, rawToken)) {
          throw new UnauthorizedError('Invalid management token.');
        }
        if (booking.manageTokenExpiresAt && booking.manageTokenExpiresAt < new Date()) {
          throw new UnauthorizedError('Management token has expired.');
        }
      }

      // 1. Mark booking as CANCELLED
      booking.status = 'CANCELLED';
      booking.cancellationReason = reason || 'Customer requested cancellation';
      booking.cancelledAtUtc = new Date();
      await booking.save({ session });

      // 2. Create durable RecoveryJob for outbox processing
      const [recoveryJob] = await RecoveryJob.create(
        [
          {
            businessId,
            bookingId: booking._id,
            vacatedInterval: {
              staffId: booking.staffId,
              serviceId: booking.serviceId,
              startTimeUtc: booking.startTimeUtc,
              endTimeUtc: booking.endTimeUtc,
              vacatedDurationMinutes: booking.durationMinutesSnapshot
            },
            status: 'PENDING',
            lockedUntil: null,
            retryCount: 0
          }
        ],
        { session }
      );

      // 3. ZERO GAP: Atomically convert BOOKING cells to RECOVERY_PENDING HOLD
      const updateResult = await SlotReservation.updateMany(
        {
          businessId,
          bookingId: booking._id,
          reservationType: 'BOOKING'
        },
        {
          $set: {
            reservationType: 'HOLD',
            holdType: 'RECOVERY_PENDING',
            recoveryJobId: recoveryJob._id,
            updatedAt: new Date()
          },
          $unset: { bookingId: 1 }
        },
        { session }
      );

      // 4. Strict cell count assertion based on immutable snapshot
      if (updateResult.modifiedCount !== booking.reservationCellCountSnapshot) {
        throw new ConflictError(
          `Cancellation cell count mismatch: expected ${booking.reservationCellCountSnapshot}, converted ${updateResult.modifiedCount}. Transaction aborted.`
        );
      }

      return booking;
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Reschedules a booking to a new start time
 * @param {Object} params
 */
export async function rescheduleBooking(params) {
  const { bookingId, businessId, newStartTimeUtc, rawToken } = params;

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: bookingId,
        businessId
      }).session(session);

      if (!booking) throw new NotFoundError('Booking not found.');
      if (booking.status !== 'CONFIRMED') {
        throw new ConflictError(`Cannot reschedule booking with status: ${booking.status}`);
      }

      if (rawToken) {
        if (!verifyActionToken(booking.manageTokenHash, rawToken)) {
          throw new UnauthorizedError('Invalid management token.');
        }
        if (booking.manageTokenExpiresAt && booking.manageTokenExpiresAt < new Date()) {
          throw new UnauthorizedError('Management token has expired.');
        }
      }

      const [business, service, staff] = await Promise.all([
        Business.findOne({ _id: businessId, isActive: true }).session(session),
        Service.findOne({ _id: booking.serviceId, businessId, isActive: true }).session(session),
        Staff.findOne({ _id: booking.staffId, businessId, isActive: true }).session(session)
      ]);

      if (!business) throw new NotFoundError('Business not found or inactive.');
      if (!service) throw new NotFoundError('Service not found or inactive.');
      if (!staff) throw new NotFoundError('Staff member not found or inactive.');

      validateBookingSchedule({
        business,
        service,
        staff,
        startTimeUtc: newStartTimeUtc
      });

      const newEndTimeUtc = addMinutes(newStartTimeUtc, booking.durationMinutesSnapshot);

      // 1. Generate new cells
      const newCellTimes = generateReservationCells({
        startTimeUtc: newStartTimeUtc,
        durationMinutes: booking.durationMinutesSnapshot,
        bufferBefore: booking.bufferBeforeSnapshot,
        bufferAfter: booking.bufferAfterSnapshot
      });

      // 2. Release old cells
      await SlotReservation.deleteMany(
        {
          businessId,
          bookingId: booking._id
        },
        { session }
      );

      // 3. Reserve new cells
      const newReservationDocs = newCellTimes.map((cellTime) => ({
        businessId,
        staffId: booking.staffId,
        slotStartTimeUtc: cellTime,
        reservationType: 'BOOKING',
        bookingId: booking._id
      }));

      try {
        await SlotReservation.insertMany(newReservationDocs, { session });
      } catch (err) {
        if (err.code === 11000) {
          throw new ConflictError(
            'The newly selected time slot is already booked. Please choose another time.'
          );
        }
        throw err;
      }

      // 4. Update booking timestamps
      booking.startTimeUtc = newStartTimeUtc;
      booking.endTimeUtc = newEndTimeUtc;
      await booking.save({ session });

      return booking;
    });
  } finally {
    await session.endSession();
  }
}
