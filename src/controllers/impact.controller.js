/**
 * @fileoverview Impact Controller — Epic 3 (Stories 3.4, 3.5, 3.6, 3.10, 3.12, 3.13, 3.14)
 * @description Per-trip ESG impact modal data + user lifetime impact summary.
 * @module controllers/impact.controller
 */

import Trip from '../models/Trip.js';
import { computeAllTripEsgMetrics } from '../services/esgCalculation.service.js';
import { getUserLifetimeImpact, getPassengerLifetimeImpact } from '../services/aggregation.service.js';

// ─── GET /impact/trips/:id ────────────────────────────────────────────────────

/**
 * Story 3.4 — Per-Trip Impact Modal
 * Returns full ESG breakdown for a single completed trip.
 * Re-computes live from stored fields; also enriches if ESG fields are missing.
 *
 * @route GET /impact/trips/:id
 * @access Authenticated (own trip driver or org admin or platform admin)
 */
export const getTripImpactModal = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).lean();
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Auth guard — driver can only view their own trip unless admin-level role
    const { userId, role } = req.user;
    const isDriver = String(trip.driverId) === String(userId);
    const isAdmin  = role === 'ORG_ADMIN' || role === 'PLATFORM_ADMIN';
    if (!isDriver && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: not your trip' });
    }

    // If ESG metrics are already persisted use them, else compute on-the-fly
    let esg = {};
    const hasCachedMetrics = trip.treesEquivalent !== null && trip.treesEquivalent !== undefined;

    if (hasCachedMetrics) {
      esg = {
        co2SavedKg:           trip.co2SavedKg,
        treesEquivalent:      trip.treesEquivalent,
        soloBaselineCo2Kg:    trip.soloBaselineCo2Kg,
        carpoolSavingsKg:     trip.carpoolSavingsKg,
        routeEfficiencyScore: trip.routeEfficiencyScore,
        idleEmissionsKg:      trip.idleEmissionsKg,
        fuelCostSavingsINR:   trip.fuelCostSavingsINR,
        maintenanceSavingsINR: trip.maintenanceSavingsINR,
      };
    } else if (trip.distanceKm && trip.fuelType) {
      // seatsOccupied: total passengers + driver, with a minimum of 1
      const passengerCount = (trip.totalSeats ?? 1) - (trip.availableSeats ?? 0);
      const seatsOccupied = Math.max(1, (passengerCount || 0) + 1);
      esg = computeAllTripEsgMetrics({
        distanceKm:   trip.distanceKm,
        fuelType:     trip.fuelType,
        co2SavedKg:   trip.co2SavedKg ?? 0,
        seatsOccupied,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        tripId:        trip._id,
        scheduledTime: trip.scheduledTime,
        vehicleType:   trip.vehicleType,
        fuelType:      trip.fuelType,
        distanceKm:    trip.distanceKm,
        status:        trip.status,
        esg,
      },
    });
  } catch (err) {
    console.error('[impact.controller] getTripImpactModal error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /impact/lifetime ─────────────────────────────────────────────────────

/**
 * Story 3.3 — User Lifetime Impact
 * Returns cumulative ESG stats for the authenticated driver.
 *
 * @route GET /impact/lifetime
 * @access Authenticated driver
 */
export const getUserLifetimeImpactHandler = async (req, res) => {
  try {
    const [asDriver, asPassenger] = await Promise.all([
      getUserLifetimeImpact(req.user.userId),
      getPassengerLifetimeImpact(req.user.userId),
    ]);
    return res.status(200).json({ success: true, data: { asDriver, asPassenger } });
  } catch (err) {
    console.error('[impact.controller] getUserLifetimeImpact error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
