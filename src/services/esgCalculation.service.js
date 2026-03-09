/**
 * @fileoverview ESG Calculation Service — Epic 3
 * @description Pure calculation functions for all per-trip ESG metrics.
 *   Covers stories 3.5, 3.6, 3.10, 3.12, 3.13, and 3.14.
 *   All functions are stateless, side-effect-free, and unit-testable.
 *   Constants are sourced exclusively from config/esgConstants.js.
 * @module services/esgCalculation.service
 */

import {
  KG_CO2_PER_TREE_PER_YEAR,
  SOLO_EMISSION_FACTOR_KG_PER_KM,
  FUEL_TYPE_EMISSION_FACTORS,
  ROUTE_EFFICIENCY,
  IDLE_EMISSION_FACTOR_KG_PER_MIN,
  FUEL_PRICE_INR_PER_LITRE,
  FUEL_EFFICIENCY_KM_PER_LITRE,
  MAINTENANCE_COST_INR_PER_KM,
  MAINTENANCE_WEAR_REDUCTION_PER_PASSENGER,
} from '../config/esgConstants.js';

// ─── 3.5  Tree-Equivalent Visuals ────────────────────────────────────────────

/**
 * Calculate how many trees are needed to absorb an equivalent amount of CO2 per year.
 *
 * Formula: trees = co2SavedKg / KG_CO2_PER_TREE_PER_YEAR
 * Rate: 21 kg CO2 / tree / year (US Forest Service 2025)
 *
 * @param {number} co2SavedKg - CO2 saved in kg (must be >= 0)
 * @returns {number} Tree equivalents (rounded to 4 decimal places)
 * @throws {Error} When co2SavedKg is < 0 or non-numeric
 *
 * @example
 * calculateTreesEquivalent(21)   // => 1.0
 * calculateTreesEquivalent(10.5) // => 0.5
 */
export const calculateTreesEquivalent = (co2SavedKg) => {
  const kg = Number(co2SavedKg);
  if (isNaN(kg)) throw new Error('co2SavedKg must be a number');
  if (kg < 0)    throw new Error('co2SavedKg must be >= 0');

  const trees = parseFloat((kg / KG_CO2_PER_TREE_PER_YEAR).toFixed(4));
  console.log(`[esgCalculation] Trees equivalent: ${kg} kg CO2 / ${KG_CO2_PER_TREE_PER_YEAR} = ${trees} trees`);
  return trees;
};

// ─── 3.6  Carpool vs Solo Comparison ─────────────────────────────────────────

/**
 * Compare actual carpool trip emissions against a solo drive baseline.
 *
 * Solo baseline CO2: SOLO_EMISSION_FACTOR × distanceKm
 * Actual CO2:        sustainableEmissionFactor × distanceKm
 * Savings delta:     soloBaseline - actualCo2
 *
 * @param {Object} params
 * @param {number} params.distanceKm              - Trip distance (> 0)
 * @param {string} params.fuelType                - One of the 6 supported fuel types
 * @returns {{soloBaselineCo2Kg: number, actualCo2Kg: number, carpoolSavingsKg: number}}
 * @throws {Error} On invalid input
 */
export const calculateCarpoolVsSolo = ({ distanceKm, fuelType }) => {
  const dist = Number(distanceKm);
  if (isNaN(dist) || dist <= 0) throw new Error('distanceKm must be > 0');

  const sustainableFactor = FUEL_TYPE_EMISSION_FACTORS[fuelType];
  if (sustainableFactor === undefined) {
    throw new Error(`Unknown fuel type: ${fuelType}. Valid: ${Object.keys(FUEL_TYPE_EMISSION_FACTORS).join(', ')}`);
  }

  const soloBaselineCo2Kg   = parseFloat((SOLO_EMISSION_FACTOR_KG_PER_KM * dist).toFixed(4));
  const actualCo2Kg          = parseFloat((sustainableFactor * dist).toFixed(4));
  const carpoolSavingsKg     = parseFloat((soloBaselineCo2Kg - actualCo2Kg).toFixed(4));

  console.log(`[esgCalculation] Carpool vs Solo: solo=${soloBaselineCo2Kg}kg, actual=${actualCo2Kg}kg, saved=${carpoolSavingsKg}kg`);
  return { soloBaselineCo2Kg, actualCo2Kg, carpoolSavingsKg };
};

// ─── 3.10 Route Efficiency Score (1–5 Leaves) ────────────────────────────────

/**
 * Calculate a route efficiency score on a 1–5 leaf scale.
 *
 * Algorithm:
 *   ratio = actualDistanceKm / directDistanceKm
 *   score = MAX_SCORE - (ratio - MIN_RATIO) / (MAX_RATIO - MIN_RATIO) * (MAX_SCORE - MIN_SCORE)
 *   Clamped to [MIN_SCORE, MAX_SCORE] and rounded to nearest integer.
 *
 * A perfectly direct route (ratio = 1.0) → score 5.
 * A route twice as long (ratio = 2.0) → score 1.
 *
 * @param {Object} params
 * @param {number} params.actualDistanceKm  - Actual route distance (> 0)
 * @param {number} params.directDistanceKm  - Great-circle / direct distance (> 0)
 * @returns {number} Score: integer in [1, 5]
 * @throws {Error} On invalid input or directDistance > actualDistance
 */
