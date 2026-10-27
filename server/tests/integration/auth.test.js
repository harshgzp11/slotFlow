import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('Auth Integration Tests (JavaScript ESM)', () => {
  const app = createApp();

  it('registers a new user successfully with session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('jane@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects registration with duplicate email address with 409 Conflict', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'duplicate@example.com',
        password: 'Password123!'
      });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Jane 2',
        email: 'duplicate@example.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  it('authenticates user and logs in with valid credentials', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'John Smith',
        email: 'john@example.com',
        password: 'Password123!'
      });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'john@example.com',
        password: 'Password123!'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.email).toBe('john@example.com');

    // Test session persistence via /me using cookie
    const cookie = loginRes.headers['set-cookie'];
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('john@example.com');
  });

  it('rejects login with incorrect password with 401 Unauthorized', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'User BadPass',
        email: 'badpass@example.com',
        password: 'Password123!'
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'badpass@example.com',
        password: 'WrongPassword!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
