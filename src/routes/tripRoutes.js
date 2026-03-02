import express from 'express';
import {
  createTrip,
  searchTrips,
  startTrip,
  completeTrip,
  cancelTrip,
  endTrip,
  getDriverTrips,
  updateDriverLocation,
  getTripById
} from '../controllers/tripController.js';
import protect from '../middlewares/authMiddleware.js';
import requireDriver from '../middlewares/driverMiddleware.js';

/**
 * @fileoverview Trip Management Routes
 * @description Defines endpoints for complete trip lifecycle management including creation,
 * search, status updates, and location tracking.
 * @module routes/tripRoutes
 */

const router = express.Router();

/**
 * @api {post} /api/trips Create Trip
 * @apiDescription Driver creates a new scheduled trip
 * @apiPermission driver
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiBody {String} vehicleType CAR or BIKE
 * @apiBody {Number} totalSeats Number of seats (CAR: 1-7, BIKE: 1)
 * @apiBody {String} scheduledTime ISO timestamp (within 7 days)
 * @apiBody {String} source Source location text
 * @apiBody {String} destination Destination location text
 * @apiBody {Object} [sourceLocation] Source coordinates (optional)
 * @apiBody {Object} [destinationLocation] Destination coordinates (optional)
 */
router.post('/trips', protect, requireDriver, createTrip);

/**
 * @api {get} /api/trips/search Search Trips
 * @apiDescription Search for available trips by source and destination
 * @apiPermission authenticated
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiQuery {String} source Source location
 * @apiQuery {String} destination Destination location
 * @apiQuery {String} [vehicleType] Filter by vehicle type
 * @apiQuery {Number} [sourceLat] Source latitude for geospatial search
 * @apiQuery {Number} [sourceLng] Source longitude for geospatial search
 * @apiQuery {Number} [destLat] Destination latitude
 * @apiQuery {Number} [destLng] Destination longitude
 * @apiQuery {Number} [maxDistance=5000] Max distance in meters
 */
router.get('/trips/search', protect, searchTrips);

/**
 * @api {get} /api/trips/:id Get Trip Details
 * @apiDescription Get complete trip information including driver and passengers
 * @apiPermission authenticated
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of trip
 */
router.get('/trips/:id', protect, getTripById);

/**
 * @api {get} /api/trips/driver/trips Get Driver's Trips
 * @apiDescription Get all trips created by authenticated driver
 * @apiPermission driver
 * @apiHeader {String} Authorization Bearer JWT token
 */
router.get('/trips/driver/trips', protect, requireDriver, getDriverTrips);

/**
 * @api {post} /api/trips/:id/start Start Trip
 * @apiDescription Driver starts the trip (SCHEDULED -> STARTED)
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of trip
 */
router.post('/trips/:id/start', protect, requireDriver, startTrip);

/**
 * @api {post} /api/trips/:id/complete Complete Trip
 * @apiDescription Driver marks trip as completed
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of trip
 */
router.post('/trips/:id/complete', protect, requireDriver, completeTrip);

/**
 * @api {post} /api/trips/:id/cancel Cancel Trip
 * @apiDescription Driver cancels the trip
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of trip
 */
router.post('/trips/:id/cancel', protect, requireDriver, cancelTrip);

/**
 * @api {post} /api/trips/:id/end End Trip
 * @apiDescription Driver ends in-progress trip (IN_PROGRESS -> COMPLETED)
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of trip
 */
router.post('/trips/:id/end', protect, requireDriver, endTrip);

/**
 * @api {post} /api/trips/:id/location Update Driver Location
 * @apiDescription Driver updates current GPS location during trip
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of trip
 * @apiBody {Number} lat Current latitude
 * @apiBody {Number} lng Current longitude
 */
router.post('/trips/:id/location', protect, requireDriver, updateDriverLocation);

export default router;
