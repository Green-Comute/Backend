/**
 * @fileoverview Aggregation Service — Epic 3 (3.3, 3.7, 3.9, 3.15)
 * @description Optimised MongoDB aggregation pipelines for lifetime, org-scoped,
 *   and platform-wide ESG metrics. All queries are index-backed for < 2 s response time.
 *   Top commute partner ranking logic also lives here (3.9).
 * @module services/aggregation.service
 */

import mongoose from 'mongoose';
import Trip from '../models/Trip.js';
import RideRequest from '../models/RideRequest.js';
import { SOLO_EMISSION_FACTOR_KG_PER_KM, KG_CO2_PER_TREE_PER_YEAR } from '../config/esgConstants.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── 3.3  Lifetime Impact Aggregation  ───────────────────────────────────────

/**
 * Aggregate lifetime ESG impact totals for a single user (driver).
 * Queries only COMPLETED trips for accuracy.
 *
 * Indexed fields used: driverId, status (see Trip model index: { status, availableSeats })
 *
 * @param {string} driverId - MongoDB ObjectId string
 * @returns {Promise<Object>} Lifetime impact totals
 * @property {number} totalTrips
 * @property {number} totalDistanceKm
 * @property {number} totalCo2SavedKg
 * @property {number} totalFuelCostSavingsINR
 * @property {number} totalMaintenanceSavingsINR
 * @property {number} totalTreesEquivalent
 * @property {number} totalCarpoolSavingsKg
 */
