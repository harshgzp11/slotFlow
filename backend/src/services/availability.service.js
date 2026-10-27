import mongoose from 'mongoose';
import { Business } from '../models/Business.js';
import { Service } from '../models/Service.js';
import { Staff } from '../models/Staff.js';
import { SlotReservation } from '../models/SlotReservation.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addMinutes, isBefore } from 'date-fns';

/**
 * Converts a "HH:mm" time string into total minutes from midnight
 * @param {string} timeStr
 * @returns {number}
 */
export function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts total minutes from midnight into "HH:mm" string
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Calculates candidate availability slots applying both-side buffers
 * @param {Object} params
 * @param {import('mongoose').Types.ObjectId} params.businessId
 * @param {import('mongoose').Types.ObjectId} params.serviceId
 * @param {string} params.dateStr - "YYYY-MM-DD"
 * @param {import('mongoose').Types.ObjectId} [params.staffId]
 */
export async function getAvailableSlots(params) {
  const { businessId, serviceId, dateStr, staffId } = params;

  // 1. Fetch Business
  const business = await Business.findById(businessId);
  if (!business || !business.isActive) {
    throw new NotFoundError('Business workspace not found or inactive.');
  }

  // 2. Fetch Service
  const service = await Service.findOne({ _id: serviceId, businessId, isActive: true });
  if (!service) {
    throw new NotFoundError('Service not found or inactive.');
  }

  const { durationMinutes, bufferBefore, bufferAfter, price } = service;

  // 3. Determine Day of Week in Business Timezone
  const localDateNoon = fromZonedTime(`${dateStr}T12:00:00`, business.timezone);
  const dayOfWeek = parseInt(formatInTimeZone(localDateNoon, business.timezone, 'i'), 10) % 7; // 0 = Sun

  const businessDay = business.workingHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!businessDay || !businessDay.isOpen) {
    return []; // Business closed on this day
  }

  const bizOpenMinutes = parseTimeToMinutes(businessDay.openTime);
  const bizCloseMinutes = parseTimeToMinutes(businessDay.closeTime);

  // 4. Resolve Eligible Staff
  if (staffId) {
    const isQualified = service.qualifiedStaffIds.some(
      (id) => id.toString() === staffId.toString()
    );
    if (!isQualified) {
      return [];
    }
  }

  let staffQuery = {
    businessId,
    isActive: true,
    _id: staffId ? staffId : { $in: service.qualifiedStaffIds }
  };

  const eligibleStaff = await Staff.find(staffQuery);
  if (eligibleStaff.length === 0) {
    return [];
  }

  // 5. Pre-fetch all occupied SlotReservations for this business on this day
  const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, business.timezone);
  const dayEndUtc = fromZonedTime(`${dateStr}T23:59:59.999`, business.timezone);

  const occupiedReservations = await SlotReservation.find({
    businessId,
    staffId: { $in: eligibleStaff.map((s) => s._id) },
    slotStartTimeUtc: {
      $gte: addMinutes(dayStartUtc, -bufferBefore),
      $lte: addMinutes(dayEndUtc, bufferAfter)
    }
  }).select('staffId slotStartTimeUtc reservationType holdExpiresAtUtc');

  // Set of occupied keys: "staffId_isoTime"
  const occupiedSet = new Set();
  const now = new Date();

  for (const res of occupiedReservations) {
    occupiedSet.add(`${res.staffId.toString()}_${res.slotStartTimeUtc.toISOString()}`);
  }

  const nowPlusNotice = addMinutes(now, business.bookingPolicies.minNoticeHours * 60);

  const availableSlots = [];

  // 6. Generate candidate slots for each staff member
  for (const staffMember of eligibleStaff) {
    const staffDay = staffMember.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
    if (!staffDay || !staffDay.isWorking) {
      continue;
    }

    const staffShiftStartMinutes = parseTimeToMinutes(staffDay.shiftStart);
    const staffShiftEndMinutes = parseTimeToMinutes(staffDay.shiftEnd);

    // Effective working window is intersection of business hours and staff shift
    const windowStartMinutes = Math.max(bizOpenMinutes, staffShiftStartMinutes);
    const windowEndMinutes = Math.min(bizCloseMinutes, staffShiftEndMinutes);

    // Breaks in minutes
    const staffBreaks = (staffDay.breaks || []).map((b) => ({
      start: parseTimeToMinutes(b.start),
      end: parseTimeToMinutes(b.end)
    }));

    // Iterate through candidate start times in 15-minute grid
    for (
      let candidateStart = windowStartMinutes;
      candidateStart + durationMinutes <= windowEndMinutes;
      candidateStart += 15
    ) {
      const blockStartMinutes = candidateStart - bufferBefore;
      const blockEndMinutes = candidateStart + durationMinutes + bufferAfter;

      // Verify block stays within staff shift and business hours
      if (blockStartMinutes < staffShiftStartMinutes || blockEndMinutes > staffShiftEndMinutes) {
        continue;
      }
      if (blockStartMinutes < bizOpenMinutes || blockEndMinutes > bizCloseMinutes) {
        continue;
      }

      // Verify no intersection with staff breaks
      const intersectsBreak = staffBreaks.some(
        (b) => Math.max(blockStartMinutes, b.start) < Math.min(blockEndMinutes, b.end)
      );
      if (intersectsBreak) {
        continue;
      }

      // Calculate UTC timestamps
      const localStartTimeStr = minutesToTimeString(candidateStart);
      const localEndTimeStr = minutesToTimeString(candidateStart + durationMinutes);

      const slotStartUtc = fromZonedTime(`${dateStr}T${localStartTimeStr}:00`, business.timezone);
      const slotEndUtc = fromZonedTime(`${dateStr}T${localEndTimeStr}:00`, business.timezone);

      // Check min advance notice policy
      if (isBefore(slotStartUtc, nowPlusNotice)) {
        continue;
      }

      // Check all 15-minute cells in [blockStartMinutes, blockEndMinutes)
      let isBlocked = false;
      for (let cellMin = blockStartMinutes; cellMin < blockEndMinutes; cellMin += 15) {
        const cellTimeStr = minutesToTimeString(cellMin);
        const cellUtc = fromZonedTime(`${dateStr}T${cellTimeStr}:00`, business.timezone);
        const key = `${staffMember._id.toString()}_${cellUtc.toISOString()}`;

        if (occupiedSet.has(key)) {
          isBlocked = true;
          break;
        }
      }

      if (!isBlocked) {
        availableSlots.push({
          startTimeUtc: slotStartUtc,
          endTimeUtc: slotEndUtc,
          localStartTime: localStartTimeStr,
          localEndTime: localEndTimeStr,
          staffId: staffMember._id,
          staffName: staffMember.displayName,
          serviceId: service._id,
          serviceName: service.name,
          price,
          durationMinutes
        });
      }
    }
  }

  // Sort chronologically by start time
  availableSlots.sort((a, b) => a.startTimeUtc.getTime() - b.startTimeUtc.getTime());

  return availableSlots;
}
