import crypto from 'crypto';
import mongoose from 'mongoose';
import { RecoveryJob } from '../models/RecoveryJob.js';
import { WaitlistEntry } from '../models/WaitlistEntry.js';
import { WaitlistOffer } from '../models/WaitlistOffer.js';
import { SlotReservation } from '../models/SlotReservation.js';
import { Booking } from '../models/Booking.js';
import { Service } from '../models/Service.js';
import { Business } from '../models/Business.js';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../middleware/errorHandler.js';



export function hashClaimToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Constant-time comparison between stored SHA-256 hash and incoming raw claim token
 * @param {string} storedHash
 * @param {string} incomingToken
 * @returns {boolean}
 */
export function verifyClaimToken(storedHash, incomingToken) {
  if (!storedHash || !incomingToken) return false;
  const incomingHash = hashClaimToken(incomingToken);
  const storedBuf = Buffer.from(storedHash, 'hex');
  const incomingBuf = Buffer.from(incomingHash, 'hex');

  if (storedBuf.length !== 32 || incomingBuf.length !== 32) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuf, incomingBuf);
}


/**
 * Claims a pending or expired-lease RecoveryJob using atomic lease fencing
 * @param {string} workerId - Unique ID of the processing worker
 * @param {number} leaseDurationMs - Lease lifetime in milliseconds (default 30,000)
 */
export async function claimRecoveryJob(workerId, leaseDurationMs = 30000) {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
  const leaseToken = crypto.randomUUID();

  const job = await RecoveryJob.findOneAndUpdate(
    {
      status: { $in: ['PENDING', 'PROCESSING'] },
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }]
    },
    {
      $set: {
        status: 'PROCESSING',
        leaseToken,
        lockedByWorkerId: workerId,
        lockedUntil: leaseExpiresAt
      },
      $inc: { retryCount: 1 }
    },
    { new: true }
  );

  return job;
}

/**
 * Deterministically finds the highest ranked eligible candidate for a vacated interval
 * @param {Object} params
 */
export async function findNextEligibleCandidate(params) {
  const { businessId, serviceId, staffId, startTimeUtc, excludeEntryIds = [], session } = params;

  // 1. Fetch business timezone to evaluate time-of-day preference
  const business = await Business.findById(businessId).session(session || null);
  const tz = business?.timezone || 'UTC';

  // Calculate local hour of vacated start time deterministically in business timezone
  const localHour = parseInt(formatInTimeZone(startTimeUtc, tz, 'H'), 10);

  let targetTimeOfDay = 'ANY';
  if (localHour < 12) {
    targetTimeOfDay = 'MORNING';
  } else if (localHour < 17) {
    targetTimeOfDay = 'AFTERNOON';
  } else {
    targetTimeOfDay = 'EVENING';
  }

  // 2. Query candidates: matching business, service, status WAITING, preferredStaff (null or staffId)
  const candidateQuery = {
    businessId,
    serviceId,
    status: 'WAITING',
    $or: [{ preferredStaffId: null }, { preferredStaffId: staffId }]
  };

  if (excludeEntryIds.length > 0) {
    candidateQuery._id = { $nin: excludeEntryIds };
  }

  // Fetch candidates sorted deterministically by priorityScore desc, then createdAt asc
  let query = WaitlistEntry.find(candidateQuery).sort({ priorityScore: -1, createdAt: 1 });
  if (session) {
    query = query.session(session);
  }
  const candidates = await query;

  // 3. Filter candidates by date window (with flexibleDays expansion) and time of day in business timezone
  for (const candidate of candidates) {
    const flexDays = candidate.flexibleDays || 0;
    const flexMs = flexDays * 24 * 60 * 60 * 1000;

    const startDateStr = candidate.preferredDateRange.startDate.toISOString().slice(0, 10);
    const endDateStr = candidate.preferredDateRange.endDate.toISOString().slice(0, 10);

    const windowStartUtc = new Date(
      fromZonedTime(`${startDateStr}T00:00:00`, tz).getTime() - flexMs
    );
    const windowEndUtc = new Date(
      fromZonedTime(`${endDateStr}T23:59:59.999`, tz).getTime() + flexMs
    );

    if (startTimeUtc < windowStartUtc || startTimeUtc > windowEndUtc) {
      continue;
    }

    // Check time of day preference
    if (
      candidate.timeOfDayPreference !== 'ANY' &&
      candidate.timeOfDayPreference !== targetTimeOfDay
    ) {
      continue;
    }

    // Candidate matches all criteria
    return candidate;
  }

  return null;
}

