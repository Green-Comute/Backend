/**
 * @fileoverview Safety Service Tests
 * @description Unit tests for user blocking, emergency contacts, trip sharing,
 * incident reporting, and women-only filtering.
 * Uses Jest mocks for Mongoose models.
 */

import { jest } from '@jest/globals';

// ─── Mock Models ─────────────────────────────────────────────────────────────

const mockBUFindOne = jest.fn();
const mockBUCreate = jest.fn();
const mockBUDeleteOne = jest.fn();
const mockBUFind = jest.fn();

const mockECCountDocuments = jest.fn();
const mockECCreate = jest.fn();
const mockECFind = jest.fn();
const mockECDeleteOne = jest.fn();

const mockTSTCreate = jest.fn();
const mockTSTUpdateMany = jest.fn();
const mockTSTFindOne = jest.fn();
const mockTSTUpdateOne = jest.fn();

const mockIRCreate = jest.fn();

const mockTripFindById = jest.fn();
const mockUserFind = jest.fn();

jest.unstable_mockModule('../models/BlockedUser.js', () => ({
  default: {
    findOne: mockBUFindOne,
    create: mockBUCreate,
    deleteOne: mockBUDeleteOne,
    find: mockBUFind,
  },
}));

jest.unstable_mockModule('../models/EmergencyContact.js', () => ({
  default: {
    countDocuments: mockECCountDocuments,
    create: mockECCreate,
    find: mockECFind,
    deleteOne: mockECDeleteOne,
  },
}));

jest.unstable_mockModule('../models/TripShareToken.js', () => ({
  default: {
    create: mockTSTCreate,
    updateMany: mockTSTUpdateMany,
    findOne: mockTSTFindOne,
    updateOne: mockTSTUpdateOne,
  },
}));

jest.unstable_mockModule('../models/IncidentReport.js', () => ({
  default: { create: mockIRCreate },
}));

jest.unstable_mockModule('../models/Trip.js', () => ({
  default: { findById: mockTripFindById },
}));

jest.unstable_mockModule('../models/User.js', () => ({
  default: { find: mockUserFind },
}));

const {
  blockUser,
  unblockUser,
  getBlockedUsers,
  filterBlockedUsers,
  addEmergencyContact,
  getEmergencyContacts,
  removeEmergencyContact,
  generateShareToken,
  resolveShareToken,
  createIncidentReport,
  applyWomenOnlyFilter,
} = await import('../services/safety.service.js');

// ─── User Blocking ────────────────────────────────────────────────────────────

describe('blockUser', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 400 when blocking self', async () => {
    await expect(blockUser('user1', 'user1')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 409 when block already exists', async () => {
    mockBUFindOne.mockReturnValue({ lean: () => ({ _id: 'b1' }) });
    await expect(blockUser('user1', 'user2')).rejects.toMatchObject({ statusCode: 409 });
  });

  test('creates block record successfully', async () => {
    mockBUFindOne.mockReturnValue({ lean: () => null });
    mockBUCreate.mockResolvedValue({ blockerId: 'user1', blockedId: 'user2' });
    const result = await blockUser('user1', 'user2');
    expect(result).toMatchObject({ blockerId: 'user1' });
  });
});

describe('unblockUser', () => {
  test('returns removed=true when block deleted', async () => {
    mockBUDeleteOne.mockResolvedValue({ deletedCount: 1 });
    const result = await unblockUser('user1', 'user2');
    expect(result).toEqual({ removed: true });
  });

  test('returns removed=false when no block found', async () => {
    mockBUDeleteOne.mockResolvedValue({ deletedCount: 0 });
    const result = await unblockUser('user1', 'user2');
    expect(result).toEqual({ removed: false });
  });
});

describe('getBlockedUsers', () => {
  test('returns block list sorted by createdAt', async () => {
    const list = [{ blockedId: 'u2' }];
    mockBUFind.mockReturnValue({ sort: () => ({ lean: () => list }) });
    const result = await getBlockedUsers('user1');
    expect(result).toEqual(list);
  });
});

