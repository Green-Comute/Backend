import express from 'express';
import requireAuth from '../middlewares/auth.middleware.js';
import requirePlatformAdmin from '../middlewares/platform.middleware.js';
import { getPointRules, updatePointRules } from '../controllers/pointRules.controller.js';

/**
 * @fileoverview Platform Point Rules Routes
 * @description PLATFORM_ADMIN only. Mounted at /platform/point-rules in app.js.
 * Follows same pattern as existing platform.routes.js
 */
const router = express.Router();

// Story 4.14 — Global point rules config dashboard
router.get('/', requireAuth, requirePlatformAdmin, getPointRules);
router.put('/', requireAuth, requirePlatformAdmin, updatePointRules);

export default router;
