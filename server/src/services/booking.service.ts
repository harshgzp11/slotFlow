import mongoose, { Types } from 'mongoose';
import crypto from 'crypto';
import { addMinutes } from 'date-fns';
import { Business } from '../models/Business';
import { Service } from '../models/Service';
import { Staff } from '../models/Staff';
import { Booking, IBooking, BookingSource, ICustomerDetails } from '../models/Booking';
import { SlotReservation } from '../models/SlotReservation';
import { RecoveryJob } from '../models/RecoveryJob';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../middleware/errorHandler';

export function generateReservationCells(params: {
  startTimeUtc: Date;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
}): Date[] {
  const { startTimeUtc, durationMinutes, bufferBefore, bufferAfter } = params;
  const blockStartUtc = addMinutes(startTimeUtc, -bufferBefore);
  const blockEndUtc = addMinutes(startTimeUtc, durationMinutes + bufferAfter);

  const cells: Date[] = [];
  let current = new Date(blockStartUtc);

  while (current.getTime() < blockEndUtc.getTime()) {
    cells.push(new Date(current));
    current = addMinutes(current, 15);
  }

  return cells;
}

export function verifyActionToken(storedHash: string, incomingToken: string): boolean {
  const incomingHash = crypto.createHash('sha256').update(incomingToken).digest('hex');
  const storedBuf = Buffer.from(storedHash, 'hex');
  const incomingBuf = Buffer.from(incomingHash, 'hex');

  if (storedBuf.length !== incomingBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuf, incomingBuf);
}

export async function createBooking(params: {
  businessId: Types.ObjectId;
  serviceId: Types.ObjectId;
  staffId: Types.ObjectId;
  startTimeUtc: Date;
  customer: ICustomerDetails;
  source?: BookingSource;
}): Promise<{ booking: IBooking; rawManageToken: string }> {
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

  // Validate qualification
  if (!service.qualifiedStaffIds.some((id) => id.equals(staff._id))) {
    throw new ValidationError('Selected staff member is not qualified for this service.');
  }

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
  const manageTokenExpiresAt = addMinutes(endTimeUtc, 30 * 24 * 60); // 30 days post-appointment

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
        reservationType: 'BOOKING' as const,
        bookingId: newBooking._id
      }));

      try {
        await SlotReservation.insertMany(reservationDocs, { session });
      } catch (err: any) {
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

export async function cancelBookingWithZeroGap(params: {
  bookingId: Types.ObjectId;
  businessId: Types.ObjectId;
  reason?: string;
  rawToken?: string; // Optional if cancelled by staff/owner
}): Promise<IBooking> {
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

      // If token provided (guest cancellation), verify it
      if (rawToken) {
        if (!verifyActionToken(booking.manageTokenHash, rawToken)) {
          throw new UnauthorizedError('Invalid management token.');
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

      // 4. Strict cell count assertion based on snapshot
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

export async function rescheduleBooking(params: {
  bookingId: Types.ObjectId;
  businessId: Types.ObjectId;
  newStartTimeUtc: Date;
  rawToken?: string;
}): Promise<IBooking> {
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

      if (rawToken && !verifyActionToken(booking.manageTokenHash, rawToken)) {
        throw new UnauthorizedError('Invalid management token.');
      }

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
        reservationType: 'BOOKING' as const,
        bookingId: booking._id
      }));

      try {
        await SlotReservation.insertMany(newReservationDocs, { session });
      } catch (err: any) {
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
