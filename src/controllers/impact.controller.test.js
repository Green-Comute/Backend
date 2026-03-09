/**
 * @fileoverview Integration Tests — impact.controller.js
 * @description Tests auth guards and validation for /impact endpoints.
 *   Only tests cases that do not require a live DB connection (auth/validation).
 *   Follows the existing project pattern from carbon.controller.test.js.
 */

import request from 'supertest';
import app from '../app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const makeToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

const driverToken = makeToken({ userId: 'driver-id-111', role: 'DRIVER', isDriver: true, organizationId: 'org-001' });
const adminToken  = makeToken({ userId: 'admin-id-222',  role: 'ORG_ADMIN',  organizationId: 'org-001' });

// ─── GET /impact/lifetime ─────────────────────────────────────────────────────

describe('GET /impact/lifetime', () => {
  test('401 without auth token', async () => {
    const res = await request(app).get('/api/impact/lifetime');
    expect(res.status).toBe(401);
  });

  test('401 with malformed bearer token', async () => {
    const res = await request(app)
      .get('/api/impact/lifetime')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  test('401 with expired token', async () => {
    const expired = jwt.sign({ userId: 'x', role: 'DRIVER' }, JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app)
      .get('/api/impact/lifetime')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /impact/trips/:id ────────────────────────────────────────────────────

describe('GET /impact/trips/:id', () => {
  test('401 without auth token', async () => {
    const res = await request(app).get('/api/impact/trips/some-id');
    expect(res.status).toBe(401);
  });

  test('401 with malformed bearer token', async () => {
    const res = await request(app)
      .get('/api/impact/trips/some-id')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  test('token accepted — proceeds to service layer with valid token', async () => {
    // This will try to query DB and fail, but the auth layer passes (not 401)
    const res = await request(app)
      .get('/api/impact/trips/000000000000000000000001')
      .set('Authorization', `Bearer ${driverToken}`);
    // Should be anything except 401 (auth guard passed)
    expect(res.status).not.toBe(401);
  });

  test('token accepted for org admin too', async () => {
    const res = await request(app)
      .get('/api/impact/trips/000000000000000000000001')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).not.toBe(401);
  });
});
