/**
 * @fileoverview Carbon Service Unit Tests
 * @description Unit tests for calculateCo2Saved() in carbon.service.js
 * Follows project's existing Jest / ES-module testing patterns.
 */

import { calculateCo2Saved } from '../services/carbon.service.js';

describe('Carbon Service - calculateCo2Saved()', () => {

  // ─── Correct CO2 Calculation ──────────────────────────────────────────────

  describe('Correct CO2 calculation', () => {

    test('should calculate CO2 saved for standard inputs', () => {
      const result = calculateCo2Saved({
        distanceKm: 10,
        conventionalEmissionFactor: 0.21,
        sustainableEmissionFactor: 0.05
      });

      expect(result.co2SavedKg).toBeCloseTo(1.6, 4);
      expect(result.distanceKm).toBe(10);
      expect(result.conventionalEmissionFactor).toBe(0.21);
      expect(result.sustainableEmissionFactor).toBe(0.05);
    });

    test('should return correct response shape', () => {
      const result = calculateCo2Saved({
        distanceKm: 5,
        conventionalEmissionFactor: 0.2,
        sustainableEmissionFactor: 0.1
      });

      expect(result).toHaveProperty('co2SavedKg');
      expect(result).toHaveProperty('distanceKm');
      expect(result).toHaveProperty('conventionalEmissionFactor');
      expect(result).toHaveProperty('sustainableEmissionFactor');
    });

    test('should handle string-numeric inputs by coercing to numbers', () => {
      const result = calculateCo2Saved({
        distanceKm: '10',
        conventionalEmissionFactor: '0.21',
        sustainableEmissionFactor: '0.05'
      });

      expect(result.co2SavedKg).toBeCloseTo(1.6, 4);
    });
  });

  // ─── Decimal Precision ────────────────────────────────────────────────────

  describe('Decimal precision', () => {

    test('should round result to 4 decimal places', () => {
      const result = calculateCo2Saved({
        distanceKm: 3,
        conventionalEmissionFactor: 0.19,
        sustainableEmissionFactor: 0.04
      });

      // (0.19 - 0.04) * 3 = 0.15 * 3 = 0.45
      expect(result.co2SavedKg).toBe(0.45);
      expect(String(result.co2SavedKg).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
    });

    test('should handle very small emission factor differences', () => {
      const result = calculateCo2Saved({
        distanceKm: 100,
        conventionalEmissionFactor: 0.0002,
        sustainableEmissionFactor: 0.0001
      });

      // (0.0002 - 0.0001) * 100 = 0.01
      expect(result.co2SavedKg).toBeCloseTo(0.01, 4);
    });

    test('should handle large distance values', () => {
      const result = calculateCo2Saved({
        distanceKm: 10000,
        conventionalEmissionFactor: 0.3,
        sustainableEmissionFactor: 0.05
      });

      // (0.3 - 0.05) * 10000 = 2500
      expect(result.co2SavedKg).toBe(2500);
    });
  });

  // ─── Boundary / Edge Values ───────────────────────────────────────────────

  describe('Edge and boundary values', () => {

    test('should accept sustainableEmissionFactor = 0 (zero-emission mode)', () => {
      const result = calculateCo2Saved({
        distanceKm: 10,
        conventionalEmissionFactor: 0.21,
        sustainableEmissionFactor: 0
      });

      expect(result.co2SavedKg).toBeCloseTo(2.1, 4);
    });

    test('should accept very small distanceKm (above 0)', () => {
      const result = calculateCo2Saved({
        distanceKm: 0.001,
        conventionalEmissionFactor: 0.2,
        sustainableEmissionFactor: 0.1
      });

      expect(result.co2SavedKg).toBeGreaterThan(0);
    });

    test('should handle factors that produce a result near floating-point limits', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 1,
          conventionalEmissionFactor: 0.1,
          sustainableEmissionFactor: 0.05
        })
      ).not.toThrow();
    });
  });

  // ─── Validation Errors ────────────────────────────────────────────────────

  describe('Validation - negative / zero distance', () => {

    test('should throw when distanceKm is 0', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 0,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        })
      ).toThrow('distanceKm must be greater than 0');
    });

    test('should throw when distanceKm is negative', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: -5,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        })
      ).toThrow('distanceKm must be greater than 0');
    });
  });

  describe('Validation - sustainable factor >= conventional factor', () => {

    test('should throw when sustainableEmissionFactor equals conventionalEmissionFactor', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 10,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.21
        })
      ).toThrow('sustainableEmissionFactor must be less than conventionalEmissionFactor');
    });

    test('should throw when sustainableEmissionFactor is greater than conventionalEmissionFactor', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 10,
          conventionalEmissionFactor: 0.1,
          sustainableEmissionFactor: 0.5
        })
      ).toThrow('sustainableEmissionFactor must be less than conventionalEmissionFactor');
    });
  });

  describe('Validation - negative emission factors', () => {

    test('should throw when conventionalEmissionFactor is negative', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 10,
          conventionalEmissionFactor: -0.1,
          sustainableEmissionFactor: 0.05
        })
      ).toThrow('conventionalEmissionFactor must be >= 0');
    });

    test('should throw when sustainableEmissionFactor is negative', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 10,
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: -0.05
        })
      ).toThrow('sustainableEmissionFactor must be >= 0');
    });
  });

  describe('Validation - missing / non-numeric inputs', () => {

    test('should throw when distanceKm is missing', () => {
      expect(() =>
        calculateCo2Saved({
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        })
      ).toThrow('distanceKm is required');
    });

    test('should throw when conventionalEmissionFactor is missing', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 10,
          sustainableEmissionFactor: 0.05
        })
      ).toThrow('conventionalEmissionFactor is required');
    });

    test('should throw when sustainableEmissionFactor is missing', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 10,
          conventionalEmissionFactor: 0.21
        })
      ).toThrow('sustainableEmissionFactor is required');
    });

    test('should throw for non-numeric distanceKm', () => {
      expect(() =>
        calculateCo2Saved({
          distanceKm: 'abc',
          conventionalEmissionFactor: 0.21,
          sustainableEmissionFactor: 0.05
        })
      ).toThrow('must be numbers');
    });
  });
});
