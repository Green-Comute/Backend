import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  addEmergencyContact,
  getEmergencyContacts,
  removeEmergencyContact,
  generateShareToken,
  resolveShareToken,
  createIncidentReport,
  applyWomenOnlyFilter,
} from '../services/safety.service.js';
import { isGpsEnabled } from '../services/privacy.service.js';
import PrivacySettings from '../models/PrivacySettings.js';

/**
 * @fileoverview Safety Controller
 * @description HTTP handlers for user blocking (5.4), emergency contacts (5.5),
 * live trip sharing (5.6), incident reports (5.7), and women-only filtering (5.8).
 * @module controllers/safety.controller
 */

// ─── User Blocking (5.4) ────────────────────────────────────────────────────

/**
 * POST /api/safety/block
 * Block another user.
 * Body: { blockedId }
 */
export const block = async (req, res) => {
  try {
    const { blockedId } = req.body;
    if (!blockedId) {
      return res.status(400).json({ success: false, message: 'blockedId is required' });
    }
    const record = await blockUser(req.user.userId, blockedId);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/safety/block/:blockedId
 * Unblock a user.
 */
export const unblock = async (req, res) => {
  try {
    const result = await unblockUser(req.user.userId, req.params.blockedId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('unblock error:', err);
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
};

/**
 * GET /api/safety/block
 * Get the authenticated user's block list.
 */
export const listBlocked = async (req, res) => {
  try {
    const list = await getBlockedUsers(req.user.userId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    console.error('listBlocked error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch block list' });
  }
};

// ─── Emergency Contacts (5.5) ───────────────────────────────────────────────

/**
 * POST /api/safety/emergency-contacts
 * Add an emergency contact.
 * Body: { name, phone, relationship }
 */
export const addContact = async (req, res) => {
  try {
    const { name, phone, relationship } = req.body;
    if (!name || !phone || !relationship) {
      return res.status(400).json({
        success: false,
        message: 'name, phone, and relationship are required',
      });
    }
    const contact = await addEmergencyContact(req.user.userId, { name, phone, relationship });
    res.status(201).json({ success: true, data: contact });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/safety/emergency-contacts
 * Get all emergency contacts for the authenticated user.
 */
export const listContacts = async (req, res) => {
  try {
    const contacts = await getEmergencyContacts(req.user.userId);
    res.status(200).json({ success: true, data: contacts });
  } catch (err) {
    console.error('listContacts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
  }
};

/**
 * DELETE /api/safety/emergency-contacts/:contactId
 * Remove an emergency contact.
 */
export const removeContact = async (req, res) => {
  try {
    const result = await removeEmergencyContact(req.user.userId, req.params.contactId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('removeContact error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove contact' });
  }
};

// ─── Live Trip Sharing (5.6) ────────────────────────────────────────────────

/**
 * GET /api/trip/share/:tripId
 * Generate a shareable tracking token for a live trip.
 * Requires GPS to be enabled (checked here).
 */
export const createShareLink = async (req, res) => {
  try {
    const gpsEnabled = await isGpsEnabled(req.user.userId);
    if (!gpsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'GPS must be enabled to share trip location',
      });
    }

    const result = await generateShareToken(req.params.tripId, req.user.userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/trip/track/:token
 * Resolve a share token to a trip (public, no auth required).
 */
export const trackSharedTrip = async (req, res) => {
  try {
    const result = await resolveShareToken(req.params.token);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ─── Safety Incident Reporting (5.7) ────────────────────────────────────────

/**
 * POST /api/safety/incidents
 * Report a safety incident for a trip.
 * Body: { tripId, description }
 */
export const reportIncident = async (req, res) => {
  try {
    const { tripId, description } = req.body;
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'description is required',
      });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'description must be at least 10 characters',
      });
    }

    const report = await createIncidentReport(tripId, req.user.userId, description);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ─── Women-Only Ride Preference (5.8) ───────────────────────────────────────

/**
 * POST /api/safety/women-only/filter
 * Filter a list of trips to only include female drivers.
 * Only applies if the requesting user has womenOnlyPreference enabled.
 *
 * Body: { trips: Trip[] }
 * This is a utility endpoint — in production the frontend calls trip search
 * then this endpoint filters the results based on user preference.
 */
export const womenOnlyFilter = async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = await PrivacySettings.findOne({ userId }).lean();
    const preference = settings ? settings.womenOnlyPreference : false;

    const { trips = [] } = req.body;

    if (!preference) {
      return res.status(200).json({ success: true, data: { trips, applied: false } });
    }

    const { filtered, fallback } = await applyWomenOnlyFilter(trips);
    res.status(200).json({
      success: true,
      data: { trips: filtered, applied: true, fallback },
    });
  } catch (err) {
    console.error('womenOnlyFilter error:', err);
    res.status(500).json({ success: false, message: 'Failed to apply filter' });
  }
};
