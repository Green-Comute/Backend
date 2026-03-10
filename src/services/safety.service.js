import crypto from 'crypto';
import BlockedUser from '../models/BlockedUser.js';
import EmergencyContact from '../models/EmergencyContact.js';
import IncidentReport from '../models/IncidentReport.js';
import TripShareToken from '../models/TripShareToken.js';
import Trip from '../models/Trip.js';
import User from '../models/User.js';

/**
 * @fileoverview Safety Service
 * @description Handles user blocking (5.4), emergency contacts (5.5),
 * live trip sharing (5.6), safety incident reports (5.7), and
 * women-only ride preference filtering (5.8).
 * @module services/safety.service
 */

/** Phone number validation: E.164 or common local formats. */
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

/** Trip share token TTL: 24 hours expressed as milliseconds. */
const SHARE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum emergency contacts per user (5.5). */
const MAX_EMERGENCY_CONTACTS = 3;

// ─── User Blocking (5.4) ────────────────────────────────────────────────────

/**
 * Block a user. Silently succeeds if block already exists (idempotent at DB layer).
 *
 * @param {string} blockerId - The requesting user's ID.
 * @param {string} blockedId - The target user's ID.
 * @returns {Promise<BlockedUser>}
 * @throws {Error} statusCode 400 if a user tries to block themselves.
 * @throws {Error} statusCode 409 if block already exists.
 */
export async function blockUser(blockerId, blockedId) {
  if (blockerId.toString() === blockedId.toString()) {
    const err = new Error('Cannot block yourself');
    err.statusCode = 400;
    throw err;
  }

  // Check for existing block before attempting insert to give clean 409
  const existing = await BlockedUser.findOne({ blockerId, blockedId }).lean();
  if (existing) {
    const err = new Error('User is already blocked');
    err.statusCode = 409;
    throw err;
  }

  return BlockedUser.create({ blockerId, blockedId });
}

/**
 * Unblock a previously blocked user.
 *
 * @param {string} blockerId
 * @param {string} blockedId
 * @returns {Promise<{ removed: boolean }>}
 */
export async function unblockUser(blockerId, blockedId) {
  const result = await BlockedUser.deleteOne({ blockerId, blockedId });
  return { removed: result.deletedCount > 0 };
}

/**
 * Get the list of users blocked by the requesting user.
 *
 * @param {string} blockerId
 * @returns {Promise<BlockedUser[]>}
 */
export async function getBlockedUsers(blockerId) {
  return BlockedUser.find({ blockerId }).sort({ createdAt: -1 }).lean();
}

/**
 * Filter a list of user IDs to remove any that are blocked by or blocked the viewer.
 * Used in ride/trip search results (5.4).
 *
 * @param {string} viewerId - The user performing the search.
 * @param {string[]} candidateIds - Array of user ID strings to filter.
 * @returns {Promise<string[]>} Filtered list with blocked users removed.
 */
export async function filterBlockedUsers(viewerId, candidateIds) {
  const [blockedByMe, blockedMe] = await Promise.all([
    BlockedUser.find({ blockerId: viewerId }).distinct('blockedId'),
    BlockedUser.find({ blockedId: viewerId }).distinct('blockerId'),
  ]);

  const blockedSet = new Set([
    ...blockedByMe.map(String),
    ...blockedMe.map(String),
  ]);

  return candidateIds.filter(id => !blockedSet.has(String(id)));
}

// ─── Emergency Contacts (5.5) ───────────────────────────────────────────────

/**
 * Add an emergency contact for the requesting user.
 *
 * @param {string} userId
 * @param {{ name: string, phone: string, relationship: string }} data
 * @returns {Promise<EmergencyContact>}
 * @throws {Error} statusCode 400 if phone is invalid or max contacts reached.
 */
export async function addEmergencyContact(userId, { name, phone, relationship }) {
  if (!PHONE_REGEX.test(phone)) {
    const err = new Error('Invalid phone number format');
    err.statusCode = 400;
    throw err;
  }

  const count = await EmergencyContact.countDocuments({ userId });
  if (count >= MAX_EMERGENCY_CONTACTS) {
    const err = new Error(`Maximum ${MAX_EMERGENCY_CONTACTS} emergency contacts allowed`);
    err.statusCode = 400;
    throw err;
  }

  return EmergencyContact.create({ userId, name, phone, relationship });
}

/**
 * Get all emergency contacts for a user.
 *
 * @param {string} userId
 * @returns {Promise<EmergencyContact[]>}
 */
export async function getEmergencyContacts(userId) {
  return EmergencyContact.find({ userId }).sort({ createdAt: 1 }).lean();
}

