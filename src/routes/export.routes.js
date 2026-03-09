/**
 * @fileoverview Export Routes — Epic 3.8 (ESG Export Reports)
 * @module routes/export.routes
 * @basepath /export
 */

import { Router } from 'express';
import requireAuth from '../middlewares/auth.middleware.js';
import requireOrgAdmin from '../middlewares/orgAdmin.middleware.js';
import { exportEsgCsv, exportEsgPdf } from '../controllers/export.controller.js';

const router = Router();

// All export endpoints require authentication
router.use(requireAuth);

/**
 * GET /export/esg/csv?startDate=&endDate=
 * Story 3.8 — CSV ESG export (org admin or platform admin)
 */
router.get('/esg/csv', requireOrgAdmin, exportEsgCsv);

/**
 * GET /export/esg/pdf?startDate=&endDate=
 * Story 3.8 — PDF/text ESG export (org admin or platform admin)
 */
router.get('/esg/pdf', requireOrgAdmin, exportEsgPdf);

export default router;