export const calculateRouteEfficiencyScore = ({ actualDistanceKm, directDistanceKm }) => {
  const actual = Number(actualDistanceKm);
  const direct = Number(directDistanceKm);

  if (isNaN(actual) || actual <= 0) throw new Error('actualDistanceKm must be > 0');
  if (isNaN(direct) || direct <= 0) throw new Error('directDistanceKm must be > 0');
  if (actual < direct) throw new Error('actualDistanceKm cannot be less than directDistanceKm');

  const { MAX_DEVIATION_RATIO, MIN_DEVIATION_RATIO, MAX_SCORE, MIN_SCORE } = ROUTE_EFFICIENCY;
  const ratio = actual / direct;

  // Linear interpolation: ratio 1.0 → 5, ratio 2.0+ → 1
  let rawScore = MAX_SCORE - ((ratio - MIN_DEVIATION_RATIO) / (MAX_DEVIATION_RATIO - MIN_DEVIATION_RATIO)) * (MAX_SCORE - MIN_SCORE);
  const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(rawScore)));

  console.log(`[esgCalculation] Route efficiency: ratio=${ratio.toFixed(3)}, score=${score}`);
  return score;
};

// ─── 3.12 Idle-Time Impact Metrics ───────────────────────────────────────────

/**
 * Calculate CO2 emitted during idle engine time for a given fuel type.
 *
 * Formula: idleEmissionsKg = idleMinutes × IDLE_EMISSION_FACTOR[fuelType]
 *
 * @param {Object} params
 * @param {number} params.idleMinutes - Minutes of engine idling (>= 0)
 * @param {string} params.fuelType    - One of the 6 supported fuel types
 * @returns {number} Idle CO2 emissions in kg (rounded to 4 decimal places)
 * @throws {Error} On invalid input
 */
export const calculateIdleEmissions = ({ idleMinutes, fuelType }) => {
  const mins = Number(idleMinutes);
  if (isNaN(mins) || mins < 0) throw new Error('idleMinutes must be >= 0');

  const factor = IDLE_EMISSION_FACTOR_KG_PER_MIN[fuelType];
  if (factor === undefined) {
    throw new Error(`Unknown fuel type: ${fuelType}`);
  }

  const idleEmissionsKg = parseFloat((mins * factor).toFixed(4));
  console.log(`[esgCalculation] Idle emissions: ${mins} min × ${factor} = ${idleEmissionsKg} kg`);
  return idleEmissionsKg;
};

// ─── 3.13 Maintenance Savings Insights ───────────────────────────────────────

/**
 * Calculate maintenance cost savings (INR) from vehicle sharing.
 *
 * Algorithm:
 *   baseCost        = distanceKm × MAINTENANCE_COST_INR_PER_KM
 *   passengersCount = seatsShared (number of shared passengers, not counting driver)
 *   wearReduction   = passengersCount × MAINTENANCE_WEAR_REDUCTION_PER_PASSENGER
 *   savings         = baseCost × min(wearReduction, 0.5)   (capped at 50% wear reduction)
 *
 * @param {Object} params
 * @param {number} params.distanceKm    - Trip distance in km (> 0)
 * @param {number} params.seatsShared   - Number of passengers sharing the ride (>= 0)
 * @returns {number} Maintenance savings in INR (rounded to 2 decimal places)
 * @throws {Error} On invalid input
 */
export const calculateMaintenanceSavings = ({ distanceKm, seatsShared }) => {
  const dist   = Number(distanceKm);
  const shared = Number(seatsShared);

  if (isNaN(dist) || dist <= 0)    throw new Error('distanceKm must be > 0');
  if (isNaN(shared) || shared < 0) throw new Error('seatsShared must be >= 0');

  const baseCost      = dist * MAINTENANCE_COST_INR_PER_KM;
  const wearReduction = Math.min(shared * MAINTENANCE_WEAR_REDUCTION_PER_PASSENGER, 0.5); // cap at 50%
  const savingsINR    = parseFloat((baseCost * wearReduction).toFixed(2));

  console.log(`[esgCalculation] Maintenance savings: baseCost=${baseCost.toFixed(2)} INR, wearReduction=${(wearReduction * 100).toFixed(0)}%, savings=${savingsINR} INR`);
  return savingsINR;
};

// ─── 3.14 Fuel Cost Savings ───────────────────────────────────────────────────

/**
 * Calculate fuel cost savings (INR) from using a shared / sustainable vehicle
 * instead of a solo conventional trip.
 *
 * Formula:
 *   soloFuelCost    = (distanceKm / CONVENTIONAL_EFFICIENCY) × PETROL_PRICE
 *   sharedFuelCost  = (distanceKm / FUEL_EFFICIENCY[fuelType]) × FUEL_PRICE[fuelType] / seatsOccupied
 *   savings         = soloFuelCost - sharedFuelCost
 *
 * Note: CONVENTIONAL_EFFICIENCY defaults to PETROL (15 km/litre).
 *
 * @param {Object} params
 * @param {number} params.distanceKm    - Trip distance in km (> 0)
 * @param {string} params.fuelType      - One of the 6 supported fuel types
 * @param {number} params.seatsOccupied - Total occupied seats including driver (>= 1)
 * @returns {number} Fuel cost savings in INR (rounded to 2 decimal places), zero if negative
 * @throws {Error} On invalid input
 */
