import express from 'express';
import {
  requestRide,
  approveRide,
  rejectRide,
  getRideRequestsForTrip,
  getPassengerRides,
  markAsPickedUp,
  markAsDroppedOff,
  cancelRide
} from '../controllers/rideController.js';
import protect from '../middlewares/authMiddleware.js';
import requireDriver from '../middlewares/driverMiddleware.js';

/**
 * @fileoverview Ride Request Routes
 * @description Defines endpoints for ride request management including requesting rides,
 * driver approval/rejection, pickup/dropoff tracking.
 * @module routes/rideRoutes
 */

const router = express.Router();

/**
 * @api {post} /api/rides/request Request a Ride
 * @apiDescription Passenger requests to join a trip
 * @apiPermission authenticated
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiBody {String} tripId MongoDB ObjectId of trip to join
 */
router.post('/rides/request', protect, requestRide);

/**
 * @api {get} /api/rides/trip/:tripId Get Ride Requests for Trip
 * @apiDescription Get all ride requests for a specific trip
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} tripId MongoDB ObjectId of the trip
 */
router.get('/rides/trip/:tripId', protect, requireDriver, getRideRequestsForTrip);

/**
 * @api {get} /api/rides/passenger/rides Get Passenger's Rides
 * @apiDescription Get all ride requests made by authenticated passenger
 * @apiPermission authenticated
 * @apiHeader {String} Authorization Bearer JWT token
 */
router.get('/rides/passenger/rides', protect, getPassengerRides);

/**
 * @api {post} /api/rides/:id/approve Approve Ride Request
 * @apiDescription Driver approves passenger's ride request
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of ride request
 */
router.post('/rides/:id/approve', protect, requireDriver, approveRide);

/**
 * @api {post} /api/rides/:id/reject Reject Ride Request
 * @apiDescription Driver rejects passenger's ride request
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of ride request
 */
router.post('/rides/:id/reject', protect, requireDriver, rejectRide);

/**
 * @api {post} /api/rides/:id/pickup Mark as Picked Up
 * @apiDescription Driver marks approved passenger as picked up
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of ride request
 */
router.post('/rides/:id/pickup', protect, requireDriver, markAsPickedUp);

/**
 * @api {post} /api/rides/:id/dropoff Mark as Dropped Off
 * @apiDescription Driver marks picked-up passenger as dropped off
 * @apiPermission driver (trip owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of ride request
 */
router.post('/rides/:id/dropoff', protect, requireDriver, markAsDroppedOff);

/**
 * @api {post} /api/rides/:id/cancel Cancel Ride Request (Passenger)
 * @apiDescription Passenger cancels their own PENDING or APPROVED ride request before trip starts
 * @apiPermission authenticated (ride owner only)
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of ride request
 */
router.post('/rides/:id/cancel', protect, cancelRide);

export default router;
