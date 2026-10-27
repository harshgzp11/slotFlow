import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Business } from '../../src/models/Business.js';
import { Membership } from '../../src/models/Membership.js';
import { Service } from '../../src/models/Service.js';
import { Staff } from '../../src/models/Staff.js';
import { QueueTicket } from '../../src/models/QueueTicket.js';

describe('Walk-In Queue Management Integration Tests (JavaScript ESM)', () => {
  let app;
  let testUser;
  let testBusiness;
  let testService;
  let testStaff;
  let authCookie;

  beforeEach(async () => {
    app = createApp();

    const userEmail = `queue-mgr-${Date.now()}@slotflow.io`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Queue Manager',
        email: userEmail,
        password: 'Password123!'
      });
    authCookie = regRes.headers['set-cookie'];
    testUser = await User.findOne({ email: userEmail });

    testBusiness = await Business.create({
      name: 'Walk-In Barbershop',
      slug: `walkin-barbershop-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timezone: 'UTC',
      currency: 'USD'
    });

    await Membership.create({
      userId: testUser._id,
      businessId: testBusiness._id,
      role: 'OWNER'
    });

    testStaff = await Staff.create({
      businessId: testBusiness._id,
      displayName: 'Lead Barber',
      email: 'barber@shop.com',
      weeklySchedule: [
        { dayOfWeek: 1, isWorking: true, shiftStart: '09:00', shiftEnd: '17:00', breaks: [] }
      ]
    });

    testService = await Service.create({
      businessId: testBusiness._id,
      name: 'Classic Cut',
      durationMinutes: 30,
      bufferBefore: 0,
      bufferAfter: 0,
      price: 40,
      qualifiedStaffIds: [testStaff._id]
    });
  });

  it('allows walk-in customer intake with sequential ticket numbering and dynamic wait estimates', async () => {
    // 1. First customer enters queue
    const res1 = await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/queue`)
      .send({
        serviceId: testService._id.toString(),
        customer: {
          name: 'First Walk-In',
          phone: '+15551113333'
        }
      });

    expect(res1.status).toBe(201);
    expect(res1.body.data.ticket.ticketNumber).toBe('Q-001');
    expect(res1.body.data.ticket.status).toBe('WAITING');
    const ticket1Id = res1.body.data.ticket._id;

    // 2. Second customer enters queue
    const res2 = await request(app)
      .post(`/api/v1/public/businesses/${testBusiness.slug}/queue`)
      .send({
        serviceId: testService._id.toString(),
        customer: {
          name: 'Second Walk-In',
          phone: '+15552224444'
        }
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.ticket.ticketNumber).toBe('Q-002');
    expect(res2.body.data.ticket.estimatedWaitMinutes).toBeGreaterThanOrEqual(30);

    // 3. Customer checks public ticket status
    const statusRes = await request(app)
      .get(`/api/v1/public/queue/tickets/${ticket1Id}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.ticket.status).toBe('WAITING');
    expect(statusRes.body.data.positionAhead).toBe(1);

    // 4. Staff updates ticket: CALLED -> IN_SERVICE -> COMPLETED
    const callRes = await request(app)
      .patch(`/api/v1/queue/${ticket1Id}/status`)
      .set('Cookie', authCookie)
      .set('x-business-id', testBusiness._id.toString())
      .send({ status: 'CALLED', assignedStaffId: testStaff._id.toString() });

    expect(callRes.status).toBe(200);
    expect(callRes.body.data.ticket.status).toBe('CALLED');

    const completeRes = await request(app)
      .patch(`/api/v1/queue/${ticket1Id}/status`)
      .set('Cookie', authCookie)
      .set('x-business-id', testBusiness._id.toString())
      .send({ status: 'COMPLETED' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.ticket.status).toBe('COMPLETED');
  });
});
