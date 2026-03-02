import express from 'express';
import requireAuth from '../middlewares/auth.middleware.js';
import {
    getCatalog,
    redeemReward,
    getMyRedemptions,
} from '../controllers/rewards.controller.js';

/**
 * @fileoverview Rewards Routes (user-facing)
 * @description Mounted at /api/rewards in app.js
 */
const router = express.Router();

// Story 4.9 — rewards catalog
router.get('/catalog', requireAuth, getCatalog);

// Story 4.10 — atomic redemption
router.post('/redeem', requireAuth, redeemReward);

// Story 4.15 — user's redemption history (read-only)
router.get('/my-redemptions', requireAuth, getMyRedemptions);

export default router;
