/**
 * @fileoverview Carbon Calculation Routes
 * @description Defines the endpoint for CO2 savings calculation.
 * @module routes/carbon.routes
 */

import express from 'express';
import { calculateCarbonSavings } from '../controllers/carbon.controller.js';

const router = express.Router();

/**
 * @api {post} /carbon/calculate  Calculate CO2 Saved
 * @apiDescription Returns CO2 savings (kg) given distance and emission factors.
 * @apiAccess Public
 *
 * @apiBody {Number} distanceKm                  Trip distance in km (> 0)
 * @apiBody {Number} conventionalEmissionFactor  Baseline kg CO2/km (>= 0)
 * @apiBody {Number} sustainableEmissionFactor   Sustainable mode kg CO2/km (>= 0, < conventional)
 *
 * @apiSuccess {Boolean} success  true
 * @apiSuccess {Object}  data     CarbonCalculationResponse
 *
 * @apiError (400) {Boolean} success  false
 * @apiError (400) {String}  message  Validation error description
 */
router.post('/calculate', calculateCarbonSavings);

export default router;
