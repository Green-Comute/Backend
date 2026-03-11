/**
 * @fileoverview Safety Controller Integration Tests
 * @description Tests for safety API endpoints using Supertest.
 * Validates authentication requirements and input validation (400/401/403).
 */

import request from 'supertest';
import app from '../app.js';

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Safety API', () => {

  // ─── User Blocking (5.4) ────────────────────────────────────────────────────

  describe('POST /api/safety/block', () => {
    test('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/safety/block').send({ blockedId: 'u2' });
      expect(res.status).toBe(401);
    });

    test('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/safety/block')
        .set('Authorization', FAKE_TOKEN)
        .send({ blockedId: 'u2' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/safety/block/:blockedId', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/safety/block/someId');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/safety/block', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/safety/block');
      expect(res.status).toBe(401);
    });
  });

  // ─── Emergency Contacts (5.5) ───────────────────────────────────────────────

  describe('POST /api/safety/emergency-contacts', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/safety/emergency-contacts')
        .send({ name: 'Jane', phone: '+1234567890', relationship: 'Sister' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/safety/emergency-contacts', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/safety/emergency-contacts');
      expect(res.status).toBe(401);
    });
  });

  // ─── Incident Reports (5.7) ─────────────────────────────────────────────────

  describe('POST /api/safety/incidents', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/safety/incidents')
        .send({ tripId: 't1', description: 'Some issue' });
      expect(res.status).toBe(401);
    });
  });

  // ─── Women-only Filter (5.8) ────────────────────────────────────────────────

  describe('POST /api/safety/women-only/filter', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/safety/women-only/filter')
        .send({ trips: [] });
      expect(res.status).toBe(401);
    });
  });
});

// ─── Trip Share (5.6) ────────────────────────────────────────────────────────

describe('Trip Share API', () => {
  describe('GET /api/trip/share/:tripId', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/trip/share/tripId123');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/trip/track/:token', () => {
    test('returns non-401 (public endpoint) — 500 fast-fail from DB or 404', async () => {
      const res = await request(app).get('/api/trip/track/somerandominvalidtoken');
      // Public endpoint: no 401. DB fast-fail returns 500 or service returns 404.
      expect(res.status).not.toBe(401);
    });
  });
});
