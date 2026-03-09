/**
 * @fileoverview Impact Routes — Epic 3 (Stories 3.3, 3.4)
 * @module routes/impact.routes
 * @basepath /impact
 */

import { Router } from 'express';
import requireAuth from '../middlewares/auth.middleware.js';
import { getTripImpactModal, getUserLifetimeImpactHandler } from '../controllers/impact.controller.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /impact/lifetime
 * Story 3.3 — Driver lifetime cumulative ESG stats
 */
router.get('/lifetime', getUserLifetimeImpactHandler);

/**
 * GET /impact/trips/:id
 * Story 3.4 — Per-trip ESG impact modal
 */
router.get('/trips/:id', getTripImpactModal);

export default router;