/**
 * Processes a claimed recovery job: finds candidate and creates an offer, or releases hold cells
 * @param {Object} job - Claimed RecoveryJob document
 * @param {string} workerId - Claiming worker ID
 * @param {number} offerDurationMinutes - How long candidate has to claim (default 15 mins)
 */
export async function processClaimedRecoveryJob(job, workerId, offerDurationMinutes = 15) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      // 1. Worker Lease Fencing Check inside transaction: abort if lease was lost
      const fencedCheck = await RecoveryJob.updateOne(
        {
          _id: job._id,
          leaseToken: job.leaseToken,
          lockedByWorkerId: workerId
        },
        { $set: { updatedAt: new Date() } },
        { session }
      );

      if (fencedCheck.matchedCount === 0) {
        throw new ConflictError(
          'Recovery worker lease expired or preempted by another worker. Transaction aborted.'
        );
      }

      // 2. Find any candidates already offered for this recovery job to avoid offering to the same candidate
      const existingOffers = await WaitlistOffer.find({ recoveryJobId: job._id }).session(session);
      const excludedCandidateIds = existingOffers.map((o) => o.waitlistEntryId);

      // 3. Find next candidate
      const candidate = await findNextEligibleCandidate({
        businessId: job.businessId,
        serviceId: job.vacatedInterval.serviceId,
        staffId: job.vacatedInterval.staffId,
        startTimeUtc: job.vacatedInterval.startTimeUtc,
        excludeEntryIds: excludedCandidateIds,
        session
      });

      // Find the held reservation cells
      const heldCells = await SlotReservation.find({
        businessId: job.businessId,
        recoveryJobId: job._id,
        reservationType: 'HOLD'
      }).session(session);

      if (!candidate) {
        // NO CANDIDATES: Release all held reservation cells back to public capacity
        if (heldCells.length > 0) {
          await SlotReservation.deleteMany(
            { _id: { $in: heldCells.map((c) => c._id) } },
            { session }
          );
        }

        job.status = 'NO_CANDIDATES';
        job.lockedUntil = null;
        await job.save({ session });

        return { status: 'NO_CANDIDATES', releasedCellsCount: heldCells.length };
      }

      // CANDIDATE FOUND: Create offer and transfer hold cells
      const rawClaimToken = crypto.randomBytes(24).toString('hex');
      const claimTokenHash = hashClaimToken(rawClaimToken);
      const expiresAt = new Date(Date.now() + offerDurationMinutes * 60 * 1000);

      const [offer] = await WaitlistOffer.create(
        [
          {
            businessId: job.businessId,
            waitlistEntryId: candidate._id,
            recoveryJobId: job._id,
            serviceId: job.vacatedInterval.serviceId,
            staffId: job.vacatedInterval.staffId,
            offeredInterval: {
              startTimeUtc: job.vacatedInterval.startTimeUtc,
              endTimeUtc: job.vacatedInterval.endTimeUtc,
              durationMinutes: job.vacatedInterval.vacatedDurationMinutes,
              reservationCellCount: heldCells.length
            },
            claimTokenHash,
            expiresAt,
            status: 'PENDING',
            holdSlotReservationIds: heldCells.map((c) => c._id)
          }
        ],
        { session }
      );

      // Atomically transfer hold cells to this offer
      await SlotReservation.updateMany(
        { _id: { $in: heldCells.map((c) => c._id) } },
        {
          $set: {
            holdType: 'OFFER',
            holdOfferId: offer._id,
            holdExpiresAtUtc: expiresAt
          }
        },
        { session }
      );

      // Update candidate waitlist status
      candidate.status = 'OFFERED';
      candidate.offersCount = (candidate.offersCount || 0) + 1;
      candidate.lastOfferedAt = new Date();
      await candidate.save({ session });

      // Keep job in PROCESSING until accepted or completed
      job.status = 'PROCESSING';
      job.lockedUntil = expiresAt; // Keep locked for duration of offer
      await job.save({ session });

      return {
        status: 'OFFER_CREATED',
        offerId: offer._id,
        candidateEmail: candidate.customer.email,
        rawClaimToken,
        expiresAt
      };
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Atomically accepts a waitlist recovery offer and converts hold cells into a confirmed booking
 * @param {Object} params
 */
