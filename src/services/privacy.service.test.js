/**
 * @fileoverview Privacy Service Tests
 * @description Unit tests for privacy settings, GPS toggle, tutorial tracking,
 * and account deletion logic.
 * Uses Jest mocks for Mongoose models.
 */

import { jest } from '@jest/globals';

// ─── Mock Models ─────────────────────────────────────────────────────────────

const mockPSFindOne = jest.fn();
const mockPSCreate = jest.fn();
const mockPSFAU = jest.fn(); // findOneAndUpdate
const mockPSDeleteOne = jest.fn();

const mockUserFindById = jest.fn();
const mockUserFABIU = jest.fn(); // findByIdAndUpdate

const mockTripFindOne = jest.fn();

jest.unstable_mockModule('../models/PrivacySettings.js', () => ({
  default: {
    findOne: mockPSFindOne,
    create: mockPSCreate,
    findOneAndUpdate: mockPSFAU,
    deleteOne: mockPSDeleteOne,
  },
}));

jest.unstable_mockModule('../models/User.js', () => ({
  default: {
    findById: mockUserFindById,
    findByIdAndUpdate: mockUserFABIU,
  },
}));

jest.unstable_mockModule('../models/Trip.js', () => ({
  default: { findOne: mockTripFindOne },
}));

// Mock bcryptjs
jest.unstable_mockModule('bcryptjs', () => ({
  default: { compare: jest.fn() },
}));

const bcrypt = (await import('bcryptjs')).default;

const {
  getPrivacySettings,
  updatePrivacySettings,
  setGpsEnabled,
  isGpsEnabled,
  completeTutorial,
  getTutorialStatus,
  deleteAccount,
} = await import('../services/privacy.service.js');

// ─── getPrivacySettings ──────────────────────────────────────────────────────

describe('getPrivacySettings', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns existing settings document', async () => {
    const settings = { userId: 'u1', hideProfile: false };
    mockPSFindOne.mockReturnValue({ lean: () => settings });
    const result = await getPrivacySettings('u1');
    expect(result).toEqual(settings);
  });

  test('creates default settings if none exist', async () => {
    mockPSFindOne.mockReturnValue({ lean: () => null });
    const created = { userId: 'u1', hideProfile: false };
    mockPSCreate.mockResolvedValue({ toObject: () => created });
    const result = await getPrivacySettings('u1');
    expect(result).toMatchObject({ userId: 'u1' });
  });
});

// ─── updatePrivacySettings ───────────────────────────────────────────────────

describe('updatePrivacySettings', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 400 when no valid boolean fields provided', async () => {
    await expect(
      updatePrivacySettings('u1', { unknownField: 'value' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('updates allowed boolean fields', async () => {
    const updated = { userId: 'u1', hideProfile: true };
    mockPSFAU.mockReturnValue({ lean: () => updated });
    const result = await updatePrivacySettings('u1', { hideProfile: true });
    expect(result).toMatchObject({ hideProfile: true });
  });

  test('ignores non-boolean values for valid keys', async () => {
    const updated = { userId: 'u1', hideTrips: false };
    mockPSFAU.mockReturnValue({ lean: () => updated });
    // hideProfile is string, should be ignored. hideTrips is boolean.
    await updatePrivacySettings('u1', { hideProfile: 'yes', hideTrips: false });
    const callArg = mockPSFAU.mock.calls[0][1];
    expect(callArg.$set.hideProfile).toBeUndefined();
    expect(callArg.$set.hideTrips).toBe(false);
  });

  test('persists womenOnlyPreference correctly', async () => {
    const updated = { womenOnlyPreference: true };
    mockPSFAU.mockReturnValue({ lean: () => updated });
    const result = await updatePrivacySettings('u1', { womenOnlyPreference: true });
    expect(result).toMatchObject({ womenOnlyPreference: true });
  });
});

// ─── GPS Toggle ──────────────────────────────────────────────────────────────

describe('setGpsEnabled', () => {
  beforeEach(() => jest.clearAllMocks());

  test('upserts gpsEnabled=true', async () => {
    mockPSFAU.mockResolvedValue({});
    const result = await setGpsEnabled('u1', true);
    expect(result).toEqual({ gpsEnabled: true });
  });

  test('upserts gpsEnabled=false', async () => {
    mockPSFAU.mockResolvedValue({});
    const result = await setGpsEnabled('u1', false);
    expect(result).toEqual({ gpsEnabled: false });
  });
});

describe('isGpsEnabled', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns true by default when no settings document exists', async () => {
    mockPSFindOne.mockReturnValue({ select: () => ({ lean: () => null }) });
    const result = await isGpsEnabled('u1');
    expect(result).toBe(true);
  });

  test('returns stored gpsEnabled value', async () => {
    mockPSFindOne.mockReturnValue({
      select: () => ({ lean: () => ({ gpsEnabled: false }) }),
    });
    const result = await isGpsEnabled('u1');
    expect(result).toBe(false);
  });
});