describe('filterBlockedUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('removes blocked users from candidate list', async () => {
    mockBUFind.mockImplementation(query => {
      if (query.blockerId) {
        return { distinct: () => Promise.resolve(['u2']) };
      }
      return { distinct: () => Promise.resolve([]) };
    });
    const result = await filterBlockedUsers('u1', ['u2', 'u3']);
    expect(result).toEqual(['u3']);
  });

  test('removes users who blocked the viewer', async () => {
    mockBUFind.mockImplementation(query => {
      if (query.blockerId) {
        return { distinct: () => Promise.resolve([]) };
      }
      // users who blocked viewer
      return { distinct: () => Promise.resolve(['u4']) };
    });
    const result = await filterBlockedUsers('u1', ['u3', 'u4']);
    expect(result).toEqual(['u3']);
  });
});

// ─── Emergency Contacts ───────────────────────────────────────────────────────

describe('addEmergencyContact', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 400 for invalid phone format', async () => {
    await expect(
      addEmergencyContact('u1', { name: 'Jane', phone: 'abc', relationship: 'Sister' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when 3 contacts already exist', async () => {
    mockECCountDocuments.mockResolvedValue(3);
    await expect(
      addEmergencyContact('u1', { name: 'Jane', phone: '+1234567890', relationship: 'Sister' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('creates contact when valid and under limit', async () => {
    mockECCountDocuments.mockResolvedValue(1);
    const contact = { _id: 'c1', name: 'Jane', phone: '+1234567890', relationship: 'Sister' };
    mockECCreate.mockResolvedValue(contact);
    const result = await addEmergencyContact('u1', {
      name: 'Jane',
      phone: '+1234567890',
      relationship: 'Sister',
    });
    expect(result).toMatchObject({ name: 'Jane' });
  });

  test('accepts valid E.164 phone numbers', async () => {
    mockECCountDocuments.mockResolvedValue(0);
    mockECCreate.mockResolvedValue({ phone: '+447123456789' });
    const result = await addEmergencyContact('u1', {
      name: 'Bob',
      phone: '+447123456789',
      relationship: 'Friend',
    });
    expect(result).toBeDefined();
  });
});

// ─── Trip Share Token ─────────────────────────────────────────────────────────

describe('generateShareToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 if trip not found', async () => {
    mockTripFindById.mockReturnValue({ lean: () => null });
    await expect(generateShareToken('t1', 'u1')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 400 if trip is completed', async () => {
    mockTripFindById.mockReturnValue({ lean: () => ({ status: 'COMPLETED' }) });
    await expect(generateShareToken('t1', 'u1')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('returns trackingUrl with token for active trip', async () => {
    mockTripFindById.mockReturnValue({ lean: () => ({ status: 'IN_PROGRESS' }) });
    mockTSTUpdateMany.mockResolvedValue({});
    mockTSTCreate.mockResolvedValue({});
    const result = await generateShareToken('t1', 'u1');
    expect(result).toHaveProperty('trackingUrl');
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('expiresAt');
  });
});

describe('resolveShareToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 for invalid token', async () => {
    mockTSTFindOne.mockReturnValue({ lean: () => null });
    await expect(resolveShareToken('badtoken')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 410 for expired token', async () => {
    mockTSTFindOne.mockReturnValue({
      lean: () => ({
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
        tripId: 't1',
      }),
    });
    await expect(resolveShareToken('tok')).rejects.toMatchObject({ statusCode: 410 });
  });

  test('throws 410 when trip has ended', async () => {
    mockTSTFindOne.mockReturnValue({
      lean: () => ({
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        tripId: 't1',
      }),
    });
    mockTripFindById.mockReturnValue({ lean: () => ({ status: 'COMPLETED' }) });
    mockTSTUpdateOne.mockResolvedValue({});
    await expect(resolveShareToken('tok')).rejects.toMatchObject({ statusCode: 410 });
  });

  test('returns trip for valid active token', async () => {
    const trip = { _id: 't1', status: 'IN_PROGRESS' };
    const expiresAt = new Date(Date.now() + 3600000);
    mockTSTFindOne.mockReturnValue({
      lean: () => ({ isActive: true, expiresAt, tripId: 't1' }),
    });
    mockTripFindById.mockReturnValue({ lean: () => trip });
    const result = await resolveShareToken('validtoken');
    expect(result.trip).toMatchObject({ _id: 't1' });
  });
});

// ─── Women-only Filter ────────────────────────────────────────────────────────

describe('applyWomenOnlyFilter', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns empty array when no trips provided', async () => {
    const result = await applyWomenOnlyFilter([]);
    expect(result).toEqual({ filtered: [], fallback: false });
  });

  test('returns only female-driver trips', async () => {
    const trips = [
      { driverId: 'd1' },
      { driverId: 'd2' },
    ];
    mockUserFind.mockReturnValue({
      select: () => ({ lean: () => [{ _id: 'd1' }] }),
    });
    const result = await applyWomenOnlyFilter(trips);
    expect(result.filtered).toHaveLength(1);
    expect(result.fallback).toBe(false);
  });

  test('returns all trips as fallback when no female drivers found', async () => {
    const trips = [{ driverId: 'd1' }];
    mockUserFind.mockReturnValue({
      select: () => ({ lean: () => [] }),
    });
    const result = await applyWomenOnlyFilter(trips);
    expect(result.filtered).toEqual(trips);
    expect(result.fallback).toBe(true);
  });
});

// ─── getEmergencyContacts ─────────────────────────────────────────────────────

describe('getEmergencyContacts', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns contacts sorted by createdAt', async () => {
    const contacts = [{ _id: 'c1', name: 'Jane' }];
    mockECFind.mockReturnValue({ sort: () => ({ lean: () => contacts }) });
    const result = await getEmergencyContacts('u1');
    expect(result).toEqual(contacts);
    expect(mockECFind).toHaveBeenCalledWith({ userId: 'u1' });
  });
});

