/**
 * @fileoverview Analytics Service — Epic 3.11 (GDPR / CCPA Compliance)
 * @description Anonymises trip and user data before exposing analytics.
 *   - Removes / hashes all PII fields
 *   - User identifiers are SHA-256 hashed (one-way, consistent per session)
 *   - Used as a middleware wrapper and standalone scrubbing utility
 * @module services/analytics.service
 */

import crypto from 'crypto';

// PII fields that must never appear in analytics output
const PII_FIELDS = [
  'email', 'phone', 'name', 'passwordHash', 'passwordResetToken',
  'homeAddress', 'workAddress', 'emergencyContact',
  'driverDocuments', 'dob',
  // Precise coordinates can be PII — replaced with area-level rounding
];

// Trip-level fields that expose driver identity
const TRIP_PII_FIELDS = ['driverId'];

/**
 * One-way SHA-256 hash of a string identifier.
 * Consistent within a session but not reversible.
 *
 * @param {string} id - Raw identifier (e.g. MongoDB ObjectId string)
 * @returns {string} 16-character hex prefix of the SHA-256 hash
 */
export const hashIdentifier = (id) => {
  if (!id) return null;
  return crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 16);
};

/**
 * Scrub PII from a plain user object.
 *
 * @param {Object} user - Raw user object (Mongoose lean or plain)
 * @returns {Object} Anonymised user object
 */
export const scrubUser = (user) => {
  if (!user) return null;
  const clean = { ...user };
  PII_FIELDS.forEach(field => delete clean[field]);
  if (clean._id)            clean.hashedId = hashIdentifier(String(clean._id));
  if (clean.organizationId) clean.organizationId = hashIdentifier(String(clean.organizationId));
  delete clean._id;
  return clean;
};

/**
 * Scrub PII from a trip document for analytics output.
 * Removes driver identity, rounds coordinates to 2 decimal places (city-level).
 *
 * @param {Object} trip - Raw trip object (Mongoose lean or plain)
 * @returns {Object} Anonymised trip object safe for analytics
 */
export const scrubTrip = (trip) => {
  if (!trip) return null;
  const clean = { ...trip };

  // Hash driver identifier
  TRIP_PII_FIELDS.forEach(field => {
    if (clean[field]) {
      clean[`${field}Hash`] = hashIdentifier(String(clean[field]));
      delete clean[field];
    }
  });

  // Round coordinates (city-level precision, 2 dp ≈ 1.1 km)
  const roundCoords = (locationObj) => {
    if (!locationObj?.coordinates?.coordinates) return locationObj;
    const [lng, lat] = locationObj.coordinates.coordinates;
    return {
      ...locationObj,
      coordinates: {
        ...locationObj.coordinates,
        coordinates: [
          parseFloat(lng.toFixed(2)),
          parseFloat(lat.toFixed(2)),
        ],
      },
      address: undefined, // remove street-level address
    };
  };

  if (clean.sourceLocation)      clean.sourceLocation      = roundCoords(clean.sourceLocation);
  if (clean.destinationLocation) clean.destinationLocation = roundCoords(clean.destinationLocation);

  // Remove personally identifiable text fields
  delete clean.source;
  delete clean.destination;

  return clean;
};

/**
 * Scrub an array of trip documents.
 *
 * @param {Array} trips
 * @returns {Array} Anonymised trips
 */
export const scrubTrips = (trips) => (trips ?? []).map(scrubTrip);

/**
 * Express middleware that scrubs PII from res.json output on analytics routes.
 * Wraps res.json to apply scrubbing automatically.
 *
 * @example
 * // Usage in route
 * router.get('/analytics/trips', requireAuth, requirePlatformAdmin, anonymizeMiddleware, handler);
 */
export const anonymizeMiddleware = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (body?.data?.trips) {
      body.data.trips = scrubTrips(body.data.trips);
    }
    if (body?.data?.users) {
      body.data.users = body.data.users.map(scrubUser);
    }
    return originalJson(body);
  };

  next();
};
