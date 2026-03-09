/**
 * @fileoverview ESG Admin Routes — Epic 3 (Stories 3.7, 3.9, 3.15)
 * @module routes/esgAdmin.routes
 * @basepath /esg-admin
 */

import { Router } from 'express';
import requireAuth from '../middlewares/auth.middleware.js';
import requireOrgAdmin from '../middlewares/orgAdmin.middleware.js';
import requirePlatformAdmin from '../middlewares/platform.middleware.js';
import {
  getOrgEsgDashboard,
  getGlobalEsgStats,
  getTopCommutePartnersHandler,
} from '../controllers/esgAdmin.controller.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /esg-admin/dashboard
 * Story 3.7 — Org-level ESG dashboard (org admin only)
 */
router.get('/dashboard', requireOrgAdmin, getOrgEsgDashboard);

/**
 * GET /esg-admin/global
 * Story 3.15 — Platform-wide global ESG stats (platform admin only)
 */
router.get('/global', requirePlatformAdmin, getGlobalEsgStats);

/**
 * GET /esg-admin/commute-partners
 * Story 3.9 — Top commute partners for authenticated driver
 */
router.get('/commute-partners', getTopCommutePartnersHandler);

export default router;
