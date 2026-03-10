import {
  calculateAverageRating,
  submitRating,
  getRatingsForUser,
} from '../services/rating.service.js';

/**
 * @fileoverview Rating Controller
 * @description HTTP handlers for user-to-user trip ratings (5.1 – 5.3).
 * @module controllers/rating.controller
 */

/**
 * GET /api/ratings/user/:userId
 * Returns the average rating and public rating list for a target user.
 * Average is hidden when fewer than 3 visible ratings exist (5.1).
 *
 * @route GET /api/ratings/user/:userId
 * @access Private
 */
export const getUserRating = async (req, res) => {
  try {
    const { userId } = req.params;
    const [summary, ratings] = await Promise.all([
      calculateAverageRating(userId),
      getRatingsForUser(userId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        avgRating: summary.ratingVisible ? summary.avg : null,
        ratingCount: summary.count,
        ratingVisible: summary.ratingVisible,
        ratings: summary.ratingVisible ? ratings : [],
      },
    });
  } catch (err) {
    console.error('getUserRating error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch rating' });
  }
};

/**
 * POST /api/ratings/driver
 * Passenger rates driver after a completed trip (5.2).
 *
 * Body: { tripId, targetUserId, stars, comment }
 *
 * @route POST /api/ratings/driver
 * @access Private
 */
export const rateDriver = async (req, res) => {
  try {
    const { tripId, targetUserId, stars, comment } = req.body;

    if (!tripId || !targetUserId || stars === undefined) {
      return res.status(400).json({
        success: false,
        message: 'tripId, targetUserId, and stars are required',
      });
    }

    if (typeof stars !== 'number' || stars < 1 || stars > 5) {
      return res.status(400).json({
        success: false,
        message: 'stars must be a number between 1 and 5',
      });
    }

    const rating = await submitRating({
      tripId,
      reviewerId: req.user.userId,
      targetUserId,
      stars,
      comment,
      ratingType: 'PASSENGER_TO_DRIVER',
    });

    res.status(201).json({ success: true, data: rating });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/ratings/passenger
 * Driver rates passenger (double-blind) after a completed trip (5.3).
 *
 * Body: { tripId, targetUserId, stars, comment }
 *
 * @route POST /api/ratings/passenger
 * @access Private (driver only enforced at trip-ownership level in service)
 */
export const ratePassenger = async (req, res) => {
  try {
    const { tripId, targetUserId, stars, comment } = req.body;

    if (!tripId || !targetUserId || stars === undefined) {
      return res.status(400).json({
        success: false,
        message: 'tripId, targetUserId, and stars are required',
      });
    }

    if (typeof stars !== 'number' || stars < 1 || stars > 5) {
      return res.status(400).json({
        success: false,
        message: 'stars must be a number between 1 and 5',
      });
    }

    const rating = await submitRating({
      tripId,
      reviewerId: req.user.userId,
      targetUserId,
      stars,
      comment,
      ratingType: 'DRIVER_TO_PASSENGER',
    });

    res.status(201).json({ success: true, data: rating });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};
