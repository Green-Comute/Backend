/**
 * @fileoverview ESG Constants — 2025 EPA Verified Data
 * @description Centralised, configurable constants for all ESG calculations in Epic 3.
 *
 * Sources:
 *  - EPA 2025 Emission Factors for Greenhouse Gas Inventories (Table 2 & 3)
 *  - IEA 2025 Vehicle Emission Intensity Guide
 *  - U.S. Forest Service 2025 Urban Tree Carbon Guide (21 kg CO2/tree/year)
 *  - AAA 2025 Your Driving Costs study (maintenance & fuel data)
 *
 * All values are configurable via this file.
 * DO NOT hard-code these values in service files.
 *
 * @module config/esgConstants
 */

// ─── Emission Factors (kg CO2 per km) ────────────────────────────────────────
// EPA 2025 average passenger vehicle fleet data

/** kg CO2 / km for an average conventional (petrol/diesel) solo vehicle */
export const CONVENTIONAL_EMISSION_FACTOR_KG_PER_KM = 0.21;

/**
 * Per-fuel-type sustainable emission factors (kg CO2 / km).
 * These represent real-world average values for shared commute scenarios.
 */
export const FUEL_TYPE_EMISSION_FACTORS = {
  PETROL:   0.14,   // Shared petrol vehicle (avg 2025)
  DIESEL:   0.12,   // Shared diesel vehicle
  ELECTRIC: 0.03,   // Battery EV (grid-average 2025 US)
  HYBRID:   0.07,   // Plug-in hybrid
  CNG:      0.09,   // Compressed natural gas
  LPG:      0.10,   // Liquefied petroleum gas
};

// ─── Tree Equivalence ─────────────────────────────────────────────────────────
/**
 * kg of CO2 absorbed by a single tree per year (urban average, US Forest Service 2025).
 * Trees equivalent = CO2 saved (kg) / KG_CO2_PER_TREE_PER_YEAR
 */
export const KG_CO2_PER_TREE_PER_YEAR = 21;

// ─── Solo Baseline ────────────────────────────────────────────────────────────
/**
 * Emission factor for a solo driver in a conventional vehicle (kg CO2/km).
 * Used as the baseline for carpool savings comparison.
 * Intentionally references CONVENTIONAL_EMISSION_FACTOR_KG_PER_KM to avoid drift.
 */
export const SOLO_EMISSION_FACTOR_KG_PER_KM = CONVENTIONAL_EMISSION_FACTOR_KG_PER_KM;

// ─── Route Efficiency Score ───────────────────────────────────────────────────
/**
 * Maximum acceptable deviation ratio (actual / direct distance).
 * A route exactly on the direct line = ratio 1.0 → score 5.
 * A route 100% longer (ratio 2.0) = score 1.
 */
export const ROUTE_EFFICIENCY = {
  MAX_DEVIATION_RATIO: 2.0,  // ratio ≥ this → score 1
  MIN_DEVIATION_RATIO: 1.0,  // ratio ≤ this → score 5
  MAX_SCORE: 5,
  MIN_SCORE: 1,
};

// ─── Idle Time ────────────────────────────────────────────────────────────────
/**
 * CO2 emitted per minute of engine idle (kg CO2/min), per fuel type.
 * EPA 2025 estimation.
 */
export const IDLE_EMISSION_FACTOR_KG_PER_MIN = {
  PETROL:   0.0027, // 2025 EPA
  DIESEL:   0.0030,
  ELECTRIC: 0.0000, // no tailpipe emissions
  HYBRID:   0.0010, // engine off at idle in most configurations
  CNG:      0.0022,
  LPG:      0.0025,
};

// ─── Fuel Cost Savings ────────────────────────────────────────────────────────
/**
 * Local fuel price per litre (INR), configurable per fuel type.
 * Updated Q1 2025 India average prices.
 */
export const FUEL_PRICE_INR_PER_LITRE = {
  PETROL:   103.0,
  DIESEL:    91.0,
  ELECTRIC:   7.5,  // INR per kWh equivalent (cost per km normalised)
  HYBRID:    95.0,  // treated as petrol-equivalent pricing
  CNG:       74.0,  // per kg (CNG vehicle parity)
  LPG:       56.0,  // per litre LPG
};

/**
 * Vehicle fuel efficiency (km per litre, or equivalent) per fuel type.
 * Source: ARAI 2025 average fleet data for India.
 */
export const FUEL_EFFICIENCY_KM_PER_LITRE = {
  PETROL:   15.0,
  DIESEL:   18.0,
  ELECTRIC: 7.0,   // km per kWh (used with ELECTRIC price)
  HYBRID:   22.0,
  CNG:      22.0,
  LPG:      14.0,
};

// ─── Maintenance Savings ──────────────────────────────────────────────────────
/**
 * Average maintenance cost per km (INR) for conventional vehicles (AAA / CRISIL 2025).
 * MaintenanceSavings = distanceKm × MAINTENANCE_COST_PER_KM × seatsShared / totalCar
 */
export const MAINTENANCE_COST_INR_PER_KM = 3.5;

/**
 * Fraction of maintenance cost saved by carpooling (wear reduction per shared passenger).
 * Each additional passenger reduces incremental wear by this fraction.
 */
export const MAINTENANCE_WEAR_REDUCTION_PER_PASSENGER = 0.08;

// ─── Aggregation Thresholds ───────────────────────────────────────────────────
/** Maximum date range (in days) allowed for ESG export reports (3.8). */
export const ESG_EXPORT_MAX_DAYS = 365;
