/**
 * @fileoverview Carbon Calculation Service
 * @description Provides CO2 savings calculation based on verified carbon engine math.
 *
 * Carbon Math:
 *   CO2 Saved (kg) = (conventionalFactor - sustainableFactor) × distanceKm
 *
 * @module services/carbon.service
 */

/**
 * @typedef {Object} CarbonCalculationRequest
 * @property {number} distanceKm              - Trip distance in kilometres (must be > 0)
 * @property {number} conventionalEmissionFactor - kg CO2/km for the baseline vehicle (>= 0)
 * @property {number} sustainableEmissionFactor  - kg CO2/km for the sustainable mode (>= 0,
 *                                                 must be < conventionalEmissionFactor)
 */

/**
 * @typedef {Object} CarbonCalculationResponse
 * @property {number} co2SavedKg   - CO2 saved in kilograms (rounded to 4 decimal places)
 * @property {number} distanceKm   - Echo of the input distance
 * @property {number} conventionalEmissionFactor - Echo of the conventional factor
 * @property {number} sustainableEmissionFactor  - Echo of the sustainable factor
 */

/**
 * Validate CarbonCalculationRequest inputs and throw with a descriptive message on failure.
 *
 * @param {CarbonCalculationRequest} params
 * @throws {Error} Validation error with a human-readable message
 */
const validateCarbonRequest = ({ distanceKm, conventionalEmissionFactor, sustainableEmissionFactor }) => {
  if (distanceKm === undefined || distanceKm === null) {
    throw new Error('distanceKm is required');
  }
  if (conventionalEmissionFactor === undefined || conventionalEmissionFactor === null) {
    throw new Error('conventionalEmissionFactor is required');
  }
  if (sustainableEmissionFactor === undefined || sustainableEmissionFactor === null) {
    throw new Error('sustainableEmissionFactor is required');
  }

  const dist = Number(distanceKm);
  const conv = Number(conventionalEmissionFactor);
  const sust = Number(sustainableEmissionFactor);

  if (isNaN(dist) || isNaN(conv) || isNaN(sust)) {
    throw new Error('distanceKm, conventionalEmissionFactor, and sustainableEmissionFactor must be numbers');
  }
  if (dist <= 0) {
    throw new Error('distanceKm must be greater than 0');
  }
  if (conv < 0) {
    throw new Error('conventionalEmissionFactor must be >= 0');
  }
  if (sust < 0) {
    throw new Error('sustainableEmissionFactor must be >= 0');
  }
  if (sust >= conv) {
    throw new Error('sustainableEmissionFactor must be less than conventionalEmissionFactor');
  }
};

/**
 * Calculate CO2 saved for a trip.
 *
 * @param {CarbonCalculationRequest} params
 * @returns {CarbonCalculationResponse}
 * @throws {Error} When validation fails
 *
 * @example
 * calculateCo2Saved({ distanceKm: 10, conventionalEmissionFactor: 0.21, sustainableEmissionFactor: 0.05 });
 * // => { co2SavedKg: 1.6, distanceKm: 10, conventionalEmissionFactor: 0.21, sustainableEmissionFactor: 0.05 }
 */
export const calculateCo2Saved = ({ distanceKm, conventionalEmissionFactor, sustainableEmissionFactor }) => {
  validateCarbonRequest({ distanceKm, conventionalEmissionFactor, sustainableEmissionFactor });

  const dist = Number(distanceKm);
  const conv = Number(conventionalEmissionFactor);
  const sust = Number(sustainableEmissionFactor);

  const co2SavedKg = parseFloat(((conv - sust) * dist).toFixed(4));

  console.log(
    `[carbon.service] CO2 saved: (${conv} - ${sust}) × ${dist} km = ${co2SavedKg} kg`
  );

  return {
    co2SavedKg,
    distanceKm: dist,
    conventionalEmissionFactor: conv,
    sustainableEmissionFactor: sust
  };
};