export const getUserLifetimeImpact = async (driverId) => {
  const pipeline = [
    {
      $match: {
        driverId: toObjectId(driverId),
        status: 'COMPLETED',
      },
    },
    {
      $group: {
        _id: null,
        totalTrips:                  { $sum: 1 },
        totalDistanceKm:             { $sum: { $ifNull: ['$distanceKm', 0] } },
        totalCo2SavedKg:             { $sum: { $ifNull: ['$co2SavedKg', 0] } },
        totalFuelCostSavingsINR:     { $sum: { $ifNull: ['$fuelCostSavingsINR', 0] } },
        totalMaintenanceSavingsINR:  { $sum: { $ifNull: ['$maintenanceSavingsINR', 0] } },
        totalTreesEquivalent:        { $sum: { $ifNull: ['$treesEquivalent', 0] } },
        totalCarpoolSavingsKg:       { $sum: { $ifNull: ['$carpoolSavingsKg', 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalTrips:                  1,
        totalDistanceKm:             { $round: ['$totalDistanceKm', 2] },
        totalCo2SavedKg:             { $round: ['$totalCo2SavedKg', 4] },
        totalFuelCostSavingsINR:     { $round: ['$totalFuelCostSavingsINR', 2] },
        totalMaintenanceSavingsINR:  { $round: ['$totalMaintenanceSavingsINR', 2] },
        totalTreesEquivalent:        { $round: ['$totalTreesEquivalent', 4] },
        totalCarpoolSavingsKg:       { $round: ['$totalCarpoolSavingsKg', 4] },
      },
    },
  ];

  const results = await Trip.aggregate(pipeline);
  return results[0] ?? {
    totalTrips: 0,
    totalDistanceKm: 0,
    totalCo2SavedKg: 0,
    totalFuelCostSavingsINR: 0,
    totalMaintenanceSavingsINR: 0,
    totalTreesEquivalent: 0,
    totalCarpoolSavingsKg: 0,
  };
};

// ─── 3.7  Org Admin ESG Dashboard ────────────────────────────────────────────

/**
 * Aggregate ESG metrics scoped to a single organisation.
 * Joins via driverId → User.organizationId.
 *
 * This pipeline does a $lookup to filter by org and is designed for ORG_ADMIN
 * access only. Authentication/role check must be enforced at controller level.
 *
 * @param {string} organizationId - MongoDB ObjectId string of the org
 * @returns {Promise<Object>} Org-level ESG totals + per-fuel-type breakdown
 */
export const getOrgImpact = async (organizationId) => {
  const pipeline = [
    // Join User to get org scope
    {
      $lookup: {
        from: 'users',
        localField: 'driverId',
        foreignField: '_id',
        as: 'driver',
      },
    },
    { $unwind: '$driver' },
    {
      $match: {
        'driver.organizationId': toObjectId(organizationId),
        status: 'COMPLETED',
      },
    },
    // Per-fuel-type breakdown + totals in single pass
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalTrips:                 { $sum: 1 },
              totalDistanceKm:            { $sum: { $ifNull: ['$distanceKm', 0] } },
              totalCo2SavedKg:            { $sum: { $ifNull: ['$co2SavedKg', 0] } },
              totalFuelCostSavingsINR:    { $sum: { $ifNull: ['$fuelCostSavingsINR', 0] } },
              totalMaintenanceSavingsINR: { $sum: { $ifNull: ['$maintenanceSavingsINR', 0] } },
              totalTreesEquivalent:       { $sum: { $ifNull: ['$treesEquivalent', 0] } },
              uniqueDrivers:              { $addToSet: '$driverId' },
            },
          },
          {
            $project: {
              _id: 0,
              totalTrips: 1,
              totalDistanceKm:             { $round: ['$totalDistanceKm', 2] },
              totalCo2SavedKg:             { $round: ['$totalCo2SavedKg', 4] },
              totalFuelCostSavingsINR:     { $round: ['$totalFuelCostSavingsINR', 2] },
              totalMaintenanceSavingsINR:  { $round: ['$totalMaintenanceSavingsINR', 2] },
              totalTreesEquivalent:        { $round: ['$totalTreesEquivalent', 4] },
              uniqueDriverCount:           { $size: '$uniqueDrivers' },
            },
          },
        ],
        byFuelType: [
          {
            $group: {
              _id: { $ifNull: ['$fuelType', 'UNKNOWN'] },
              trips:         { $sum: 1 },
              co2SavedKg:    { $sum: { $ifNull: ['$co2SavedKg', 0] } },
              distanceKm:    { $sum: { $ifNull: ['$distanceKm', 0] } },
            },
          },
          { $sort: { trips: -1 } },
          {
            $project: {
              fuelType:   '$_id',
              _id:         0,
              trips:       1,
              co2SavedKg:  { $round: ['$co2SavedKg', 4] },
              distanceKm:  { $round: ['$distanceKm', 2] },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Trip.aggregate(pipeline);
  const totals = result?.totals?.[0] ?? {
    totalTrips: 0,
    totalDistanceKm: 0,
    totalCo2SavedKg: 0,
    totalFuelCostSavingsINR: 0,
    totalMaintenanceSavingsINR: 0,
    totalTreesEquivalent: 0,
    uniqueDriverCount: 0,
  };

  return { ...totals, byFuelType: result?.byFuelType ?? [] };
};

// ─── 3.9  Top Commute Partner Stats ──────────────────────────────────────────

/**
 * Return the top N commute partners for a given driver, ranked by shared trips.
 *
 * A "commute partner" is a passenger whose ride request was APPROVED on the driver's
 * trips. We aggregate via RideRequest to find passenger IDs, then join for names.
 *
 * @param {string}  driverId  - MongoDB ObjectId string of the driver
 * @param {number}  [limit=5] - Maximum partners to return
 * @returns {Promise<Array>}  Ranked array of { partnerId, partnerName, sharedTrips, co2SavedTogether }
 */
export const getTopCommutePartners = async (driverId, limit = 5) => {
  const pipeline = [
    // Pre-filter to only APPROVED ride requests before joining trips (performance optimisation)
    { $match: { status: 'APPROVED' } },
    // Only approved rides on this driver's trips
    {
      $lookup: {
        from: 'trips',
        localField: 'tripId',
        foreignField: '_id',
        as: 'trip',
      },
    },
    { $unwind: '$trip' },
    {
      $match: {
        'trip.driverId': toObjectId(driverId),
        status: 'APPROVED',
      },
    },
    // Group by passenger
    {
      $group: {
        _id: '$userId',
        sharedTrips:      { $sum: 1 },
        co2SavedTogether: { $sum: { $ifNull: ['$trip.co2SavedKg', 0] } },
      },
    },
    { $sort: { sharedTrips: -1 } },
    { $limit: limit },
    // Join user name
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        partnerId:        '$_id',
        partnerName:      { $ifNull: ['$user.name', 'Unknown'] },
        sharedTrips:      1,
        co2SavedTogether: { $round: ['$co2SavedTogether', 4] },
      },
    },
  ];

  return RideRequest.aggregate(pipeline);
};

// ─── 3.15 Global Impact Stats (Platform Admin) ────────────────────────────────

/**
 * Platform-wide ESG aggregation across ALL organisations.
 * Restricted to PLATFORM_ADMIN role (enforced at controller level).
 *
 * @returns {Promise<Object>} Global ESG totals + per-org breakdown (top 10)
 */
export const getGlobalImpact = async () => {
  const [totalsResult, byOrgResult] = await Promise.all([
    // Global totals single-pass
    Trip.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          totalTrips:                 { $sum: 1 },
          totalDistanceKm:            { $sum: { $ifNull: ['$distanceKm', 0] } },
          totalCo2SavedKg:            { $sum: { $ifNull: ['$co2SavedKg', 0] } },
          totalFuelCostSavingsINR:    { $sum: { $ifNull: ['$fuelCostSavingsINR', 0] } },
          totalMaintenanceSavingsINR: { $sum: { $ifNull: ['$maintenanceSavingsINR', 0] } },
          totalTreesEquivalent:       { $sum: { $ifNull: ['$treesEquivalent', 0] } },
          uniqueDrivers:              { $addToSet: '$driverId' },
        },
      },
      {
        $project: {
          _id: 0,
          totalTrips: 1,
          totalDistanceKm:             { $round: ['$totalDistanceKm', 2] },
          totalCo2SavedKg:             { $round: ['$totalCo2SavedKg', 4] },
          totalFuelCostSavingsINR:     { $round: ['$totalFuelCostSavingsINR', 2] },
          totalMaintenanceSavingsINR:  { $round: ['$totalMaintenanceSavingsINR', 2] },
          totalTreesEquivalent:        { $round: ['$totalTreesEquivalent', 4] },
          uniqueDriverCount:           { $size: '$uniqueDrivers' },
        },
      },
    ]),

    // Top 10 orgs by CO2 saved
    Trip.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $lookup: {
          from: 'users',
          localField: 'driverId',
          foreignField: '_id',
          as: 'driver',
        },
      },
      { $unwind: '$driver' },
      {
        $group: {
          _id: '$driver.organizationId',
          trips:          { $sum: 1 },
          co2SavedKg:     { $sum: { $ifNull: ['$co2SavedKg', 0] } },
          distanceKm:     { $sum: { $ifNull: ['$distanceKm', 0] } },
        },
      },
      { $sort: { co2SavedKg: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'organizations',
          localField: '_id',
          foreignField: '_id',
          as: 'org',
        },
      },
      { $unwind: { path: '$org', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          organizationId: '$_id',
          orgName:    { $ifNull: ['$org.name', 'Unknown'] },
          trips:      1,
          co2SavedKg: { $round: ['$co2SavedKg', 4] },
          distanceKm: { $round: ['$distanceKm', 2] },
        },
      },
    ]),
  ]);

  const totals = totalsResult[0] ?? {
    totalTrips: 0,
    totalDistanceKm: 0,
    totalCo2SavedKg: 0,
    totalFuelCostSavingsINR: 0,
    totalMaintenanceSavingsINR: 0,
    totalTreesEquivalent: 0,
    uniqueDriverCount: 0,
  };

  return { ...totals, topOrganizations: byOrgResult };
};