export async function acceptWaitlistOffer(params) {
  const { offerId, rawClaimToken } = params;

  if (!offerId || !rawClaimToken) {
    throw new ValidationError('offerId and claimToken are required.');
  }

  const claimTokenHash = hashClaimToken(rawClaimToken);
  const now = new Date();

  // Check offer validity first
  const initialOffer = await WaitlistOffer.findById(offerId);
  if (!initialOffer) {
    throw new NotFoundError('Waitlist offer not found.');
  }

  if (!verifyClaimToken(initialOffer.claimTokenHash, rawClaimToken)) {
    throw new UnauthorizedError('Invalid claim token for this offer.');
  }

  if (initialOffer.status !== 'PENDING') {
    throw new ConflictError(`Offer is no longer active (status: ${initialOffer.status}).`);
  }

  // Handle offer expiration with safeguard: persist EXPIRED, then return/throw 409
  if (initialOffer.expiresAt < now) {
    await handleOfferExpired(initialOffer._id);
    throw new ConflictError('This recovery offer has expired and the slot was offered to the next candidate.');
  }

  // Execute atomic conversion transaction
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const offer = await WaitlistOffer.findOne({
        _id: offerId,
        status: 'PENDING'
      }).session(session);

      if (!offer) {
        throw new ConflictError('Offer is no longer available.');
      }

      // Re-verify token inside transaction
      if (!verifyClaimToken(offer.claimTokenHash, rawClaimToken)) {
        throw new UnauthorizedError('Invalid claim token for this offer.');
      }

      // Recheck status and expiresAt inside the transaction to eliminate race conditions
      if (offer.expiresAt < new Date()) {
        offer.status = 'EXPIRED';
        offer.responseReceivedAt = new Date();
        await offer.save({ session });

        await WaitlistEntry.updateOne(
          { _id: offer.waitlistEntryId, status: 'OFFERED' },
          { $set: { status: 'EXPIRED' } },
          { session }
        );

        await SlotReservation.updateMany(
          { _id: { $in: offer.holdSlotReservationIds } },
          {
            $set: {
              holdType: 'RECOVERY_PENDING',
              recoveryJobId: offer.recoveryJobId
            },
            $unset: {
              holdOfferId: 1,
              holdExpiresAtUtc: 1
            }
          },
          { session }
        );

        await RecoveryJob.updateOne(
          { _id: offer.recoveryJobId },
          { $set: { status: 'PENDING', lockedUntil: null, leaseToken: null } },
          { session }
        );

        throw new ConflictError('This recovery offer has expired and the slot was released for reassignment.');
      }

      const waitlistEntry = await WaitlistEntry.findById(offer.waitlistEntryId).session(session);
      if (!waitlistEntry) {
        throw new NotFoundError('Waitlist candidate profile not found.');
      }

      const service = await Service.findById(offer.serviceId).session(session);
      if (!service) {
        throw new NotFoundError('Service not found.');
      }

      // Generate action manage token for the new booking
      const rawManageToken = crypto.randomBytes(32).toString('hex');
      const manageTokenHash = crypto.createHash('sha256').update(rawManageToken).digest('hex');
      const manageTokenExpiresAt = new Date(offer.offeredInterval.startTimeUtc.getTime() + 86400000);

      // 1. Create confirmed booking with immutable snapshots
      const [booking] = await Booking.create(
        [
          {
            businessId: offer.businessId,
            serviceId: offer.serviceId,
            staffId: offer.staffId,
            startTimeUtc: offer.offeredInterval.startTimeUtc,
            endTimeUtc: offer.offeredInterval.endTimeUtc,
            customer: waitlistEntry.customer,
            totalPrice: service.price,
            status: 'CONFIRMED',
            source: 'WAITLIST_RECOVERY',
            priceSnapshot: service.price,
            durationMinutesSnapshot: offer.offeredInterval.durationMinutes,
            bufferBeforeSnapshot: service.bufferBefore,
            bufferAfterSnapshot: service.bufferAfter,
            reservationCellCountSnapshot: offer.offeredInterval.reservationCellCount,
            manageTokenHash,
            manageTokenExpiresAt
          }
        ],
        { session }
      );

      // 2. Convert held reservation cells to BOOKING
      const updateResult = await SlotReservation.updateMany(
        {
          _id: { $in: offer.holdSlotReservationIds },
          reservationType: 'HOLD'
        },
        {
          $set: {
            reservationType: 'BOOKING',
            bookingId: booking._id,
            updatedAt: new Date()
          },
          $unset: {
            holdType: 1,
            holdOfferId: 1,
            recoveryJobId: 1,
            holdExpiresAtUtc: 1
          }
        },
        { session }
      );

      // Verify exact cell count conversion
      if (updateResult.modifiedCount !== offer.offeredInterval.reservationCellCount) {
        throw new ConflictError(
          `Offer conversion cell count mismatch: expected ${offer.offeredInterval.reservationCellCount}, converted ${updateResult.modifiedCount}. Transaction aborted.`
        );
      }

      // 3. Mark offer accepted
      offer.status = 'ACCEPTED';
      offer.responseReceivedAt = new Date();
      await offer.save({ session });

      // 4. Mark waitlist entry confirmed
      waitlistEntry.status = 'CONFIRMED';
      await waitlistEntry.save({ session });

      // 5. Complete recovery job
      await RecoveryJob.updateOne(
        { _id: offer.recoveryJobId },
        { $set: { status: 'COMPLETED', lockedUntil: null } },
        { session }
      );

      return { booking, rawManageToken };
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Handles expiration of an offer: marks EXPIRED, reassigns to next candidate, or releases cells
 * @param {string|ObjectId} offerId
 */
export async function handleOfferExpired(offerId) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const offer = await WaitlistOffer.findOne({
        _id: offerId,
        status: 'PENDING'
      }).session(session);

      if (!offer) return null;

      // 1. Mark offer EXPIRED
      offer.status = 'EXPIRED';
      offer.responseReceivedAt = new Date();
      await offer.save({ session });

      // 2. Mark candidate EXPIRED
      await WaitlistEntry.updateOne(
        { _id: offer.waitlistEntryId, status: 'OFFERED' },
        { $set: { status: 'EXPIRED' } },
        { session }
      );

      // 3. Reset hold cells back to RECOVERY_PENDING under recoveryJobId
      await SlotReservation.updateMany(
        { _id: { $in: offer.holdSlotReservationIds } },
        {
          $set: {
            holdType: 'RECOVERY_PENDING',
            recoveryJobId: offer.recoveryJobId
          },
          $unset: {
            holdOfferId: 1,
            holdExpiresAtUtc: 1
          }
        },
        { session }
      );

      // 4. Unlock RecoveryJob so next worker iteration claims it
      await RecoveryJob.updateOne(
        { _id: offer.recoveryJobId },
        { $set: { status: 'PENDING', lockedUntil: null, leaseToken: null } },
        { session }
      );

      return offer;
    });
  } finally {
    await session.endSession();
  }
}

