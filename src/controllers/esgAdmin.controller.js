/**
 * @fileoverview ESG Admin Controller — Epic 3 (Stories 3.7, 3.9, 3.15)
 * @description Org-level and platform-level ESG dashboards + commute partner rankings.
 * @module controllers/esgAdmin.controller
 */

import { getOrgImpact, getTopCommutePartners, getGlobalImpact } from '../services/aggregation.service.js';

// ─── GET /esg-admin/dashboard ─────────────────────────────────────────────────

/**
 * Story 3.7 — Org-Level ESG Dashboard
 * Returns aggregated ESG stats for the calling org admin's organization.
 *
 * @route GET /esg-admin/dashboard
 * @access ORG_ADMIN
 */
export const getOrgEsgDashboard = async (req, res) => {
  try {
    const { organizationId } = req.user;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No organization associated with this admin' });
    }
    const impact = await getOrgImpact(organizationId);
    return res.status(200).json({ success: true, data: impact });
  } catch (err) {
    console.error('[esgAdmin.controller] getOrgEsgDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /esg-admin/global ────────────────────────────────────────────────────

/**
 * Story 3.15 — Platform-Wide Global Stats
 * Returns platform-wide totals + top 10 orgs by CO2 saved.
 *
 * @route GET /esg-admin/global
 * @access PLATFORM_ADMIN
 */
export const getGlobalEsgStats = async (req, res) => {
  try {
    const stats = await getGlobalImpact();
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error('[esgAdmin.controller] getGlobalEsgStats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /esg-admin/commute-partners ─────────────────────────────────────────

/**
 * Story 3.9 — Top Commute Partner Rankings
 * Returns the top commute partners for the authenticated driver.
 *
 * @route GET /esg-admin/commute-partners
 * @access Authenticated driver (own data)
 */
export const getTopCommutePartnersHandler = async (req, res) => {
  try {
    const limit   = parseInt(req.query.limit) || 5;
    const partners = await getTopCommutePartners(req.user.userId, limit);
    return res.status(200).json({ success: true, data: partners });
  } catch (err) {
    console.error('[esgAdmin.controller] getTopCommutePartners error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