// ─── Passenger Lifetime Impact ────────────────────────────────────────────────

/**
 * Aggregate lifetime ESG impact for a user AS A PASSENGER.
 * Looks up APPROVED RideRequests on COMPLETED trips and calculates the CO2
 * the user saved by carpooling instead of driving solo.
 *
 * Passenger CO2 saved per ride = SOLO_EMISSION_FACTOR (0.21 kg/km) × distanceKm
 * This represents emissions they would have produced driving alone.
 *
 * @param {string} userId - MongoDB ObjectId string of the passenger
 * @returns {Promise<Object>} Passenger lifetime impact totals
 */
export const getPassengerLifetimeImpact = async (userId) => {
  const pipeline = [
    // Only approved rides
    { $match: { userId: toObjectId(userId), status: 'APPROVED' } },
    // Join trip
    {
      $lookup: {
        from: 'trips',
        localField: 'tripId',
        foreignField: '_id',
        as: 'trip',
      },
    },
    { $unwind: '$trip' },
    // Only completed trips with valid distance
    {
      $match: {
        'trip.status': 'COMPLETED',
        'trip.distanceKm': { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalRides:              { $sum: 1 },
        totalDistanceKm:         { $sum: { $ifNull: ['$trip.distanceKm', 0] } },
        // CO2 saved = what they would have emitted driving solo
        // Uses SOLO_EMISSION_FACTOR_KG_PER_KM from esgConstants.js
        totalCo2SavedKg:         { $sum: { $multiply: [{ $ifNull: ['$trip.distanceKm', 0] }, SOLO_EMISSION_FACTOR_KG_PER_KM] } },
        // fuelCostSavingsINR on the trip is already per-person (divided by seatsOccupied)
        totalFuelCostSavingsINR: { $sum: { $ifNull: ['$trip.fuelCostSavingsINR', 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalRides:              1,
        totalDistanceKm:         { $round: ['$totalDistanceKm', 2] },
        totalCo2SavedKg:         { $round: ['$totalCo2SavedKg', 4] },
        // trees = co2SavedKg / KG_CO2_PER_TREE_PER_YEAR (US Forest Service 2025)
        totalTreesEquivalent:    { $round: [{ $divide: ['$totalCo2SavedKg', KG_CO2_PER_TREE_PER_YEAR] }, 4] },
        totalFuelCostSavingsINR: { $round: ['$totalFuelCostSavingsINR', 2] },
      },
    },
  ];

  const results = await RideRequest.aggregate(pipeline);
  return results[0] ?? {
    totalRides: 0,
    totalDistanceKm: 0,
    totalCo2SavedKg: 0,
    totalTreesEquivalent: 0,
    totalFuelCostSavingsINR: 0,
  };
};
