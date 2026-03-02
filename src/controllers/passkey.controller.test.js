/**
 * @fileoverview Passkey (WebAuthn) Controller Tests
 * @description Integration tests for passkey registration & login endpoints.
 * Uses Supertest against the Express app (same pattern as authController.test.js).
 */

import request from 'supertest';
import app from '../app.js';

describe('Passkey (WebAuthn) API — Basic Tests', () => {

    // ── Register Options ────────────────────────────────────────────────────
    describe('GET /auth/passkey/register-options', () => {
        test('should return 401 when no JWT is provided', async () => {
            const res = await request(app).get('/auth/passkey/register-options');
            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/no token/i);
        });

        test('should return 401 with an invalid JWT', async () => {
            const res = await request(app)
                .get('/auth/passkey/register-options')
                .set('Authorization', 'Bearer invalidtoken123');
            expect(res.status).toBe(401);
        });
    });

    // ── Register Verify ─────────────────────────────────────────────────────
    describe('POST /auth/passkey/register-verify', () => {
        test('should return 401 when no JWT is provided', async () => {
            const res = await request(app)
                .post('/auth/passkey/register-verify')
                .send({});
            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/no token/i);
        });

        test('should return 401 with an invalid JWT', async () => {
            const res = await request(app)
                .post('/auth/passkey/register-verify')
                .set('Authorization', 'Bearer invalidtoken123')
                .send({ id: 'fake', response: {} });
            expect(res.status).toBe(401);
        });
    });

    // ── Login Options ───────────────────────────────────────────────────────
    describe('GET /auth/passkey/login-options', () => {
        test('should return 400 when email query param is missing', async () => {
            const res = await request(app).get('/auth/passkey/login-options');
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/email is required/i);
        });
    });

    // ── Login Verify ────────────────────────────────────────────────────────
    describe('POST /auth/passkey/login-verify', () => {
        test('should return 400 when userId is missing from body', async () => {
            const res = await request(app)
                .post('/auth/passkey/login-verify')
                .send({ id: 'fakecred', response: {} });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/userId is required/i);
        });
    });
});
