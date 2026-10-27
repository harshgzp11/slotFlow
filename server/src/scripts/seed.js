import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Business } from '../models/Business.js';
import { Membership } from '../models/Membership.js';
import { Service } from '../models/Service.js';
import { Staff } from '../models/Staff.js';
import { Booking } from '../models/Booking.js';
import { SlotReservation } from '../models/SlotReservation.js';
import { WaitlistEntry } from '../models/WaitlistEntry.js';
import { QueueTicket } from '../models/QueueTicket.js';
import { RecoveryJob } from '../models/RecoveryJob.js';
import { WaitlistOffer } from '../models/WaitlistOffer.js';

async function seed() {
  console.log('--- Connecting to MongoDB ---');
  await connectDB(env.MONGODB_URI);

  console.log('--- Resetting Collections for Clean Demo State ---');
  await Promise.all([
    User.deleteMany({ email: 'owner@slotflow.io' }),
    Business.deleteMany({ slug: 'luxe-studio' }),
    SlotReservation.deleteMany({}),
    WaitlistEntry.deleteMany({}),
    QueueTicket.deleteMany({}),
    RecoveryJob.deleteMany({}),
    WaitlistOffer.deleteMany({})
  ]);

  console.log('--- Creating Demo Owner Account ---');
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const owner = await User.create({
    name: 'Alexandra Hayes',
    email: 'owner@slotflow.io',
    passwordHash
  });

  console.log('--- Creating Demo Business Workspace ---');
  const business = await Business.create({
    name: 'Luxe Studio & Spa',
    slug: 'luxe-studio',
    description: 'Premier appointment scheduling with intelligent zero-gap cancellation recovery and walk-in queue flow.',
    timezone: 'UTC',
    currency: 'USD',
    workingHours: [
      { dayOfWeek: 0, isOpen: false, openTime: '09:00', closeTime: '18:00' },
      { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { dayOfWeek: 6, isOpen: true, openTime: '10:00', closeTime: '16:00' }
    ],
    bookingPolicies: {
      minNoticeHours: 2,
      maxHorizonDays: 60,
      cancelCutoffHours: 4
    }
  });

  await Membership.create({
    userId: owner._id,
    businessId: business._id,
    role: 'OWNER'
  });

  console.log('--- Creating Staff Team ---');
  const staffElena = await Staff.create({
    businessId: business._id,
    displayName: 'Elena Rostova',
    email: 'elena@luxestudio.com',
    weeklySchedule: [
      { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 2, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 3, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 4, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      { dayOfWeek: 5, isWorking: true, shiftStart: '09:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '14:00' }] }
    ]
  });

  const staffMarcus = await Staff.create({
    businessId: business._id,
    displayName: 'Marcus Vance',
    email: 'marcus@luxestudio.com',
    weeklySchedule: [
      { dayOfWeek: 2, isWorking: true, shiftStart: '10:00', shiftEnd: '19:00', breaks: [{ start: '14:00', end: '15:00' }] },
      { dayOfWeek: 3, isWorking: true, shiftStart: '10:00', shiftEnd: '19:00', breaks: [{ start: '14:00', end: '15:00' }] },
      { dayOfWeek: 4, isWorking: true, shiftStart: '10:00', shiftEnd: '19:00', breaks: [{ start: '14:00', end: '15:00' }] },
      { dayOfWeek: 5, isWorking: true, shiftStart: '10:00', shiftEnd: '19:00', breaks: [{ start: '14:00', end: '15:00' }] },
      { dayOfWeek: 6, isWorking: true, shiftStart: '10:00', shiftEnd: '16:00', breaks: [] }
    ]
  });

  console.log('--- Creating Services Catalog ---');
  const svcHaircut = await Service.create({
    businessId: business._id,
    name: 'Signature Haircut & Styling',
    description: 'Precision haircut, invigorating shampoo, hot towel, and styling consultation.',
    durationMinutes: 45,
    bufferBefore: 0,
    bufferAfter: 15,
    price: 75,
    qualifiedStaffIds: [staffElena._id, staffMarcus._id]
  });

  const svcColor = await Service.create({
    businessId: business._id,
    name: 'Balayage & Full Color Treatment',
    description: 'Custom color formulation, hand-painted balayage highlights, and gloss finish.',
    durationMinutes: 90,
    bufferBefore: 0,
    bufferAfter: 15,
    price: 195,
    qualifiedStaffIds: [staffElena._id]
  });

  const svcBeard = await Service.create({
    businessId: business._id,
    name: 'Beard Sculpt & Hot Lather Shave',
    description: 'Straight razor trim, botanical beard oil treatment, and hot lather contour.',
    durationMinutes: 30,
    bufferBefore: 0,
    bufferAfter: 15,
    price: 50,
    qualifiedStaffIds: [staffMarcus._id]
  });

  // Assign services to staff
  staffElena.servicesOffered = [svcHaircut._id, svcColor._id];
  await staffElena.save();

  staffMarcus.servicesOffered = [svcHaircut._id, svcBeard._id];
  await staffMarcus.save();

  console.log('--- Creating Confirmed & Completed Bookings ---');
  const now = new Date();
  const rawManageToken = crypto.randomBytes(32).toString('hex');
  const manageTokenHash = crypto.createHash('sha256').update(rawManageToken).digest('hex');

  // Completed booking in past
  const pastStart = new Date(now.getTime() - 24 * 3600000);
  pastStart.setUTCHours(10, 0, 0, 0);
  const pastEnd = new Date(pastStart.getTime() + 45 * 60000);

  await Booking.create({
    businessId: business._id,
    serviceId: svcHaircut._id,
    staffId: staffElena._id,
    customer: { name: 'Oliver Twist', email: 'oliver@example.com', phone: '+15551112222' },
    startTimeUtc: pastStart,
    endTimeUtc: pastEnd,
    status: 'COMPLETED',
    source: 'PUBLIC',
    priceSnapshot: 75,
    durationMinutesSnapshot: 45,
    bufferBeforeSnapshot: 0,
    bufferAfterSnapshot: 15,
    reservationCellCountSnapshot: 4,
    manageTokenHash,
    manageTokenExpiresAt: new Date(pastStart.getTime() + 86400000),
    completedAtUtc: pastEnd
  });

  // Recovered booking from waitlist
  const recoveredStart = new Date(now.getTime() - 48 * 3600000);
  recoveredStart.setUTCHours(14, 0, 0, 0);
  const recoveredEnd = new Date(recoveredStart.getTime() + 90 * 60000);

  await Booking.create({
    businessId: business._id,
    serviceId: svcColor._id,
    staffId: staffElena._id,
    customer: { name: 'Victoria Sterling', email: 'victoria@luxury.com', phone: '+15553334444' },
    startTimeUtc: recoveredStart,
    endTimeUtc: recoveredEnd,
    status: 'COMPLETED',
    source: 'WAITLIST_RECOVERY',
    priceSnapshot: 195,
    durationMinutesSnapshot: 90,
    bufferBeforeSnapshot: 0,
    bufferAfterSnapshot: 15,
    reservationCellCountSnapshot: 7,
    manageTokenHash,
    manageTokenExpiresAt: new Date(recoveredStart.getTime() + 86400000),
    completedAtUtc: recoveredEnd
  });

  // Confirmed booking for tomorrow
  const tomorrowStart = new Date(now.getTime() + 24 * 3600000);
  tomorrowStart.setUTCHours(11, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 45 * 60000);

  const confirmedBooking = await Booking.create({
    businessId: business._id,
    serviceId: svcHaircut._id,
    staffId: staffElena._id,
    customer: { name: 'Arthur Dent', email: 'arthur@galaxy.org', phone: '+15554242424' },
    startTimeUtc: tomorrowStart,
    endTimeUtc: tomorrowEnd,
    status: 'CONFIRMED',
    source: 'PUBLIC',
    priceSnapshot: 75,
    durationMinutesSnapshot: 45,
    bufferBeforeSnapshot: 0,
    bufferAfterSnapshot: 15,
    reservationCellCountSnapshot: 4,
    manageTokenHash,
    manageTokenExpiresAt: new Date(tomorrowStart.getTime() + 86400000)
  });

  // Reserve discrete 15-minute cells for confirmed booking
  const cellTimes = [
    new Date(tomorrowStart.getTime()),
    new Date(tomorrowStart.getTime() + 15 * 60000),
    new Date(tomorrowStart.getTime() + 30 * 60000),
    new Date(tomorrowStart.getTime() + 45 * 60000) // Buffer cell
  ];

  await SlotReservation.insertMany(
    cellTimes.map((slotStartTimeUtc) => ({
      businessId: business._id,
      staffId: staffElena._id,
      slotStartTimeUtc,
      reservationType: 'BOOKING',
      bookingId: confirmedBooking._id
    }))
  );

  console.log('--- Creating Sample Waitlist Candidates ---');
  await WaitlistEntry.create([
    {
      businessId: business._id,
      serviceId: svcColor._id,
      preferredStaffId: staffElena._id,
      customer: {
        name: 'Gwendolyn Frost',
        email: 'gwen@frostmedia.co',
        phone: '+15557778899'
      },
      preferredDateRange: {
        startDate: new Date(),
        endDate: new Date(now.getTime() + 7 * 86400000)
      },
      timeOfDayPreference: 'AFTERNOON',
      flexibleDays: 2,
      status: 'WAITING',
      priorityScore: 120,
      notes: 'Prefers afternoon appointments; anniversary on Friday.'
    },
    {
      businessId: business._id,
      serviceId: svcBeard._id,
      preferredStaffId: staffMarcus._id,
      customer: {
        name: 'Liam Henderson',
        email: 'liam@architects.io',
        phone: '+15556667788'
      },
      preferredDateRange: {
        startDate: new Date(),
        endDate: new Date(now.getTime() + 5 * 86400000)
      },
      timeOfDayPreference: 'ANY',
      flexibleDays: 1,
      status: 'WAITING',
      priorityScore: 100
    }
  ]);

  console.log('--- Creating Sample Walk-In Queue Tickets ---');
  await QueueTicket.create([
    {
      businessId: business._id,
      ticketNumber: 'Q-001',
      customer: { name: 'Dominic Toretto', phone: '+15551239999' },
      serviceId: svcBeard._id,
      preferredStaffId: staffMarcus._id,
      estimatedWaitMinutes: 10,
      status: 'WAITING'
    },
    {
      businessId: business._id,
      ticketNumber: 'Q-002',
      customer: { name: 'Mia Toretto', phone: '+15551238888' },
      serviceId: svcHaircut._id,
      preferredStaffId: null,
      estimatedWaitMinutes: 25,
      status: 'WAITING'
    }
  ]);

  console.log('\n======================================================');
  console.log('🎉 SLOTFLOW DATABASE SEEDING COMPLETE!');
  console.log('======================================================');
  console.log('Demo Credentials:');
  console.log('  Login Email:    owner@slotflow.io');
  console.log('  Login Password: Password123!');
  console.log('  Workspace Slug: luxe-studio');
  console.log('  Public Link:    http://localhost:5173/book/luxe-studio');
  console.log('======================================================\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