// ─── Tutorial ────────────────────────────────────────────────────────────────

describe('completeTutorial', () => {
  test('returns tutorialCompleted=true', async () => {
    mockPSFAU.mockResolvedValue({});
    const result = await completeTutorial('u1');
    expect(result).toEqual({ tutorialCompleted: true });
  });
});

describe('getTutorialStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns false if no settings exist', async () => {
    mockPSFindOne.mockReturnValue({ select: () => ({ lean: () => null }) });
    const result = await getTutorialStatus('u1');
    expect(result).toEqual({ tutorialCompleted: false });
  });

  test('returns stored tutorialCompleted value', async () => {
    mockPSFindOne.mockReturnValue({
      select: () => ({ lean: () => ({ tutorialCompleted: true }) }),
    });
    const result = await getTutorialStatus('u1');
    expect(result).toEqual({ tutorialCompleted: true });
  });
});

// ─── Account Deletion ────────────────────────────────────────────────────────

describe('deleteAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 if user not found', async () => {
    mockUserFindById.mockResolvedValue(null);
    await expect(deleteAccount('u1', 'pw')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 401 if password is incorrect', async () => {
    mockUserFindById.mockResolvedValue({ passwordHash: 'hash' });
    bcrypt.compare.mockResolvedValue(false);
    await expect(deleteAccount('u1', 'wrongpw')).rejects.toMatchObject({ statusCode: 401 });
  });

  test('throws 400 if user has an active trip', async () => {
    mockUserFindById.mockResolvedValue({ passwordHash: 'hash' });
    bcrypt.compare.mockResolvedValue(true);
    mockTripFindOne.mockReturnValue({ lean: () => ({ _id: 'trip1', status: 'IN_PROGRESS' }) });
    await expect(deleteAccount('u1', 'pw')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('deletes account successfully after checks pass', async () => {
    mockUserFindById.mockResolvedValue({ passwordHash: 'hash' });
    bcrypt.compare.mockResolvedValue(true);
    mockTripFindOne.mockReturnValue({ lean: () => null });
    mockUserFABIU.mockResolvedValue({});
    mockPSDeleteOne.mockResolvedValue({});
    const result = await deleteAccount('u1', 'pw');
    expect(result).toEqual({ deleted: true });
  });

  test('prevents login after deletion (email anonymized)', async () => {
    mockUserFindById.mockResolvedValue({ _id: 'u1', passwordHash: 'hash' });
    bcrypt.compare.mockResolvedValue(true);
    mockTripFindOne.mockReturnValue({ lean: () => null });
    mockUserFABIU.mockResolvedValue({});
    mockPSDeleteOne.mockResolvedValue({});
    await deleteAccount('u1', 'pw');
    const updateCall = mockUserFABIU.mock.calls[0];
    expect(updateCall[1].$set.email).toMatch(/deleted_/);
    expect(updateCall[1].$set.passwordHash).toBe('DELETED');
  });
});
