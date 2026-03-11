import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { createShareLink, trackSharedTrip } from '../controllers/safety.controller.js';

/**
 * @fileoverview Trip Share Routes
 * @description Routes for live trip sharing tokens (5.6).
 * Kept separate from safety.routes to follow the /api/trip namespace.
 * @module routes/tripShare.routes
 */

const router = express.Router();

// 5.6 – Generate a shareable tracking link for an active trip
router.get('/share/:tripId', verifyToken, createShareLink);

// 5.6 – Resolve a share token (public — no auth required)
router.get('/track/:token', trackSharedTrip);

export default router;
