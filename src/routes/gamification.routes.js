import express from 'express';
import requireAuth from '../middlewares/auth.middleware.js';
import {
    getBalance,
    getHistory,
    getTierProgress,
    getLeaderboard,
    getDeptLeaderboard,
    toggleOptOut,
} from '../controllers/gamification.controller.js';

/**
 * @fileoverview Gamification Routes
 * @description Epic-4 user-facing gamification endpoints.
 * All routes require authentication.
 * Mounted in app.js at: /api/gamification
 */
const router = express.Router();

// Story 4.2 — balance widget (high-read, indexed single-doc lookup)
router.get('/balance', requireAuth, getBalance);

// Story 4.3 — points history breakdown
router.get('/history', requireAuth, getHistory);

// Story 4.5 — tier progress bar
router.get('/tier-progress', requireAuth, getTierProgress);

// Story 4.7 — org-wide leaderboard
router.get('/leaderboard', requireAuth, getLeaderboard);

// Story 4.8 — dept-wise leaderboard (?dept=Engineering)
router.get('/leaderboard/dept', requireAuth, getDeptLeaderboard);

// Story 4.13 — privacy opt-out toggle
router.put('/opt-out', requireAuth, toggleOptOut);

export default router;
