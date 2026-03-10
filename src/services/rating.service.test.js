/**
 * @fileoverview Rating Service Tests
 * @description Unit tests for rating calculations, submission rules, and double-blind logic.
 * Uses Jest mocks for Mongoose models; no live DB connection required.
 */

import { jest } from '@jest/globals';

// ─── Mock Models ─────────────────────────────────────────────────────────────

const mockRatingFind = jest.fn();
const mockRatingFindOne = jest.fn();
const mockRatingCreate = jest.fn();
const mockRatingUpdateMany = jest.fn();
const mockTripFindById = jest.fn();

jest.unstable_mockModule('../models/Rating.js', () => ({
  default: {
    find: mockRatingFind,
    findOne: mockRatingFindOne,
    create: mockRatingCreate,
    updateMany: mockRatingUpdateMany,
  },
}));

jest.unstable_mockModule('../models/Trip.js', () => ({
  default: { findById: mockTripFindById },
}));

const {
  calculateAverageRating,
  submitRating,
  revealIfBothSubmitted,
  getRatingsForUser,
} = await import('../services/rating.service.js');

// ─── getRatingsForUser ───────────────────────────────────────────────────────

describe('getRatingsForUser', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns visible ratings sorted by createdAt desc', async () => {
    const ratings = [{ _id: 'r1', stars: 5, isVisible: true }];
    mockRatingFind.mockReturnValue({ sort: () => ({ lean: () => ratings }) });
    const result = await getRatingsForUser('user1');
    expect(result).toEqual(ratings);
    expect(mockRatingFind).toHaveBeenCalledWith({ targetUserId: 'user1', isVisible: true });
  });

  test('returns empty array when no visible ratings exist', async () => {
    mockRatingFind.mockReturnValue({ sort: () => ({ lean: () => [] }) });
    const result = await getRatingsForUser('user1');
    expect(result).toEqual([]);
  });
});

// ─── calculateAverageRating ───────────────────────────────────────────────────

describe('calculateAverageRating', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns avg=null and ratingVisible=false when no ratings exist', async () => {
    mockRatingFind.mockReturnValue({ lean: () => [] });
    const result = await calculateAverageRating('user1');
    expect(result).toEqual({ avg: null, count: 0, ratingVisible: false });
  });

  test('returns avg and ratingVisible=false when count < 3', async () => {
    mockRatingFind.mockReturnValue({
      lean: () => [{ stars: 4 }, { stars: 5 }],
    });
    const result = await calculateAverageRating('user1');
    expect(result.count).toBe(2);
    expect(result.ratingVisible).toBe(false);
    expect(result.avg).toBe(4.5);
  });

  test('returns ratingVisible=true when count >= 3', async () => {
    mockRatingFind.mockReturnValue({
      lean: () => [{ stars: 4 }, { stars: 5 }, { stars: 3 }],
    });
    const result = await calculateAverageRating('user1');
    expect(result.ratingVisible).toBe(true);
    expect(result.count).toBe(3);
  });

  test('rounds average to one decimal place', async () => {
    mockRatingFind.mockReturnValue({
      lean: () => [{ stars: 4 }, { stars: 5 }, { stars: 3 }, { stars: 4 }],
    });
    const result = await calculateAverageRating('user1');
    // (4+5+3+4)/4 = 16/4 = 4.0
    expect(result.avg).toBe(4.0);
  });

  test('rounds 4.666... to 4.7', async () => {
    mockRatingFind.mockReturnValue({
      lean: () => [{ stars: 5 }, { stars: 5 }, { stars: 4 }],
    });
    const result = await calculateAverageRating('user1');
    // (5+5+4)/3 = 14/3 ≈ 4.666 → 4.7
    expect(result.avg).toBe(4.7);
  });
});

// ─── submitRating ────────────────────────────────────────────────────────────

describe('submitRating', () => {
  beforeEach(() => jest.clearAllMocks());

  const validParams = {
    tripId: 'trip1',
    reviewerId: 'user1',
    targetUserId: 'driver1',
    stars: 5,
    comment: 'Great driver',
    ratingType: 'PASSENGER_TO_DRIVER',
  };

  test('throws 404 if trip not found', async () => {
    mockTripFindById.mockReturnValue({ lean: () => null });
    await expect(submitRating(validParams)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 400 if trip is not COMPLETED', async () => {
    mockTripFindById.mockReturnValue({
      lean: () => ({ status: 'IN_PROGRESS', updatedAt: new Date() }),
    });
    await expect(submitRating(validParams)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 if rating submitted after 48-hour window', async () => {
    const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000); // 49 hours ago
    mockTripFindById.mockReturnValue({
      lean: () => ({ status: 'COMPLETED', actualEndTime: oldDate }),
    });
    await expect(submitRating(validParams)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 409 if duplicate rating for same trip', async () => {
    mockTripFindById.mockReturnValue({
      lean: () => ({
        status: 'COMPLETED',
        actualEndTime: new Date(Date.now() - 1000),
      }),
    });
    mockRatingFindOne.mockReturnValue({ lean: () => ({ _id: 'existing' }) });
    await expect(submitRating(validParams)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('creates rating and returns document on success', async () => {
    mockTripFindById.mockReturnValue({
      lean: () => ({
        status: 'COMPLETED',
        actualEndTime: new Date(Date.now() - 1000),
      }),
    });
    mockRatingFindOne.mockReturnValue({ lean: () => null });
    const created = { _id: 'rating1', ...validParams, isVisible: false };
    mockRatingCreate.mockResolvedValue(created);
    // revealIfBothSubmitted mock
    mockRatingFind.mockReturnValue({ lean: () => [created] });
    mockRatingUpdateMany.mockResolvedValue({});

    const result = await submitRating(validParams);
    expect(result).toMatchObject({ _id: 'rating1' });
    expect(mockRatingCreate).toHaveBeenCalledTimes(1);
  });

  test('links rating to the correct trip', async () => {
    mockTripFindById.mockReturnValue({
      lean: () => ({
        status: 'COMPLETED',
        actualEndTime: new Date(Date.now() - 1000),
      }),
    });
    mockRatingFindOne.mockReturnValue({ lean: () => null });
    mockRatingCreate.mockResolvedValue({ tripId: 'trip1' });
    mockRatingFind.mockReturnValue({ lean: () => [] });

    const result = await submitRating(validParams);
    expect(result.tripId).toBe('trip1');
  });
});

// ─── revealIfBothSubmitted ───────────────────────────────────────────────────

describe('revealIfBothSubmitted', () => {
  beforeEach(() => jest.clearAllMocks());

  test('does NOT reveal ratings if only one side submitted', async () => {
    mockRatingFind.mockReturnValue({
      lean: () => [{ ratingType: 'PASSENGER_TO_DRIVER' }],
    });
    await revealIfBothSubmitted('trip1');
    expect(mockRatingUpdateMany).not.toHaveBeenCalled();
  });

  test('reveals BOTH ratings when both sides have submitted', async () => {
    mockRatingFind.mockReturnValue({
      lean: () => [
        { ratingType: 'PASSENGER_TO_DRIVER' },
        { ratingType: 'DRIVER_TO_PASSENGER' },
      ],
    });
    mockRatingUpdateMany.mockResolvedValue({});
    await revealIfBothSubmitted('trip1');
    expect(mockRatingUpdateMany).toHaveBeenCalledWith(
      { tripId: 'trip1' },
      { $set: { isVisible: true } }
    );
  });
});