export const calculateFuelCostSavings = ({ distanceKm, fuelType, seatsOccupied }) => {
  const dist  = Number(distanceKm);
  const seats = Number(seatsOccupied);

  if (isNaN(dist) || dist <= 0)   throw new Error('distanceKm must be > 0');
  if (isNaN(seats) || seats < 1)  throw new Error('seatsOccupied must be >= 1');

  const price      = FUEL_PRICE_INR_PER_LITRE[fuelType];
  const efficiency = FUEL_EFFICIENCY_KM_PER_LITRE[fuelType];
  if (price === undefined || efficiency === undefined) {
    throw new Error(`Unknown fuel type: ${fuelType}`);
  }

  // Conventional solo cost: using petrol as baseline
  const soloFuelCost   = (dist / FUEL_EFFICIENCY_KM_PER_LITRE['PETROL']) * FUEL_PRICE_INR_PER_LITRE['PETROL'];
  // Shared vehicle cost split between all occupants
  const sharedFuelCost = ((dist / efficiency) * price) / seats;
  const savingsINR     = parseFloat(Math.max(0, soloFuelCost - sharedFuelCost).toFixed(2));

  console.log(`[esgCalculation] Fuel cost savings: solo=${soloFuelCost.toFixed(2)} INR, shared=${sharedFuelCost.toFixed(2)} INR, savings=${savingsINR} INR`);
  return savingsINR;
};

// ─── Composite: compute all ESG metrics for a single trip ────────────────────

/**
 * Compute and return all per-trip ESG metrics in one call.
 * Intended for use during trip creation / completion to populate all ESG fields.
 *
 * Stories covered: 3.1, 3.5, 3.6, 3.10, 3.12, 3.13, 3.14
 *
 * @param {Object} params
 * @param {number} params.distanceKm
 * @param {string} params.fuelType
 * @param {number} params.co2SavedKg            - Pre-calculated by carbon.service
 * @param {number} params.seatsOccupied         - Total passengers + driver
 * @param {number} [params.idleMinutes=0]       - Minutes of engine idling
 * @param {number} [params.actualDistanceKm]    - Actual routed distance (defaults to distanceKm)
 * @param {number} [params.directDistanceKm]    - Direct distance (defaults to distanceKm)
 * @returns {Object} All ESG metric fields ready to persist to Trip document
 */
export const computeAllTripEsgMetrics = ({
  distanceKm,
  fuelType,
  co2SavedKg,
  seatsOccupied,
  idleMinutes = 0,
  actualDistanceKm,
  directDistanceKm,
}) => {
  const metrics = {};

  try {
    metrics.treesEquivalent = calculateTreesEquivalent(co2SavedKg);
  } catch (e) {
    console.error('[esgCalculation] treesEquivalent failed:', e.message);
    metrics.treesEquivalent = null;
  }

  try {
    const carpool = calculateCarpoolVsSolo({ distanceKm, fuelType });
    metrics.soloBaselineCo2Kg = carpool.soloBaselineCo2Kg;
    metrics.carpoolSavingsKg  = carpool.carpoolSavingsKg;
  } catch (e) {
    console.error('[esgCalculation] carpoolVsSolo failed:', e.message);
    metrics.soloBaselineCo2Kg = null;
    metrics.carpoolSavingsKg  = null;
  }

  try {
    const aDist = actualDistanceKm ?? distanceKm;
    const dDist = directDistanceKm ?? distanceKm;
    metrics.routeEfficiencyScore = calculateRouteEfficiencyScore({
      actualDistanceKm: aDist,
      directDistanceKm: dDist,
    });
  } catch (e) {
    console.error('[esgCalculation] routeEfficiencyScore failed:', e.message);
    metrics.routeEfficiencyScore = null;
  }

  try {
    metrics.idleEmissionsKg = calculateIdleEmissions({ idleMinutes, fuelType });
  } catch (e) {
    console.error('[esgCalculation] idleEmissions failed:', e.message);
    metrics.idleEmissionsKg = null;
  }

  try {
    const shared = Math.max(0, (seatsOccupied ?? 1) - 1); // passengers excl. driver
    metrics.maintenanceSavingsINR = calculateMaintenanceSavings({ distanceKm, seatsShared: shared });
  } catch (e) {
    console.error('[esgCalculation] maintenanceSavings failed:', e.message);
    metrics.maintenanceSavingsINR = null;
  }

  try {
    metrics.fuelCostSavingsINR = calculateFuelCostSavings({ distanceKm, fuelType, seatsOccupied: seatsOccupied ?? 1 });
  } catch (e) {
    console.error('[esgCalculation] fuelCostSavings failed:', e.message);
    metrics.fuelCostSavingsINR = null;
  }

  return metrics;
};
