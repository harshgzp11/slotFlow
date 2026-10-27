import { QueueTicket } from '../models/QueueTicket.js';
import { Staff } from '../models/Staff.js';
import { Service } from '../models/Service.js';

/**
 * Calculates dynamic estimated wait time for a new or existing walk-in ticket
 * @param {Object} params
 * @param {ObjectId} params.businessId
 * @param {ObjectId} params.serviceId
 * @param {Date} [params.ticketCreatedAt]
 */
export async function calculateQueueWaitEstimate(params) {
  const { businessId, serviceId, ticketCreatedAt } = params;

  // 1. Get count of active staff
  const staffCount = await Staff.countDocuments({ businessId, isActive: true });
  const activeStaffUnits = Math.max(1, staffCount);

  // 2. Fetch all tickets currently waiting ahead in line
  const query = {
    businessId,
    status: { $in: ['WAITING', 'CALLED'] }
  };
  if (ticketCreatedAt) {
    query.createdAt = { $lt: ticketCreatedAt };
  }

  const waitingTickets = await QueueTicket.find(query).populate('serviceId', 'durationMinutes');

  // Sum up duration of tickets ahead
  let totalMinutesAhead = 0;
  for (const t of waitingTickets) {
    totalMinutesAhead += t.serviceId?.durationMinutes || 30;
  }

  // Fetch current requested service duration
  const targetService = await Service.findById(serviceId);
  const targetDuration = targetService?.durationMinutes || 30;

  // Formula: (sum of durations ahead) / activeStaffUnits
  const estimatedWait = Math.round(totalMinutesAhead / activeStaffUnits);

  return Math.max(5, estimatedWait);
}

/**
 * Generates the next sequential ticket number for the day (e.g. Q-001, Q-002)
 * @param {ObjectId} businessId
 */
export async function generateNextTicketNumber(businessId) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const countToday = await QueueTicket.countDocuments({
    businessId,
    createdAt: { $gte: startOfDay }
  });

  const nextNum = countToday + 1;
  return `Q-${String(nextNum).padStart(3, '0')}`;
}
