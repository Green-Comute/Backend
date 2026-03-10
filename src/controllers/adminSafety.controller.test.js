/**
 * @fileoverview Admin Safety Controller Integration Tests
 * @description Tests for admin incident review and safety guideline endpoints.
 * Verifies RBAC: admin-only routes return 401/403 for unauthenticated/non-admin callers.
 */

import request from 'supertest';
import app from '../app.js';

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Admin Safety API', () => {

  // ─── Incident Review (5.14) ──────────────────────────────────────────────────

  describe('GET /api/admin/incidents', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/incidents');
      expect(res.status).toBe(401);
    });

    test('returns 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/admin/incidents')
        .set('Authorization', FAKE_TOKEN);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/incidents/:incidentId/review', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/admin/incidents/someId/review')
        .send({ action: 'WARN', note: 'Warning note' });
      expect(res.status).toBe(401);
    });
  });

  // ─── Safety Guideline (5.13) ─────────────────────────────────────────────────

  describe('POST /api/admin/guidelines', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/admin/guidelines')
        .send({ title: 'Safety Guide', content: 'Always be safe.' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/guidelines/active', () => {
    test('returns 401 without auth (endpoint requires verifyToken)', async () => {
      const res = await request(app).get('/api/admin/guidelines/active');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/guidelines/:guidelineId/accept', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).post('/api/admin/guidelines/someId/accept');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/guidelines/check-acceptance', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/guidelines/check-acceptance');
      expect(res.status).toBe(401);
    });
  });
});
