/**
 * @fileoverview Privacy Controller Integration Tests
 * @description Tests for privacy, GPS, tutorial, and account deletion endpoints.
 * Validates authentication, input validation, and unauthorized access prevention.
 */

import request from 'supertest';
import app from '../app.js';

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Privacy API', () => {

  // ─── Privacy Settings (5.9) ─────────────────────────────────────────────────

  describe('GET /api/privacy/settings', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/privacy/settings');
      expect(res.status).toBe(401);
    });

    test('returns 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/privacy/settings')
        .set('Authorization', FAKE_TOKEN);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/privacy/settings', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app)
        .patch('/api/privacy/settings')
        .send({ hideProfile: true });
      expect(res.status).toBe(401);
    });
  });

  // ─── GPS Toggle (5.10) ──────────────────────────────────────────────────────

  describe('GET /api/privacy/gps', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/privacy/gps');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/privacy/gps', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).patch('/api/privacy/gps').send({ enabled: true });
      expect(res.status).toBe(401);
    });
  });

  // ─── Tutorial (5.12) ────────────────────────────────────────────────────────

  describe('GET /api/privacy/tutorial', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/privacy/tutorial');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/privacy/tutorial/complete', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).post('/api/privacy/tutorial/complete');
      expect(res.status).toBe(401);
    });
  });

  // ─── Account Deletion (5.15) ────────────────────────────────────────────────

  describe('DELETE /api/privacy/account', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app)
        .delete('/api/privacy/account')
        .send({ password: 'mypassword' });
      expect(res.status).toBe(401);
    });

    test('returns 401 with invalid token', async () => {
      const res = await request(app)
        .delete('/api/privacy/account')
        .set('Authorization', FAKE_TOKEN)
        .send({ password: 'mypassword' });
      expect(res.status).toBe(401);
    });
  });
});
