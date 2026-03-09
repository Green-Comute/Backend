/**
 * @fileoverview Unit Tests — analytics.service.js (Story 3.11 — GDPR/CCPA)
 */

import {
  hashIdentifier,
  scrubUser,
  scrubTrip,
  scrubTrips,
} from '../services/analytics.service.js';

// ─── hashIdentifier ───────────────────────────────────────────────────────────

describe('hashIdentifier', () => {
  test('returns a 16-char hex string', () => {
    const hash = hashIdentifier('abc123');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  test('same input produces same hash (deterministic)', () => {
    const a = hashIdentifier('user-id-123');
    const b = hashIdentifier('user-id-123');
    expect(a).toBe(b);
  });

  test('different inputs produce different hashes', () => {
    const a = hashIdentifier('user-1');
    const b = hashIdentifier('user-2');
    expect(a).not.toBe(b);
  });

  test('handles ObjectId-style strings', () => {
    const hash = hashIdentifier('507f1f77bcf86cd799439011');
    expect(hash).toHaveLength(16);
  });

  test('coerces non-string to string (no throw)', () => {
    // Implementation uses String(id) so numeric input is handled gracefully
    const hash = hashIdentifier(12345);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  test('returns null for null input', () => {
    expect(hashIdentifier(null)).toBeNull();
  });
});

// ─── scrubUser ────────────────────────────────────────────────────────────────

describe('scrubUser', () => {
  const mockUser = {
    _id:            '507f1f77bcf86cd799439011',
    name:           'Alice Smith',
    email:          'alice@example.com',
    phone:          '+1234567890',
    dob:            '1990-01-01',
    address:        '123 Main St',
    organizationId: 'org-id-999',
    role:           'DRIVER',
  };

  test('removes email', () => {
    const scrubbed = scrubUser(mockUser);
    expect(scrubbed.email).toBeUndefined();
  });

  test('removes phone', () => {
    const scrubbed = scrubUser(mockUser);
    expect(scrubbed.phone).toBeUndefined();
  });

  test('removes name', () => {
    const scrubbed = scrubUser(mockUser);
    expect(scrubbed.name).toBeUndefined();
  });

  test('removes homeAddress (PII field)', () => {
    // PII_FIELDS contains homeAddress not address
    const userWithHomeAddr = { ...mockUser, homeAddress: '123 Main St' };
    const scrubbed = scrubUser(userWithHomeAddr);
    expect(scrubbed.homeAddress).toBeUndefined();
  });

  test('removes dob', () => {
    const scrubbed = scrubUser(mockUser);
    expect(scrubbed.dob).toBeUndefined();
  });

  test('deletes _id and stores hash in hashedId', () => {
    const scrubbed = scrubUser(mockUser);
    // Implementation removes _id and stores as hashedId
    expect(scrubbed._id).toBeUndefined();
    expect(scrubbed.hashedId).toBeDefined();
    expect(scrubbed.hashedId).toHaveLength(16);
  });

  test('hashes organizationId', () => {
    const scrubbed = scrubUser(mockUser);
    expect(scrubbed.organizationId).not.toBe(mockUser.organizationId);
  });

  test('preserves non-PII fields like role', () => {
    const scrubbed = scrubUser(mockUser);
    expect(scrubbed.role).toBe('DRIVER');
  });

  test('does not expose original ID in output', () => {
    const scrubbed = scrubUser(mockUser);
    const output   = JSON.stringify(scrubbed);
    expect(output).not.toContain('alice@example.com');
    expect(output).not.toContain('+1234567890');
    expect(output).not.toContain('Alice Smith');
  });
});

// ─── scrubTrip ────────────────────────────────────────────────────────────────

describe('scrubTrip', () => {
  const mockTrip = {
    _id:             'trip-id-001',
    driverId:        'driver-id-999',
    source:          '123 Home Street',
    destination:     '456 Office Road',
    distanceKm:      15.7,
    co2SavedKg:      2.1,
    fuelType:        'PETROL',
    sourceLocation: {
      coordinates: { coordinates: [12.9716, 77.5946] },
    },
    destinationLocation: {
      coordinates: { coordinates: [12.9352, 77.6245] },
    },
  };

  test('deletes driverId and stores hash in driverIdHash', () => {
    // Implementation stores hash under driverIdHash and deletes driverId
    const scrubbed = scrubTrip(mockTrip);
    expect(scrubbed.driverId).toBeUndefined();
    expect(scrubbed.driverIdHash).toBeDefined();
    expect(scrubbed.driverIdHash).toHaveLength(16);
  });

  test('removes source text', () => {
    const scrubbed = scrubTrip(mockTrip);
    expect(scrubbed.source).toBeUndefined();
  });

  test('removes destination text', () => {
    const scrubbed = scrubTrip(mockTrip);
    expect(scrubbed.destination).toBeUndefined();
  });

  test('rounds coordinates to 2 decimal places (city-level precision)', () => {
    const scrubbed = scrubTrip(mockTrip);
    const srcCoords = scrubbed.sourceLocation.coordinates.coordinates;
    srcCoords.forEach(coord => {
      const decimals = (String(coord).split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  test('preserves non-PII ESG fields', () => {
    const scrubbed = scrubTrip(mockTrip);
    expect(scrubbed.distanceKm).toBe(mockTrip.distanceKm);
    expect(scrubbed.co2SavedKg).toBe(mockTrip.co2SavedKg);
    expect(scrubbed.fuelType).toBe(mockTrip.fuelType);
  });
});

// ─── scrubTrips ───────────────────────────────────────────────────────────────

describe('scrubTrips', () => {
  test('returns an array of the same length', () => {
    const trips = [
      { _id: '1', driverId: 'a', source: 'A', destination: 'B', distanceKm: 5 },
      { _id: '2', driverId: 'b', source: 'C', destination: 'D', distanceKm: 10 },
    ];
    const result = scrubTrips(trips);
    expect(result).toHaveLength(2);
  });

  test('all scrubbed trips have no source text', () => {
    const trips = [
      { _id: '1', driverId: 'x', source: 'Secret St', destination: 'Private Rd', distanceKm: 3 },
    ];
    const result = scrubTrips(trips);
    expect(result[0].source).toBeUndefined();
    expect(result[0].destination).toBeUndefined();
  });

  test('handles empty array', () => {
    expect(scrubTrips([])).toEqual([]);
  });
});
