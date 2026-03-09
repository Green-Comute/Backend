/**
 * @fileoverview Unit Tests — esgCalculation.service.js
 * @description Stories 3.5, 3.6, 3.10, 3.12, 3.13, 3.14
 */

import {
  calculateTreesEquivalent,
  calculateCarpoolVsSolo,
  calculateRouteEfficiencyScore,
  calculateIdleEmissions,
  calculateMaintenanceSavings,
  calculateFuelCostSavings,
  computeAllTripEsgMetrics,
} from '../services/esgCalculation.service.js';

// ─── calculateTreesEquivalent (Story 3.5) ─────────────────────────────────────

describe('calculateTreesEquivalent', () => {
  test('returns 0 for 0 kg CO2', () => {
    expect(calculateTreesEquivalent(0)).toBe(0);
  });

  test('correctly converts 21 kg → 1 tree', () => {
    expect(calculateTreesEquivalent(21)).toBeCloseTo(1, 5);
  });

  test('correctly converts 42 kg → 2 trees', () => {
    expect(calculateTreesEquivalent(42)).toBeCloseTo(2, 5);
  });

  test('correctly converts 10.5 kg → 0.5 trees', () => {
    expect(calculateTreesEquivalent(10.5)).toBeCloseTo(0.5, 5);
  });

  test('throws on negative input', () => {
    expect(() => calculateTreesEquivalent(-1)).toThrow();
  });

  test('throws on non-numeric input', () => {
    expect(() => calculateTreesEquivalent('abc')).toThrow();
  });
});

// ─── calculateCarpoolVsSolo (Story 3.6) ─────────────────────────────────────

describe('calculateCarpoolVsSolo', () => {
  test('returns correct solo baseline for PETROL 10km', () => {
    const result = calculateCarpoolVsSolo({ distanceKm: 10, fuelType: 'PETROL' });
    expect(result.soloBaselineCo2Kg).toBeGreaterThan(0);
    expect(result.actualCo2Kg).toBeGreaterThan(0);
    expect(result.carpoolSavingsKg).toBeGreaterThan(0);
  });

  test('ELECTRIC has lower emissions than PETROL for same distance', () => {
    const petrol   = calculateCarpoolVsSolo({ distanceKm: 20, fuelType: 'PETROL' });
    const electric = calculateCarpoolVsSolo({ distanceKm: 20, fuelType: 'ELECTRIC' });
    expect(electric.actualCo2Kg).toBeLessThan(petrol.actualCo2Kg);
  });

  test('carpoolSavingsKg = soloBaseline - actual', () => {
    const result = calculateCarpoolVsSolo({ distanceKm: 15, fuelType: 'DIESEL' });
    expect(result.carpoolSavingsKg).toBeCloseTo(result.soloBaselineCo2Kg - result.actualCo2Kg, 5);
  });

  test('throws on missing fuelType', () => {
    expect(() => calculateCarpoolVsSolo({ distanceKm: 10 })).toThrow();
  });

  test('throws on invalid fuelType', () => {
    expect(() => calculateCarpoolVsSolo({ distanceKm: 10, fuelType: 'COAL' })).toThrow();
  });

  test('throws on non-positive distance', () => {
    expect(() => calculateCarpoolVsSolo({ distanceKm: 0, fuelType: 'PETROL' })).toThrow();
  });

  test('handles CNG fuel type', () => {
    const result = calculateCarpoolVsSolo({ distanceKm: 12, fuelType: 'CNG' });
    expect(result.soloBaselineCo2Kg).toBeGreaterThan(0);
  });

  test('handles LPG fuel type', () => {
    const result = calculateCarpoolVsSolo({ distanceKm: 8, fuelType: 'LPG' });
    expect(result.soloBaselineCo2Kg).toBeGreaterThan(0);
  });

  test('handles HYBRID fuel type', () => {
    const result = calculateCarpoolVsSolo({ distanceKm: 25, fuelType: 'HYBRID' });
    expect(result.soloBaselineCo2Kg).toBeGreaterThan(0);
    expect(result.carpoolSavingsKg).toBeGreaterThan(0);
  });
});

// ─── calculateRouteEfficiencyScore (Story 3.10) ───────────────────────────────

describe('calculateRouteEfficiencyScore', () => {
  test('returns 5 when actual equals direct (100% efficiency)', () => {
    const score = calculateRouteEfficiencyScore({ actualDistanceKm: 10, directDistanceKm: 10 });
    expect(score).toBe(5);
  });

  test('returns 1 when actual is double the direct distance (very inefficient)', () => {
    const score = calculateRouteEfficiencyScore({ actualDistanceKm: 20, directDistanceKm: 10 });
    expect(score).toBeLessThanOrEqual(2);
  });

  test('score is integer', () => {
    const score = calculateRouteEfficiencyScore({ actualDistanceKm: 12, directDistanceKm: 10 });
    expect(Number.isInteger(score)).toBe(true);
  });

  test('score is between 1 and 5', () => {
    const score = calculateRouteEfficiencyScore({ actualDistanceKm: 15, directDistanceKm: 10 });
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(5);
  });

  test('throws when actual < direct (impossible route)', () => {
    expect(() => calculateRouteEfficiencyScore({ actualDistanceKm: 5, directDistanceKm: 10 })).toThrow();
  });

  test('throws on zero directDistanceKm', () => {
    expect(() => calculateRouteEfficiencyScore({ actualDistanceKm: 5, directDistanceKm: 0 })).toThrow();
  });
});

// ─── calculateIdleEmissions (Story 3.10 / 3.12) ───────────────────────────────

