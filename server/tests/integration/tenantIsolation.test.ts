import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import mongoose from 'mongoose';

describe('Tenant Isolation & RBAC Integration Tests', () => {
  const app = createApp();

  it('enforces multi-tenant isolation and prevents cross-tenant access', async () => {
    // 1. Register User A and create Business A
    const userARes = await request(app).post('/api/v1/auth/register').send({
      name: 'Owner A',
      email: 'ownerA@example.com',
      password: 'Password123!'
    });
    const cookieA = userARes.headers['set-cookie'];

    const bizARes = await request(app)
      .post('/api/v1/businesses')
      .set('Cookie', cookieA)
      .send({
        name: 'Studio Alpha',
        slug: 'studio-alpha'
      });
    const businessAId = bizARes.body.data.business._id;

    // 2. Register User B and create Business B
    const userBRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Owner B',
      email: 'ownerB@example.com',
      password: 'Password123!'
    });
    const cookieB = userBRes.headers['set-cookie'];

    const bizBRes = await request(app)
      .post('/api/v1/businesses')
      .set('Cookie', cookieB)
      .send({
        name: 'Studio Beta',
        slug: 'studio-beta'
      });
    const businessBId = bizBRes.body.data.business._id;

    // 3. User B attempts to access Business A's workspace settings
    const illegalAccessRes = await request(app)
      .get('/api/v1/businesses/current')
      .set('Cookie', cookieB)
      .set('x-business-id', businessAId);

    expect(illegalAccessRes.status).toBe(403);
    expect(illegalAccessRes.body.success).toBe(false);
    expect(illegalAccessRes.body.error.message).toMatch(/do not have access/i);

    // 4. User B attempts to create a service in Business A
    const illegalServiceRes = await request(app)
      .post('/api/v1/services')
      .set('Cookie', cookieB)
      .set('x-business-id', businessAId)
      .send({
        name: 'Infiltrator Service',
        durationMinutes: 30,
        price: 50
      });

    expect(illegalServiceRes.status).toBe(403);
  });

  it('validates 15-minute duration constraints on service creation', async () => {
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Salon Owner',
      email: 'salon@example.com',
      password: 'Password123!'
    });
    const cookie = userRes.headers['set-cookie'];

    const bizRes = await request(app)
      .post('/api/v1/businesses')
      .set('Cookie', cookie)
      .send({
        name: 'Luxe Salon',
        slug: 'luxe-salon'
      });
    const businessId = bizRes.body.data.business._id;

    // Invalid duration (20 minutes is not multiple of 15)
    const invalidRes = await request(app)
      .post('/api/v1/services')
      .set('Cookie', cookie)
      .set('x-business-id', businessId)
      .send({
        name: 'Quick Trim',
        durationMinutes: 20,
        price: 30
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.message).toMatch(/Invalid request input/i);

    // Valid duration (45 minutes, 15-min buffers)
    const validRes = await request(app)
      .post('/api/v1/services')
      .set('Cookie', cookie)
      .set('x-business-id', businessId)
      .send({
        name: 'Full Styling',
        durationMinutes: 45,
        bufferBefore: 15,
        bufferAfter: 15,
        price: 75
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.data.service.durationMinutes).toBe(45);
    expect(validRes.body.data.service.bufferBefore).toBe(15);
  });
});
