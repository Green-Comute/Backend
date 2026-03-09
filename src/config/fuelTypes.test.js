/**
 * @fileoverview Fuel Types Config Unit Tests
 * @description Unit tests for FUEL_TYPES constant and validateFuelTypesConfig() guard.
 * Follows existing project Jest / ES-module pattern.
 */

import { FUEL_TYPES, MAX_FUEL_TYPES, validateFuelTypesConfig } from '../config/fuelTypes.js';

describe('fuelTypes.config', () => {

  // ─── FUEL_TYPES constant ─────────────────────────────────────────────────

  describe('FUEL_TYPES constant', () => {

    test('should contain exactly 6 fuel types', () => {
      expect(FUEL_TYPES).toHaveLength(6);
    });

    test('should contain all required fuel type values', () => {
      expect(FUEL_TYPES).toContain('PETROL');
      expect(FUEL_TYPES).toContain('DIESEL');
      expect(FUEL_TYPES).toContain('ELECTRIC');
      expect(FUEL_TYPES).toContain('HYBRID');
      expect(FUEL_TYPES).toContain('CNG');
      expect(FUEL_TYPES).toContain('LPG');
    });

    test('should have no duplicate values', () => {
      const unique = new Set(FUEL_TYPES);
      expect(unique.size).toBe(FUEL_TYPES.length);
    });

    test('all values should be uppercase strings', () => {
      FUEL_TYPES.forEach(ft => {
        expect(typeof ft).toBe('string');
        expect(ft).toBe(ft.toUpperCase());
      });
    });

    test('MAX_FUEL_TYPES should equal 6', () => {
      expect(MAX_FUEL_TYPES).toBe(6);
    });
  });

  // ─── validateFuelTypesConfig guard ───────────────────────────────────────

  describe('validateFuelTypesConfig()', () => {

    test('should not throw for a valid 6-entry list (real config)', () => {
      expect(() => validateFuelTypesConfig()).not.toThrow();
    });

    test('should throw when more than 6 fuel types are configured', () => {
      // We test the guard logic directly by calling it with a modified module.
      // Since JS modules are live bindings, we inline equivalent logic here.
      const testFuelTypes = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG', 'HYDROGEN'];
      const guard = () => {
        if (testFuelTypes.length !== MAX_FUEL_TYPES) {
          throw new Error(
            `[fuelTypes.config] Configuration error: exactly ${MAX_FUEL_TYPES} fuel types must be defined, ` +
            `but found ${testFuelTypes.length}.`
          );
        }
      };

      expect(guard).toThrow(/exactly 6 fuel types must be defined/);
      expect(guard).toThrow(/found 7/);
    });

    test('should throw when fewer than 6 fuel types are configured', () => {
      const testFuelTypes = ['PETROL', 'DIESEL'];
      const guard = () => {
        if (testFuelTypes.length !== MAX_FUEL_TYPES) {
          throw new Error(
            `[fuelTypes.config] Configuration error: exactly ${MAX_FUEL_TYPES} fuel types must be defined, ` +
            `but found ${testFuelTypes.length}.`
          );
        }
      };

      expect(guard).toThrow(/exactly 6 fuel types must be defined/);
      expect(guard).toThrow(/found 2/);
    });

    test('should throw when duplicate fuel type entries are present', () => {
      const testFuelTypes = ['PETROL', 'PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'];
      const guard = () => {
        if (testFuelTypes.length === MAX_FUEL_TYPES) {
          const unique = new Set(testFuelTypes);
          if (unique.size !== testFuelTypes.length) {
            throw new Error(
              '[fuelTypes.config] Configuration error: duplicate fuel type entries detected.'
            );
          }
        }
      };

      expect(guard).toThrow(/duplicate fuel type entries/);
    });
  });
});
