import {
  getPrivacySettings,
  updatePrivacySettings,
  setGpsEnabled,
  isGpsEnabled,
  completeTutorial,
  getTutorialStatus,
  deleteAccount,
} from '../services/privacy.service.js';

/**
 * @fileoverview Privacy Controller
 * @description HTTP handlers for privacy settings (5.9), GPS toggle (5.10),
 * onboarding tutorial (5.12), and account deletion (5.15).
 * @module controllers/privacy.controller
 */

// ─── Privacy Settings (5.9) ─────────────────────────────────────────────────

/**
 * GET /api/privacy/settings
 * Retrieve the authenticated user's privacy preferences.
 */
export const getSettings = async (req, res) => {
  try {
    const settings = await getPrivacySettings(req.user.userId);
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

/**
 * PATCH /api/privacy/settings
 * Update one or more privacy preferences.
 * Body: any combination of { hideProfile, hideRatings, hideTrips, gpsEnabled,
 *                            tutorialCompleted, womenOnlyPreference }
 */
export const patchSettings = async (req, res) => {
  try {
    const updated = await updatePrivacySettings(req.user.userId, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ─── GPS Toggle (5.10) ──────────────────────────────────────────────────────

/**
 * GET /api/privacy/gps
 * Check current GPS enabled state.
 */
export const getGps = async (req, res) => {
  try {
    const gpsEnabled = await isGpsEnabled(req.user.userId);
    res.status(200).json({ success: true, data: { gpsEnabled } });
  } catch (err) {
    console.error('getGps error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch GPS status' });
  }
};

/**
 * PATCH /api/privacy/gps
 * Toggle GPS on or off.
 * Body: { enabled: boolean }
 */
export const patchGps = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean',
      });
    }
    const result = await setGpsEnabled(req.user.userId, enabled);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('patchGps error:', err);
    res.status(500).json({ success: false, message: 'Failed to update GPS setting' });
  }
};

// ─── Onboarding Tutorial (5.12) ─────────────────────────────────────────────

/**
 * GET /api/privacy/tutorial
 * Check if the user has completed the onboarding tutorial.
 */
export const getTutorial = async (req, res) => {
  try {
    const status = await getTutorialStatus(req.user.userId);
    res.status(200).json({ success: true, data: status });
  } catch (err) {
    console.error('getTutorial error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tutorial status' });
  }
};

/**
 * POST /api/privacy/tutorial/complete
 * Mark the onboarding tutorial as completed (skipped or finished).
 */
export const completeTutorialHandler = async (req, res) => {
  try {
    const result = await completeTutorial(req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('completeTutorial error:', err);
    res.status(500).json({ success: false, message: 'Failed to update tutorial status' });
  }
};

// ─── Account Deletion (5.15) ────────────────────────────────────────────────

/**
 * DELETE /api/privacy/account
 * Permanently delete the authenticated user's account.
 * Body: { password }
 */
export const deleteAccountHandler = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'password is required to confirm account deletion',
      });
    }
    const result = await deleteAccount(req.user.userId, password);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};