/**
 * Declines an offer: marks DECLINED and immediately unlocks recovery job for reassignment
 * @param {string|ObjectId} offerId
 * @param {string} rawClaimToken
 */
export async function declineWaitlistOffer(offerId, rawClaimToken) {
  if (!offerId || !rawClaimToken) {
    throw new ValidationError('offerId and claimToken are required.');
  }

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const offer = await WaitlistOffer.findOne({
        _id: offerId,
        status: 'PENDING'
      }).session(session);

      if (!offer || !verifyClaimToken(offer.claimTokenHash, rawClaimToken)) {
        throw new NotFoundError('Active offer not found or token invalid.');
      }

      // Mark offer declined
      offer.status = 'DECLINED';
      offer.responseReceivedAt = new Date();
      await offer.save({ session });

      // Mark candidate cancelled/declined
      await WaitlistEntry.updateOne(
        { _id: offer.waitlistEntryId },
        { $set: { status: 'CANCELLED' } },
        { session }
      );

      // Reset hold cells back to RECOVERY_PENDING under recoveryJobId
      await SlotReservation.updateMany(
        { _id: { $in: offer.holdSlotReservationIds } },
        {
          $set: {
            holdType: 'RECOVERY_PENDING',
            recoveryJobId: offer.recoveryJobId
          },
          $unset: {
            holdOfferId: 1,
            holdExpiresAtUtc: 1
          }
        },
        { session }
      );

      // Unlock RecoveryJob so it can be re-assigned
      await RecoveryJob.updateOne(
        { _id: offer.recoveryJobId },
        { $set: { status: 'PENDING', lockedUntil: null, leaseToken: null } },
        { session }
      );

      return offer;
    });
  } finally {
    await session.endSession();
  }
}
