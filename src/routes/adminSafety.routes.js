import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import requireAdmin from '../middlewares/admin.middleware.js';
import {
  listIncidents,
  reviewIncidentHandler,
  createGuideline,
  getGuideline,
  acceptGuidelineHandler,
  checkAcceptanceHandler,
} from '../controllers/adminSafety.controller.js';

/**
 * @fileoverview Admin Safety Routes
 * @description Routes for admin incident review (5.14) and
 * safety guideline CMS (5.13).
 * Admin routes require verifyToken + requireAdmin middlewares.
 * @module routes/adminSafety.routes
 */

const router = express.Router();

// ─── Admin-only (5.14 Incident Review) ──────────────────────────────────────
router.get('/incidents', verifyToken, requireAdmin, listIncidents);
router.post('/incidents/:incidentId/review', verifyToken, requireAdmin, reviewIncidentHandler);

// ─── Admin-only (5.13 Guideline CMS) ────────────────────────────────────────
router.post('/guidelines', verifyToken, requireAdmin, createGuideline);

// ─── Authenticated user (5.13 guideline acceptance) ─────────────────────────
router.get('/guidelines/active', verifyToken, getGuideline);
router.post('/guidelines/:guidelineId/accept', verifyToken, acceptGuidelineHandler);
router.get('/guidelines/check-acceptance', verifyToken, checkAcceptanceHandler);

export default router;
