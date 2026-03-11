import bcrypt from 'bcryptjs';
import PrivacySettings from '../models/PrivacySettings.js';
import User from '../models/User.js';
import Trip from '../models/Trip.js';

/**
 * @fileoverview Privacy Service
 * @description Manages privacy settings (5.9), GPS toggle (5.10),
 * tutorial completion (5.12), and account deletion (5.15).
 * @module services/privacy.service
 */

// ─── Privacy Settings (5.9) ─────────────────────────────────────────────────

/**
 * Get (or lazily create) privacy settings for a user.
 *
 * @param {string} userId
 * @returns {Promise<PrivacySettings>}
 */
export async function getPrivacySettings(userId) {
  let settings = await PrivacySettings.findOne({ userId }).lean();
  if (!settings) {
    settings = await PrivacySettings.create({ userId });
    return settings.toObject ? settings.toObject() : settings;
  }
  return settings;
}

/**
 * Update privacy preferences for a user.
 * Only well-known boolean fields are accepted; unknown keys are ignored.
 *
 * @param {string} userId
 * @param {Object} updates  Keys from: hideProfile, hideRatings, hideTrips,
 *                          gpsEnabled, tutorialCompleted, womenOnlyPreference.
 * @returns {Promise<PrivacySettings>} Updated document.
 */
export async function updatePrivacySettings(userId, updates) {
  const allowed = [
    'hideProfile',
    'hideRatings',
    'hideTrips',
    'gpsEnabled',
    'tutorialCompleted',
    'womenOnlyPreference',
  ];

  const sanitized = {};
  for (const key of allowed) {
    if (typeof updates[key] === 'boolean') {
      sanitized[key] = updates[key];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    const err = new Error('No valid boolean settings provided');
    err.statusCode = 400;
    throw err;
  }

  const updated = await PrivacySettings.findOneAndUpdate(
    { userId },
    { $set: sanitized },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return updated;
}

// ─── GPS Toggle (5.10) ──────────────────────────────────────────────────────

/**
 * Toggle GPS on or off for a user.
 *
 * @param {string} userId
 * @param {boolean} enabled
 * @returns {Promise<{ gpsEnabled: boolean }>}
 */
export async function setGpsEnabled(userId, enabled) {
  await PrivacySettings.findOneAndUpdate(
    { userId },
    { $set: { gpsEnabled: enabled } },
    { upsert: true }
  );
  return { gpsEnabled: enabled };
}

/**
 * Check whether GPS is enabled for a user.
 * Defaults to true if no settings document exists yet.
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isGpsEnabled(userId) {
  const settings = await PrivacySettings.findOne({ userId }).select('gpsEnabled').lean();
  return settings ? settings.gpsEnabled : true;
}

// ─── Tutorial Completion (5.12) ─────────────────────────────────────────────

/**
 * Mark the onboarding tutorial as completed for a user.
 *
 * @param {string} userId
 * @returns {Promise<{ tutorialCompleted: boolean }>}
 */
export async function completeTutorial(userId) {
  await PrivacySettings.findOneAndUpdate(
    { userId },
    { $set: { tutorialCompleted: true } },
    { upsert: true }
  );
  return { tutorialCompleted: true };
}

/**
 * Get tutorial completion status for a user.
 *
 * @param {string} userId
 * @returns {Promise<{ tutorialCompleted: boolean }>}
 */
export async function getTutorialStatus(userId) {
  const settings = await PrivacySettings.findOne({ userId })
    .select('tutorialCompleted')
    .lean();
  return { tutorialCompleted: settings ? settings.tutorialCompleted : false };
}

// ─── Account Deletion (5.15) ────────────────────────────────────────────────

/**
 * Permanently delete a user account.
 *
 * Flow:
 *  1. Verify password.
 *  2. Reject if user has an active ride (status STARTED or IN_PROGRESS).
 *  3. Anonymize/delete all user data.
 *
 * @param {string} userId
 * @param {string} password - Plain-text password supplied by the user.
 * @returns {Promise<{ deleted: true }>}
 * @throws {Error} With statusCode 400, 401, or 403 before destructive operations.
 */
export async function deleteAccount(userId, password) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    const err = new Error('Incorrect password');
    err.statusCode = 401;
    throw err;
  }

  // Check for active trips as driver
  const activeTrip = await Trip.findOne({
    $or: [{ driverId: userId }],
    status: { $in: ['STARTED', 'IN_PROGRESS'] },
  }).lean();

  if (activeTrip) {
    const err = new Error('Cannot delete account while a trip is in progress');
    err.statusCode = 400;
    throw err;
  }

  // Anonymize the user document instead of hard-delete for audit purposes
  const anonymizedEmail = `deleted_${userId}@deleted.invalid`;
  await User.findByIdAndUpdate(userId, {
    $set: {
      email: anonymizedEmail,
      phone: `deleted_${userId}`,
      passwordHash: 'DELETED',
      name: 'Deleted User',
      isEmailVerified: false,
      isPhoneVerified: false,
      approvalStatus: 'REJECTED',
      passkeys: [],
    },
    $unset: {
      passwordResetToken: '',
      passwordResetExpires: '',
      driverDocuments: '',
    },
  });

  // Remove privacy settings so the account cannot be linked
  await PrivacySettings.deleteOne({ userId });

  return { deleted: true };
}
