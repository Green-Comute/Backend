import {
  getIncidentReports,
  reviewIncident,
  publishGuideline,
  getActiveGuideline,
  acceptGuideline,
  checkGuidelineAcceptance,
} from '../services/moderation.service.js';

/**
 * @fileoverview Admin Safety Controller
 * @description HTTP handlers for admin incident review (5.14) and
 * safety guideline management (5.13).
 * All endpoints require admin or platform admin role (enforced by middleware).
 * @module controllers/adminSafety.controller
 */

// ─── Incident Review (5.14) ──────────────────────────────────────────────────

/**
 * GET /api/admin/incidents
 * List incident reports with optional ?status= filter.
 * Admin only.
 */
export const listIncidents = async (req, res) => {
  try {
    const { status, page } = req.query;
    const result = await getIncidentReports({ status, page: Number(page) || 1 });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('listIncidents error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch incidents' });
  }
};

/**
 * POST /api/admin/incidents/:incidentId/review
 * Take an admin action on an incident report.
 * Body: { action, note }   — action: WARN | INVESTIGATE | SUSPEND
 * Admin only.
 */
export const reviewIncidentHandler = async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, message: 'action is required' });
    }
    const updated = await reviewIncident(
      req.user.userId,
      req.params.incidentId,
      action,
      note
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ─── Safety Guidelines (5.13) ───────────────────────────────────────────────

/**
 * POST /api/admin/guidelines
 * Publish a new safety guideline version.
 * Body: { title, content }
 * Admin only.
 */
export const createGuideline = async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'title and content are required',
      });
    }
    const guideline = await publishGuideline(req.user.userId, { title, content });
    res.status(201).json({ success: true, data: guideline });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/admin/guidelines/active
 * Get the currently active safety guideline (requires auth, any role).
 */
export const getGuideline = async (req, res) => {
  try {
    const guideline = await getActiveGuideline();
    res.status(200).json({ success: true, data: guideline });
  } catch (err) {
    console.error('getGuideline error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch guideline' });
  }
};

/**
 * POST /api/admin/guidelines/:guidelineId/accept
 * Record a user's acceptance of the current guideline version.
 * Authenticated user only.
 */
export const acceptGuidelineHandler = async (req, res) => {
  try {
    const result = await acceptGuideline(req.user.userId, req.params.guidelineId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/admin/guidelines/check-acceptance
 * Check whether the authenticated user needs to accept a new guideline version.
 */
export const checkAcceptanceHandler = async (req, res) => {
  try {
    const result = await checkGuidelineAcceptance(req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('checkAcceptanceHandler error:', err);
    res.status(500).json({ success: false, message: 'Failed to check acceptance' });
  }
};
