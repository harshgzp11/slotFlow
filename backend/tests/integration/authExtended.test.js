import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Business } from '../../src/models/Business.js';
import { Membership } from '../../src/models/Membership.js';
import { registerAndAuthenticateUser, createTestBusiness } from '../fixtures/testData.js';

describe('Authentication & Session Security End-to-End Tests', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  it('rejects unauthenticated requests to all protected application endpoints with 401 Unauthorized', async () => {
    const protectedEndpoints = [
      { method: 'get', url: '/api/v1/auth/me' },
      { method: 'get', url: '/api/v1/businesses/current' },
      { method: 'post', url: '/api/v1/businesses' },
      { method: 'get', url: '/api/v1/services' },
      { method: 'post', url: '/api/v1/services' },
      { method: 'get', url: '/api/v1/staff' },
      { method: 'post', url: '/api/v1/staff' },
      { method: 'get', url: '/api/v1/bookings' },
      { method: 'get', url: '/api/v1/analytics/summary' },
      { method: 'get', url: '/api/v1/waitlist' }
    ];

    for (const ep of protectedEndpoints) {
      const res = await request(app)[ep.method](ep.url).send({});
      expect(
        res.status,
        `Expected ${ep.method.toUpperCase()} ${ep.url} to return 401 without auth, got ${res.status}`
      ).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/Authentication required|Please log in/i);
    }
  });

  it('verifies session persistence across requests and valid session destruction upon logout', async () => {
    const { user, cookie, email, password } = await registerAndAuthenticateUser(app);

    // 1. Session persistence verification: /api/v1/auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe(email);
    expect(meRes.body.data.user.id).toBe(user._id.toString());

    // 2. Perform logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
    expect(logoutRes.body.message).toMatch(/Logged out successfully/i);

    // Verify cookie clearing header
    const setCookieHeader = logoutRes.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const clearCookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join(';') : setCookieHeader;
    expect(clearCookieStr).toMatch(/connect\.sid=;/i);

    // 3. Subsequent request with the destroyed session cookie must be rejected
    const postLogoutRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(postLogoutRes.status).toBe(401);
    expect(postLogoutRes.body.success).toBe(false);
  });

  it('rejects forged or expired session cookies with 401 Unauthorized', async () => {
    const fakeCookies = [
      'connect.sid=s%3Aexpired_or_forged_session_id_12345.sig',
      'connect.sid=malformed_token',
      'connect.sid='
    ];

    for (const badCookie of fakeCookies) {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', badCookie);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  it('enforces RBAC and tenant membership verification during business switching', async () => {
    // Register User 1 and create Business 1
    const user1 = await registerAndAuthenticateUser(app);
    const biz1 = await createTestBusiness();
    await Membership.create({
      userId: user1.user._id,
      businessId: biz1._id,
      role: 'OWNER'
    });

    // Create Business 2 belonging to someone else
    const biz2 = await createTestBusiness();

    // User 1 successfully switches to Business 1 where they have membership
    const switchRes = await request(app)
      .post('/api/v1/auth/switch-business')
      .set('Cookie', user1.cookie)
      .send({ businessId: biz1._id.toString() });

    expect(switchRes.status).toBe(200);
    expect(switchRes.body.success).toBe(true);
    expect(switchRes.body.data.activeBusinessId).toBe(biz1._id.toString());

    // User 1 attempts to switch to Business 2 where they have NO membership -> 403 Forbidden
    const illegalSwitchRes = await request(app)
      .post('/api/v1/auth/switch-business')
      .set('Cookie', user1.cookie)
      .send({ businessId: biz2._id.toString() });

    expect(illegalSwitchRes.status).toBe(403);
    expect(illegalSwitchRes.body.success).toBe(false);
    expect(illegalSwitchRes.body.error.message).toMatch(/do not have access/i);
  });
});
