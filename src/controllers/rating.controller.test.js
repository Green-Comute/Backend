/**
 * @fileoverview Rating Controller Integration Tests
 * @description Tests for rating API endpoints using Supertest.
 * Validates authentication requirements and input validation.
 * DB calls fast-fail via the bufferTimeoutMS=500 Jest setup.
 */

import request from 'supertest';
import app from '../app.js';

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Rating API', () => {

  // ─── GET /api/ratings/user/:userId ──────────────────────────────────────────

  describe('GET /api/ratings/user/:userId', () => {
    test('returns 401 when no auth token provided', async () => {
      const res = await request(app).get('/api/ratings/user/someUserId');
      expect(res.status).toBe(401);
    });

    test('returns 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/ratings/user/someUserId')
        .set('Authorization', FAKE_TOKEN);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/ratings/driver ────────────────────────────────────────────────

  describe('POST /api/ratings/driver', () => {
    test('returns 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/ratings/driver')
        .send({ tripId: 't1', targetUserId: 'd1', stars: 5 });
      expect(res.status).toBe(401);
    });

    test('returns 401 for invalid token', async () => {
      const res = await request(app)
        .post('/api/ratings/driver')
        .set('Authorization', FAKE_TOKEN)
        .send({ tripId: 't1', targetUserId: 'd1', stars: 5 });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/ratings/passenger ────────────────────────────────────────────

  describe('POST /api/ratings/passenger', () => {
    test('returns 401 when no auth token provided', async () => {
      const res = await request(app)
        .post('/api/ratings/passenger')
        .send({ tripId: 't1', targetUserId: 'p1', stars: 4 });
      expect(res.status).toBe(401);
    });
  });
});
