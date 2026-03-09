/**
 * @fileoverview Integration Tests — esgAdmin.controller.js
 * @description Tests auth guards and role enforcement for /esg-admin endpoints.
 *   Only tests cases that do not require a live DB (auth/role validation).
 *   Follows the existing project pattern from carbon.controller.test.js.
 */

import request from 'supertest';
import app from '../app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const makeToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

const orgAdminToken = makeToken({ userId: 'admin-1', role: 'ORG_ADMIN',      organizationId: 'org-001' });
const platformToken = makeToken({ userId: 'admin-2', role: 'PLATFORM_ADMIN', organizationId: null });
const driverToken   = makeToken({ userId: 'driver-1', role: 'DRIVER',        isDriver: true });

// ─── GET /esg-admin/dashboard ─────────────────────────────────────────────────

describe('GET /esg-admin/dashboard', () => {
  test('401 without auth token', async () => {
    const res = await request(app).get('/api/esg-admin/dashboard');
    expect(res.status).toBe(401);
  });

  test('403 for driver (requires ORG_ADMIN)', async () => {
    const res = await request(app)
      .get('/api/esg-admin/dashboard')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(403);
  });

  test('403 for platform admin on dashboard (requires ORG_ADMIN not PLATFORM_ADMIN)', async () => {
    const res = await request(app)
      .get('/api/esg-admin/dashboard')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.status).toBe(403);
  });

  test('400 when org admin has no organizationId', async () => {
    const noOrgToken = makeToken({ userId: 'admin-no-org', role: 'ORG_ADMIN', organizationId: null });
    const res = await request(app)
      .get('/api/esg-admin/dashboard')
      .set('Authorization', `Bearer ${noOrgToken}`);
    expect(res.status).toBe(400);
  });

  test('auth guard passes for org admin (proceeds to service layer)', async () => {
    const res = await request(app)
      .get('/api/esg-admin/dashboard')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    // Not 401 or 403 — auth/role guard passed
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─── GET /esg-admin/global ────────────────────────────────────────────────────

describe('GET /esg-admin/global', () => {
  test('401 without auth token', async () => {
    const res = await request(app).get('/api/esg-admin/global');
    expect(res.status).toBe(401);
  });

  test('403 for org admin (requires PLATFORM_ADMIN)', async () => {
    const res = await request(app)
      .get('/api/esg-admin/global')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(res.status).toBe(403);
  });

  test('403 for driver', async () => {
    const res = await request(app)
      .get('/api/esg-admin/global')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(403);
  });

  test('auth guard passes for platform admin (proceeds to service layer)', async () => {
    const res = await request(app)
      .get('/api/esg-admin/global')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─── GET /esg-admin/commute-partners ─────────────────────────────────────────

describe('GET /esg-admin/commute-partners', () => {
  test('401 without auth token', async () => {
    const res = await request(app).get('/api/esg-admin/commute-partners');
    expect(res.status).toBe(401);
  });

  test('auth guard passes for authenticated user', async () => {
    const res = await request(app)
      .get('/api/esg-admin/commute-partners')
      .set('Authorization', `Bearer ${driverToken}`);
    // Passes auth guard; DB call may fail but not 401
    expect(res.status).not.toBe(401);
  });

  test('auth guard passes for org admin too', async () => {
    const res = await request(app)
      .get('/api/esg-admin/commute-partners')
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(res.status).not.toBe(401);
  });
});