/**
 * Delete an emergency contact (only if it belongs to the requesting user).
 *
 * @param {string} userId
 * @param {string} contactId
 * @returns {Promise<{ removed: boolean }>}
 */
export async function removeEmergencyContact(userId, contactId) {
  const result = await EmergencyContact.deleteOne({ _id: contactId, userId });
  return { removed: result.deletedCount > 0 };
}

// ─── Live Trip Sharing (5.6) ────────────────────────────────────────────────

/**
 * Generate a share token for a live trip.
 * Requires that GPS is enabled (checked at controller layer via PrivacySettings).
 *
 * @param {string} tripId
 * @param {string} userId
 * @returns {Promise<{ trackingUrl: string, token: string, expiresAt: Date }>}
 * @throws {Error} statusCode 404 if trip not found or not in progress.
 */
export async function generateShareToken(tripId, userId) {
  const trip = await Trip.findById(tripId).lean();
  if (!trip) {
    const err = new Error('Trip not found');
    err.statusCode = 404;
    throw err;
  }

  const shareable = ['SCHEDULED', 'STARTED', 'IN_PROGRESS'];
  if (!shareable.includes(trip.status)) {
    const err = new Error('Cannot share a completed or cancelled trip');
    err.statusCode = 400;
    throw err;
  }

  // Deactivate any previous tokens for this trip+user
  await TripShareToken.updateMany({ tripId, userId }, { $set: { isActive: false } });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SHARE_TOKEN_TTL_MS);

  await TripShareToken.create({ tripId, userId, token, expiresAt, isActive: true });

  const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/track/${token}`;
  return { trackingUrl, token, expiresAt };
}

/**
 * Resolve a share token to a trip.
 *
 * @param {string} token
 * @returns {Promise<{ trip: Trip, expiresAt: Date }>}
 * @throws {Error} statusCode 404 if token invalid, expired, or inactive.
 */
export async function resolveShareToken(token) {
  const record = await TripShareToken.findOne({ token }).lean();
  if (!record || !record.isActive) {
    const err = new Error('Invalid or inactive share link');
    err.statusCode = 404;
    throw err;
  }

  if (new Date() > record.expiresAt) {
    const err = new Error('Share link has expired');
    err.statusCode = 410;
    throw err;
  }

  const trip = await Trip.findById(record.tripId).lean();
  if (!trip) {
    const err = new Error('Trip no longer exists');
    err.statusCode = 404;
    throw err;
  }

  // Automatically deactivate if trip ended
  if (['COMPLETED', 'CANCELLED'].includes(trip.status)) {
    await TripShareToken.updateOne({ token }, { $set: { isActive: false } });
    const err = new Error('Share link has expired because the trip has ended');
    err.statusCode = 410;
    throw err;
  }

  return { trip, expiresAt: record.expiresAt };
}

// ─── Safety Incident Reporting (5.7) ────────────────────────────────────────

/**
 * Create an immutable incident report.
 * Admin alerting is handled by the email service (fire-and-forget).
 *
 * @param {string} tripId
 * @param {string} reporterId
 * @param {string} description
 * @returns {Promise<IncidentReport>}
 */
export async function createIncidentReport(tripId, reporterId, description) {
  if (tripId) {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) {
      const err = new Error('Trip not found');
      err.statusCode = 404;
      throw err;
    }
  }

  return IncidentReport.create({
    reporterId,
    description,
    ...(tripId && { tripId }),
  });
}

// ─── Women-Only Ride Preference (5.8) ───────────────────────────────────────

/**
 * Filter a list of trip documents to only include trips driven by female drivers.
 * Used when the requesting passenger has womenOnlyPreference enabled.
 *
 * @param {Object[]} trips - Array of lean Trip documents (must have driverId).
 * @returns {Promise<{ filtered: Object[], fallback: boolean }>}
 *   filtered – all female-driver trips, or all trips if none are available (fallback).
 *   fallback – true when no women-only trips were found and original list is returned.
 */
export async function applyWomenOnlyFilter(trips) {
  if (!trips.length) return { filtered: [], fallback: false };

  const driverIds = trips.map(t => t.driverId);
  const femaleDrivers = await User.find({
    _id: { $in: driverIds },
    gender: 'FEMALE',
  })
    .select('_id')
    .lean();

  const femaleSet = new Set(femaleDrivers.map(u => String(u._id)));
  const filtered = trips.filter(t => femaleSet.has(String(t.driverId)));

  if (filtered.length === 0) {
    return { filtered: trips, fallback: true };
  }
  return { filtered, fallback: false };
}
