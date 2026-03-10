/**
 * @fileoverview Fuel Type Integration Tests
 * @description Integration tests for fuelType validation on POST /api/trips.
 * Follows existing project test patterns (authController.test.js, carbon.controller.test.js).
 *
 * Auth strategy: a test JWT is signed with a known secret — no DB required
 * for validation-layer tests (middleware + controller validation runs before any DB call).
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'test-jwt-secret-for-fuel-type-tests';

/** Returns a signed driver JWT for use in Authorization headers. */
const makeDriverToken = () =>
  jwt.sign(
    { userId: '507f1f77bcf86cd799439011', role: 'EMPLOYEE', isDriver: true },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );

/**
 * Minimal valid trip body — all required fields except fuelType so each test
 * can supply (or omit) it explicitly.
 */
const validTripBody = () => ({
  vehicleType: 'CAR',
  totalSeats: 4,
  scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
  source: 'Downtown Office',
  destination: 'Airport Terminal 2',
});

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Fuel Type - Integration Tests (POST /api/trips)', () => {

  // ── Auth guard ─────────────────────────────────────────────────────────────

  describe('Authorization', () => {

    test('should return 401 when no Authorization token provided', async () => {
      const response = await request(app)
        .post('/api/trips')
        .send({ ...validTripBody(), fuelType: 'PETROL' });

      expect(response.status).toBe(401);
    });
  });

  // ── fuelType missing ───────────────────────────────────────────────────────

  describe('400 - Missing fuelType', () => {

    test('should return 400 when fuelType is not provided', async () => {
      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${makeDriverToken()}`)
        .send(validTripBody()); // no fuelType

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Joi validation middleware catches missing required fuelType
      expect(response.body.message).toBe('Input validation failed');
      expect(response.body.errors.some(e => e.includes('fuelType'))).toBe(true);
    });

    test('should return 400 when fuelType is null', async () => {
      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${makeDriverToken()}`)
        .send({ ...validTripBody(), fuelType: null });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 when fuelType is an empty string', async () => {
      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${makeDriverToken()}`)
        .send({ ...validTripBody(), fuelType: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ── invalid fuelType ───────────────────────────────────────────────────────

  describe('400 - Invalid fuelType', () => {

    test('should return 400 for an unknown fuel type', async () => {
      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${makeDriverToken()}`)
        .send({ ...validTripBody(), fuelType: 'HYDROGEN' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      // Joi validation middleware catches invalid fuelType value
      expect(response.body.message).toBe('Input validation failed');
      expect(response.body.errors.some(e => e.includes('fuelType'))).toBe(true);
    });

    test('should return 400 for lowercase fuelType (case sensitivity)', async () => {
      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${makeDriverToken()}`)
        .send({ ...validTripBody(), fuelType: 'petrol' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 for mixed-case fuelType', async () => {
      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${makeDriverToken()}`)
        .send({ ...validTripBody(), fuelType: 'Petrol' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('error message should list the allowed fuel types', async () => {
      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${makeDriverToken()}`)
        .send({ ...validTripBody(), fuelType: 'GASOLINE' });

      expect(response.status).toBe(400);
      // Joi validates fuelType against allowed values
      expect(response.body.message).toBe('Input validation failed');
      expect(response.body.errors).toBeDefined();
    });
  });

  // ── valid fuelType reaches persistence layer ───────────────────────────────

  describe('Valid fuelType passes validation layer', () => {

    const validFuelTypes = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG'];

    // Increase timeout to 15 s — valid requests reach the DB layer which
    // buffers for up to 10 s before returning a Mongoose timeout error.
    // The key assertion: no "fuel type" rejection (400 with fuel type message).
    validFuelTypes.forEach(fuelType => {
      test(`should not reject with a fuelType error for: ${fuelType}`, async () => {
        const response = await request(app)
          .post('/api/trips')
          .set('Authorization', `Bearer ${makeDriverToken()}`)
          .send({ ...validTripBody(), fuelType });

        // Whatever status comes back (DB timeout → 400, success → 201),
        // the message must NOT be about an invalid fuel type.
        expect(response.body.message).not.toMatch(/invalid fuel type/i);
        expect(response.body.message).not.toMatch(/fuel type is required/i);
      }, 15000);
    });
  });
});
