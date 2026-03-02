/**
 * @fileoverview Carbon Calculation Controller
 * @description Handles HTTP requests for the carbon savings calculation endpoint.
 * @module controllers/carbon.controller
 */

import { calculateCo2Saved } from '../services/carbon.service.js';

/**
 * Calculate CO2 Saved
 *
 * @description Calculates the CO2 savings for a trip given distance and emission factors.
 *
 * @route POST /carbon/calculate
 * @access Public
 *
 * @param {Object} req.body - Request body (CarbonCalculationRequest)
 * @param {number} req.body.distanceKm                   - Trip distance in km (> 0)
 * @param {number} req.body.conventionalEmissionFactor   - Baseline kg CO2/km (>= 0)
 * @param {number} req.body.sustainableEmissionFactor    - Sustainable mode kg CO2/km
 *                                                         (>= 0, < conventionalEmissionFactor)
 *
 * @returns {Object} 200 - { success: true, data: CarbonCalculationResponse }
 * @returns {Object} 400 - { success: false, message: string } on validation failure
 * @returns {Object} 500 - { success: false, message: string } on unexpected error
 *
 * @example
 * // Request
 * POST /carbon/calculate
 * {
 *   "distanceKm": 12.5,
 *   "conventionalEmissionFactor": 0.21,
 *   "sustainableEmissionFactor": 0.05
 * }
 *
 * // Response 200
 * {
 *   "success": true,
 *   "data": {
 *     "co2SavedKg": 2.0,
 *     "distanceKm": 12.5,
 *     "conventionalEmissionFactor": 0.21,
 *     "sustainableEmissionFactor": 0.05
 *   }
 * }
 */
export const calculateCarbonSavings = async (req, res) => {
  try {
    const { distanceKm, conventionalEmissionFactor, sustainableEmissionFactor } = req.body;

    console.log('[carbon.controller] calculateCarbonSavings request:', {
      distanceKm,
      conventionalEmissionFactor,
      sustainableEmissionFactor
    });

    const result = calculateCo2Saved({
      distanceKm,
      conventionalEmissionFactor,
      sustainableEmissionFactor
    });

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[carbon.controller] calculateCarbonSavings error:', error.message);

    // Validation errors from the service are user-facing (400)
    const validationPhrases = [
      'is required',
      'must be',
      'must be numbers'
    ];
    const isValidationError = validationPhrases.some(phrase => error.message.includes(phrase));

    if (isValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while calculating CO2 savings'
    });
  }
};
