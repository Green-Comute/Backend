/**
 * @fileoverview Carbon Controller Integration Tests
 * @description Integration tests for POST /carbon/calculate endpoint using Supertest.
 * Follows existing project test patterns (authController.test.js).
 */

import request from 'supertest';
import app from '../app.js';

describe('Carbon API - POST /carbon/calculate', () => {

  // ─── Success cases ────────────────────────────────────────────────────────

  describe('200 - Successful calculation', () => {

    test('should return 200 with correct co2SavedKg for standard inputs', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 10,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.co2SavedKg).toBeCloseTo(1.6, 4);
    });

    test('should return correct JSON structure', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 5,
          conventionalEmissionFactor: 0.3,
          sustainableEmissionFactor: 0.1
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          co2SavedKg: expect.any(Number),
          distanceKm: 5,
          conventionalEmissionFactor: 0.3,
          sustainableEmissionFactor: 0.1
        }
      });
    });

    test('should accept sustainableEmissionFactor = 0 (zero-emission scenario)', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 20,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // (0.21 - 0) * 20 = 4.2
      expect(response.body.data.co2SavedKg).toBeCloseTo(4.2, 4);
    });

    test('should return 200 for large distance values', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 500,
          conventionalEmissionFactor: 0.2,
          sustainableEmissionFactor: 0.05
        });

      expect(response.status).toBe(200);
      expect(response.body.data.co2SavedKg).toBeCloseTo(75, 2);
    });
  });

  // ─── Validation failures (400) ────────────────────────────────────────────

  describe('400 - Validation failures', () => {

    test('should return 400 when distanceKm is 0', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 0,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('distanceKm must be greater than 0');
    });

    test('should return 400 when distanceKm is negative', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: -10,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 when sustainableEmissionFactor >= conventionalEmissionFactor', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 10,
          conventionalEmissionFactor: 0.1,
          sustainableEmissionFactor: 0.2
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('sustainableEmissionFactor must be less than conventionalEmissionFactor');
    });

    test('should return 400 when sustainableEmissionFactor equals conventionalEmissionFactor', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 10,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.21
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 when conventionalEmissionFactor is negative', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 10,
          conventionalEmissionFactor: -0.1,
          sustainableEmissionFactor: 0.05
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 when distanceKm is missing', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('distanceKm is required');
    });

    test('should return 400 when conventionalEmissionFactor is missing', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 10,
          sustainableEmissionFactor: 0.05
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('conventionalEmissionFactor is required');
    });

    test('should return 400 when sustainableEmissionFactor is missing', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({
          distanceKm: 10,
          conventionalEmissionFactor: 0.21
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('sustainableEmissionFactor is required');
    });

    test('should return 400 when body is empty', async () => {
      const response = await request(app)
        .post('/api/carbon/calculate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
