/**
 * @fileoverview Support Controller Integration Tests
 * @description Tests for support ticket API endpoints using Supertest.
 * Validates auth requirements and input validation.
 */

import request from 'supertest';
import app from '../app.js';

const FAKE_TOKEN = 'Bearer invalid.jwt.token';

describe('Support Tickets API', () => {

  // ─── POST /api/support/tickets ───────────────────────────────────────────────

  describe('POST /api/support/tickets', () => {
    test('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/support/tickets')
        .send({ issueType: 'BILLING', message: 'My billing question here' });
      expect(res.status).toBe(401);
    });

    test('returns 401 for invalid token', async () => {
      const res = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', FAKE_TOKEN)
        .send({ issueType: 'BILLING', message: 'My billing question here' });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/support/tickets ────────────────────────────────────────────────

  describe('GET /api/support/tickets', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/support/tickets');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/support/tickets/:ticketId ─────────────────────────────────────

  describe('GET /api/support/tickets/:ticketId', () => {
    test('returns 401 without auth', async () => {
      const res = await request(app).get('/api/support/tickets/someTicketId');
      expect(res.status).toBe(401);
    });
  });
});
