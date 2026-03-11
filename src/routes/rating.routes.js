import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { getUserRating, rateDriver, ratePassenger } from '../controllers/rating.controller.js';

/**
 * @fileoverview Rating Routes
 * @description Routes for user-to-user trip ratings (5.1 – 5.3).
 * @module routes/rating.routes
 */

const router = express.Router();

// 5.1 – Average rating for a user
router.get('/user/:userId', verifyToken, getUserRating);

// 5.2 – Passenger rates driver
router.post('/driver', verifyToken, rateDriver);

// 5.3 – Driver rates passenger (double-blind)
router.post('/passenger', verifyToken, ratePassenger);

export default router;
