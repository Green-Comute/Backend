/**
 * @fileoverview Fuel Types Configuration
 * @description Defines the configurable list of supported fuel types.
 *   - Exactly 6 fuel types are permitted.
 *   - A startup validation guard prevents misconfiguration.
 * @module config/fuelTypes
 */

/**
 * Ordered list of supported fuel types.
 * To reconfigure, replace values here — the array MUST stay at exactly 6 entries.
 *
 * @type {string[]}
 */
export const FUEL_TYPES = [
  'PETROL',
  'DIESEL',
  'ELECTRIC',
  'HYBRID',
  'CNG',
  'LPG',
];

/** Maximum number of fuel types permitted. */
export const MAX_FUEL_TYPES = 6;

/**
 * Startup validation guard.
 * Called once on application boot. Throws immediately if the configured list
 * contains anything other than exactly MAX_FUEL_TYPES entries.
 *
 * @throws {Error} When fewer or more than MAX_FUEL_TYPES are configured.
 */
export const validateFuelTypesConfig = () => {
  if (FUEL_TYPES.length !== MAX_FUEL_TYPES) {
    throw new Error(
      `[fuelTypes.config] Configuration error: exactly ${MAX_FUEL_TYPES} fuel types must be defined, ` +
      `but found ${FUEL_TYPES.length}. Update FUEL_TYPES in src/config/fuelTypes.js.`
    );
  }

  const unique = new Set(FUEL_TYPES);
  if (unique.size !== FUEL_TYPES.length) {
    throw new Error(
      '[fuelTypes.config] Configuration error: duplicate fuel type entries detected. All values must be unique.'
    );
  }
};
