import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  getSettings,
  patchSettings,
  getGps,
  patchGps,
  getTutorial,
  completeTutorialHandler,
  deleteAccountHandler,
} from '../controllers/privacy.controller.js';

/**
 * @fileoverview Privacy Routes
 * @description Routes for privacy settings hub (5.9), GPS toggle (5.10),
 * onboarding tutorial (5.12), and account deletion (5.15).
 * @module routes/privacy.routes
 */

const router = express.Router();

// 5.9 – Privacy Settings Hub
router.get('/settings', verifyToken, getSettings);
router.patch('/settings', verifyToken, patchSettings);

// 5.10 – GPS Toggle
router.get('/gps', verifyToken, getGps);
router.patch('/gps', verifyToken, patchGps);

// 5.12 – Onboarding Tutorial
router.get('/tutorial', verifyToken, getTutorial);
router.post('/tutorial/complete', verifyToken, completeTutorialHandler);

// 5.15 – Account Deletion
router.delete('/account', verifyToken, deleteAccountHandler);

export default router;
