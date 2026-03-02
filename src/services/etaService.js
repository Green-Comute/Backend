/**
 * @fileoverview ETA Calculation Service
 * @description Calculates real-time ETA (Estimated Time of Arrival) using the OSRM
 * (Open Source Routing Machine) routing engine. Given a driver's current location and
 * the trip destination, it fetches the optimal driving route and returns the distance
 * and duration remaining.
 *
 * OSRM is free and open-source — no API key required.
 *
 * @module services/etaService
 */

import https from 'https';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetch ETA from OSRM
 *
 * @description Uses OSRM to compute the driving time and distance between two
 * geographic points. Suitable for real-time driver-to-destination ETA updates.
 *
 * @async
 * @param {Object} driverLocation        – Driver's current position
 * @param {number} driverLocation.lat    – Latitude
 * @param {number} driverLocation.lng    – Longitude
 * @param {Object} destination           – Trip destination
 * @param {number} destination.lat       – Latitude
 * @param {number} destination.lng       – Longitude
 *
 * @returns {Promise<Object>} ETA data
 * @returns {number}  result.durationSeconds  – Remaining travel time in seconds
 * @returns {number}  result.distanceMeters   – Remaining distance in metres
 * @returns {string}  result.etaText          – Human-readable ETA ("12 min", "1h 5m")
 * @returns {string}  result.distanceText     – Human-readable distance ("2.3 km")
 * @returns {boolean} [result.fallback]       – True when OSRM was unreachable and
 *                                              Haversine straight-line estimate is used
 */
export const calculateETA = async (driverLocation, destination) => {
  // Guard: both points must be valid
  if (
    !driverLocation?.lat || !driverLocation?.lng ||
    !destination?.lat   || !destination?.lng
  ) {
    return null;
  }

  const coords = `${driverLocation.lng},${driverLocation.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE_URL}/${coords}?overview=false`;

  try {
    const data = await fetchJSON(url);

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error('No route returned by OSRM');
    }

    const route = data.routes[0];
    return {
      durationSeconds: Math.round(route.duration),
      distanceMeters: Math.round(route.distance),
      etaText: formatDuration(route.duration),
      distanceText: formatDistance(route.distance),
      fallback: false
    };
  } catch (err) {
    console.warn('[ETA] OSRM request failed, using Haversine fallback:', err.message);

    // Haversine straight-line estimate (assumes ~40 km/h average speed)
    const distKm = haversineKm(driverLocation, destination);
    const durationSeconds = (distKm / 40) * 3600; // 40 km/h

    return {
      durationSeconds: Math.round(durationSeconds),
      distanceMeters: Math.round(distKm * 1000),
      etaText: formatDuration(durationSeconds),
      distanceText: formatDistance(distKm * 1000),
      fallback: true
    };
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Simple Node https GET → parsed JSON */
const fetchJSON = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, { timeout: 5000 }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Invalid JSON from OSRM')); }
      });
    })
      .on('error', reject)
      .on('timeout', () => reject(new Error('OSRM request timed out')));
  });

/** Format seconds → "5m" / "1h 5m" */
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return m <= 0 ? '<1 min' : `${m} min`;
};

/** Format metres → "800 m" / "2.3 km" */
const formatDistance = (meters) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

/** Haversine great-circle distance in km */
const haversineKm = (p1, p2) => {
  const R = 6371;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toRad = (deg) => (deg * Math.PI) / 180;

export default calculateETA;
