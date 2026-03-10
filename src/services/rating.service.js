import Rating from '../models/Rating.js';
import Trip from '../models/Trip.js';

/**
 * @fileoverview Rating Service
 * @description Core rating engine for Epic 5 (5.1 – 5.3).
 * Handles rating submission, double-blind visibility, and average calculation.
 * @module services/rating.service
 */

/** How long after a trip completes a rating can be submitted (48 h). */
const RATING_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Minimum rating count before the average is shown to a user (5.1). */
const MIN_VISIBLE_COUNT = 3;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Round to one decimal place using standard rounding.
 * @param {number} value
 * @returns {number}
 */
function roundHalf(value) {
  return Math.round(value * 10) / 10;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculate the average star rating for a target user (5.1).
 *
 * The average is only considered visible when there are ≥3 visible ratings.
 *
 * @param {string} targetUserId - MongoDB ObjectId of the rated user.
 * @returns {Promise<{ avg: number|null, count: number, ratingVisible: boolean }>}
 */
export async function calculateAverageRating(targetUserId) {
  const ratings = await Rating.find({ targetUserId, isVisible: true }).lean();
  const count = ratings.length;
  if (count === 0) return { avg: null, count: 0, ratingVisible: false };

  const sum = ratings.reduce((acc, r) => acc + r.stars, 0);
  const avg = roundHalf(sum / count);
  const ratingVisible = count >= MIN_VISIBLE_COUNT;

  return { avg, count, ratingVisible };
}

/**
 * Submit a rating after a completed trip (5.2 – Passenger rates Driver, 5.3 – Driver rates Passenger).
 *
 * Rules:
 *  - Trip must have status COMPLETED.
 *  - Rating must be submitted within 48 hours of trip completion.
 *  - A reviewer may only submit one rating per trip.
 *  - After submission, check double-blind: if both sides have now submitted,
 *    mark both ratings visible.
 *
 * @param {Object} params
 * @param {string} params.tripId
 * @param {string} params.reviewerId
 * @param {string} params.targetUserId
 * @param {number} params.stars        1–5
 * @param {string} [params.comment]
 * @param {'PASSENGER_TO_DRIVER'|'DRIVER_TO_PASSENGER'} params.ratingType
 * @returns {Promise<Rating>} The created rating document.
 * @throws {Error} With a `statusCode` property for controller error mapping.
 */
export async function submitRating({ tripId, reviewerId, targetUserId, stars, comment, ratingType }) {
  const trip = await Trip.findById(tripId).lean();
  if (!trip) {
    const err = new Error('Trip not found');
    err.statusCode = 404;
    throw err;
  }

  if (trip.status !== 'COMPLETED') {
    const err = new Error('Trip must be completed before rating');
    err.statusCode = 400;
    throw err;
  }

  const completedAt = trip.actualEndTime || trip.updatedAt;
  if (Date.now() - new Date(completedAt).getTime() > RATING_WINDOW_MS) {
    const err = new Error('Rating window has expired (48 hours after trip completion)');
    err.statusCode = 400;
    throw err;
  }

  // Duplicate check (unique index will also catch this, but give a cleaner error)
  const existing = await Rating.findOne({ tripId, reviewerId }).lean();
  if (existing) {
    const err = new Error('You have already rated this trip');
    err.statusCode = 409;
    throw err;
  }

  const rating = await Rating.create({
    tripId,
    reviewerId,
    targetUserId,
    stars,
    comment,
    ratingType,
    isVisible: false,
  });

  // Double-blind check: reveal both ratings if passenger AND driver have submitted
  await revealIfBothSubmitted(tripId);

  return rating;
}

/**
 * Make both trip ratings visible once both parties have submitted (5.3).
 * Called automatically after every new rating submission.
 *
 * @param {string} tripId
 * @returns {Promise<void>}
 */
export async function revealIfBothSubmitted(tripId) {
  const ratings = await Rating.find({ tripId }).lean();

  const hasPassengerRating = ratings.some(r => r.ratingType === 'PASSENGER_TO_DRIVER');
  const hasDriverRating = ratings.some(r => r.ratingType === 'DRIVER_TO_PASSENGER');

  if (hasPassengerRating && hasDriverRating) {
    await Rating.updateMany({ tripId }, { $set: { isVisible: true } });
  }
}

/**
 * Get all visible ratings for a target user.
 *
 * @param {string} targetUserId
 * @returns {Promise<Rating[]>}
 */
export async function getRatingsForUser(targetUserId) {
  return Rating.find({ targetUserId, isVisible: true })
    .sort({ createdAt: -1 })
    .lean();
}