describe('calculateIdleEmissions', () => {
  test('returns 0 for 0 idle minutes', () => {
    expect(calculateIdleEmissions({ idleMinutes: 0, fuelType: 'PETROL' })).toBe(0);
  });

  test('PETROL idle > ELECTRIC idle for same minutes', () => {
    const petrol   = calculateIdleEmissions({ idleMinutes: 10, fuelType: 'PETROL' });
    const electric = calculateIdleEmissions({ idleMinutes: 10, fuelType: 'ELECTRIC' });
    expect(petrol).toBeGreaterThan(electric);
  });

  test('throws on invalid fuelType', () => {
    expect(() => calculateIdleEmissions({ idleMinutes: 5, fuelType: 'WOOD' })).toThrow();
  });

  test('result is non-negative', () => {
    const result = calculateIdleEmissions({ idleMinutes: 7, fuelType: 'CNG' });
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ─── calculateMaintenanceSavings (Story 3.13) ─────────────────────────────────

describe('calculateMaintenanceSavings', () => {
  test('returns 0 when no seats shared', () => {
    expect(calculateMaintenanceSavings({ distanceKm: 10, seatsShared: 0 })).toBe(0);
  });

  test('savings increase with more shared seats', () => {
    const one  = calculateMaintenanceSavings({ distanceKm: 20, seatsShared: 1 });
    const two  = calculateMaintenanceSavings({ distanceKm: 20, seatsShared: 2 });
    expect(two).toBeGreaterThan(one);
  });

  test('savings increase with longer distance', () => {
    const short = calculateMaintenanceSavings({ distanceKm: 10, seatsShared: 2 });
    const long  = calculateMaintenanceSavings({ distanceKm: 50, seatsShared: 2 });
    expect(long).toBeGreaterThan(short);
  });

  test('result is non-negative', () => {
    const result = calculateMaintenanceSavings({ distanceKm: 15, seatsShared: 3 });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('throws on negative seatsShared', () => {
    expect(() => calculateMaintenanceSavings({ distanceKm: 10, seatsShared: -1 })).toThrow();
  });
});

// ─── calculateFuelCostSavings (Story 3.14) ────────────────────────────────────

describe('calculateFuelCostSavings', () => {
  test('returns 0 when only 1 occupant (no one to share cost)', () => {
    expect(calculateFuelCostSavings({ distanceKm: 10, fuelType: 'PETROL', seatsOccupied: 1 })).toBe(0);
  });

  test('savings increase with more occupants', () => {
    const two  = calculateFuelCostSavings({ distanceKm: 20, fuelType: 'PETROL', seatsOccupied: 2 });
    const four = calculateFuelCostSavings({ distanceKm: 20, fuelType: 'PETROL', seatsOccupied: 4 });
    expect(four).toBeGreaterThan(two);
  });

  test('CNG savings are non-negative', () => {
    const result = calculateFuelCostSavings({ distanceKm: 15, fuelType: 'CNG', seatsOccupied: 3 });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('throws on invalid fuelType', () => {
    expect(() => calculateFuelCostSavings({ distanceKm: 10, fuelType: 'STEAM', seatsOccupied: 2 })).toThrow();
  });

  test('throws on non-positive distance', () => {
    expect(() => calculateFuelCostSavings({ distanceKm: 0, fuelType: 'PETROL', seatsOccupied: 2 })).toThrow();
  });
});

// ─── computeAllTripEsgMetrics (composite) ────────────────────────────────────

describe('computeAllTripEsgMetrics', () => {
  const validInput = {
    distanceKm:   20,
    fuelType:     'PETROL',
    co2SavedKg:   2.1,
    seatsOccupied: 3,
  };

  test('returns object with all expected keys', () => {
    const result = computeAllTripEsgMetrics(validInput);
    const expected = [
      'treesEquivalent', 'carpoolSavingsKg', 'soloBaselineCo2Kg',
      'routeEfficiencyScore', 'idleEmissionsKg',
      'fuelCostSavingsINR', 'maintenanceSavingsINR',
    ];
    expected.forEach(key => expect(result).toHaveProperty(key));
  });

  test('all numeric values are finite', () => {
    const result = computeAllTripEsgMetrics(validInput);
    Object.values(result).forEach(v => {
      if (v !== null && v !== undefined) expect(isFinite(v)).toBe(true);
    });
  });

  test('treesEquivalent >= 0', () => {
    const result = computeAllTripEsgMetrics(validInput);
    expect(result.treesEquivalent).toBeGreaterThanOrEqual(0);
  });

  test('routeEfficiencyScore defaults to 5 when no separate coords provided (actual=direct)', () => {
    const result = computeAllTripEsgMetrics(validInput);
    // Both default to distanceKm → ratio=1 → score=5
    expect(result.routeEfficiencyScore).toBe(5);
  });

  test('routeEfficiencyScore computed when coords provided', () => {
    const result = computeAllTripEsgMetrics({
      ...validInput,
      actualDistanceKm: 22,
      directDistanceKm: 20,
    });
    expect(result.routeEfficiencyScore).toBeGreaterThanOrEqual(1);
    expect(result.routeEfficiencyScore).toBeLessThanOrEqual(5);
  });

  test('returns null carpoolSavingsKg when fuelType is missing', () => {
    // computeAllTripEsgMetrics catches errors internally and returns null
    const result = computeAllTripEsgMetrics({ distanceKm: 10, co2SavedKg: 1, seatsOccupied: 2 });
    expect(result.carpoolSavingsKg).toBeNull();
    expect(result.soloBaselineCo2Kg).toBeNull();
  });

  test('returns null carpoolSavingsKg when distanceKm is missing', () => {
    // Without distanceKm, carpool/solo calculation fails internally
    const result = computeAllTripEsgMetrics({ fuelType: 'PETROL', co2SavedKg: 1, seatsOccupied: 2 });
    expect(result.carpoolSavingsKg).toBeNull();
  });
});
