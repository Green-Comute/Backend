import express from 'express';
import requireAuth from '../middlewares/auth.middleware.js';
import requireOrgAdmin from '../middlewares/orgAdmin.middleware.js';
import {
    listRewardItems,
    createRewardItem,
    updateRewardItem,
    deactivateRewardItem,
    listRedemptions,
    approveRedemption,
    rejectRedemption,
    getOrgTiers,
    updateOrgTiers,
} from '../controllers/rewardsAdmin.controller.js';

/**
 * @fileoverview Rewards Admin Routes
 * @description ORG_ADMIN only. Mounted at /org-admin/rewards in app.js.
 * Follows same pattern as existing orgAdmin.routes.js
 */
const router = express.Router();

// Story 4.11 — Reward item CRUD
router.get('/items', requireAuth, requireOrgAdmin, listRewardItems);
router.post('/items', requireAuth, requireOrgAdmin, createRewardItem);
router.put('/items/:id', requireAuth, requireOrgAdmin, updateRewardItem);
router.delete('/items/:id', requireAuth, requireOrgAdmin, deactivateRewardItem);

// Story 4.12 — Redemption approval queue
router.get('/redemptions', requireAuth, requireOrgAdmin, listRedemptions);
router.post('/redemptions/:id/approve', requireAuth, requireOrgAdmin, approveRedemption);
router.post('/redemptions/:id/reject', requireAuth, requireOrgAdmin, rejectRedemption);

// Story 4.4 — Tier configuration
router.get('/tiers', requireAuth, requireOrgAdmin, getOrgTiers);
router.put('/tiers', requireAuth, requireOrgAdmin, updateOrgTiers);

export default router;