// ─── removeEmergencyContact ───────────────────────────────────────────────────

describe('removeEmergencyContact', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns removed=true when contact deleted', async () => {
    mockECDeleteOne.mockResolvedValue({ deletedCount: 1 });
    const result = await removeEmergencyContact('u1', 'c1');
    expect(result).toEqual({ removed: true });
  });

  test('returns removed=false when contact not found', async () => {
    mockECDeleteOne.mockResolvedValue({ deletedCount: 0 });
    const result = await removeEmergencyContact('u1', 'c999');
    expect(result).toEqual({ removed: false });
  });
});

// ─── createIncidentReport ─────────────────────────────────────────────────────

describe('createIncidentReport', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates report with tripId when trip exists', async () => {
    mockTripFindById.mockReturnValue({ lean: () => ({ _id: 't1' }) });
    const report = { _id: 'r1', tripId: 't1', description: 'Bad behaviour' };
    mockIRCreate.mockResolvedValue(report);
    const result = await createIncidentReport('t1', 'u1', 'Bad behaviour');
    expect(result).toMatchObject({ tripId: 't1' });
  });

  test('throws 404 when tripId provided but trip not found', async () => {
    mockTripFindById.mockReturnValue({ lean: () => null });
    await expect(createIncidentReport('bad', 'u1', 'desc')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('creates report without tripId when tripId is null', async () => {
    const report = { _id: 'r2', reporterId: 'u1', description: 'General issue' };
    mockIRCreate.mockResolvedValue(report);
    const result = await createIncidentReport(null, 'u1', 'General issue');
    expect(result).toMatchObject({ description: 'General issue' });
    expect(mockTripFindById).not.toHaveBeenCalled();
  });
});
