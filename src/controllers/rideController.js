import RideRequest from '../models/RideRequest.js';
import Trip from '../models/Trip.js';
import { getIO } from '../config/socket.js';

/**
 * @fileoverview Ride Request Management Controller
 * @description Manages the passenger-driver interaction for ride requests including
 * requesting rides, approving/rejecting requests, tracking pickup/dropoff status.
 * Implements real-time Socket.io notifications for all state changes.
 * @module controllers/rideController
 */

/**
 * Request a Ride
 * 
 * @description Creates a new ride request from passenger to join a scheduled trip.
 * Validates trip availability, prevents duplicate requests, and notifies driver via Socket.io.
 * 
 * @route POST /api/rides/request
 * @access Private (Authenticated users - drivers can also be passengers)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated user (passenger)
 * @param {Object} req.body - Request body
 * @param {string} req.body.tripId - MongoDB ObjectId of the trip to request
 * 
 * @returns {Object} 201 - Ride request created successfully
 * @returns {Object} 400 - Invalid request (e.g., requesting own trip, duplicate request)
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * POST /api/rides/request
 * Authorization: Bearer <jwt_token>
 * {
 *   "tripId": "507f1f77bcf86cd799439011"
 * }
 * 
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439012",
 *     "passengerId": { "_id": "...", "name": "John Doe", "email": "..." },
 *     "tripId": { ... trip details ... },
 *     "status": "PENDING",
 *     "createdAt": "2026-02-12T10:30:00.000Z"
 *   }
 * }
 * 
 * @businessLogic
 * - Validates user authentication
 * - Checks trip exists and is SCHEDULED
 * - Prevents drivers from requesting their own trips
 * - Checks for existing PENDING request for same trip
 * - Validates at least 1 seat available
 * - Creates ride request with PENDING status
 * - Emits Socket.io 'new-ride-request' event to driver
 * - Driver receives real-time notification to approve/reject
 * 
 * @realtime Socket.io Events Emitted:
 * - Event: 'new-ride-request'
 * - Room: `user-${driverId}`
 * - Payload: { rideRequest, message, timestamp }
 */
export const requestRide = async (req, res) => {
  try {
    const { tripId } = req.body;
    const passengerId = req.user.userId;

    // Validate user authentication
    if (!passengerId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication error. Please log out and log back in.'
      });
    }

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: 'Trip ID is required'
      });
    }

    // Check if trip exists and has available seats
    const trip = await Trip.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Smart driver check: prevent requesting your own trip
    if (trip.driverId.toString() === passengerId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot request a ride for your own trip'
      });
    }

    // Check if passenger already has a pending request for this trip
    const existingRequest = await RideRequest.findOne({
      passengerId,
      tripId,
      status: 'PENDING'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request for this trip'
      });
    }

    if (trip.status !== 'SCHEDULED') {
      return res.status(400).json({
        success: false,
        message: 'Trip is not available for booking'
      });
    }

    if (trip.availableSeats < 1) {
      return res.status(400).json({
        success: false,
        message: 'No seats available for this trip'
      });
    }

    // Create ride request
    const rideRequest = await RideRequest.create({
      passengerId,
      tripId,
      status: 'PENDING'
    });

    const populatedRequest = await RideRequest.findById(rideRequest._id)
      .populate('passengerId', 'name email')
      .populate('tripId');

    // Emit socket event to driver about new ride request
    try {
      const io = getIO();
      io.to(`user-${trip.driverId}`).emit('new-ride-request', {
        rideRequest: populatedRequest,
        message: 'New ride request received',
        timestamp: new Date()
      });
    } catch (socketError) {
      console.error('Socket.io emit error:', socketError);
    }

    res.status(201).json({
      success: true,
      data: populatedRequest
    });

  } catch (error) {
    console.error('Request ride error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to request ride'
    });
  }
};

/**
 * Approve Ride Request
 * 
 * @description Driver approves a passenger's ride request. Atomically decrements available
 * seats and updates request status. Notifies passenger and all users via Socket.io.
 * 
 * @route POST /api/rides/:id/approve
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of ride request to approve
 * 
 * @returns {Object} 200 - Ride request approved successfully
 * @returns {Object} 400 - Cannot approve (wrong status, no seats available)
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Ride request not found
 * 
 * @example
 * // Request
 * POST /api/rides/507f1f77bcf86cd799439012/approve
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439012",
 *     "status": "APPROVED",
 *     "passengerId": { ... },
 *     "tripId": { ... }
 *   },
 *   "trip": {
 *     "availableSeats": 3
 *   }
 * }
 * 
 * @businessLogic
 * - Validates driver owns the trip
 * - Only PENDING requests can be approved
 * - Atomically decrements trip.availableSeats (prevents race conditions)
 * - Fails if no seats available (atomic operation ensures consistency)
 * - Updates request status to APPROVED
 * - Emits Socket.io events to passenger and all users
 * - Passenger can now be picked up by driver
 * 
 * @atomic This operation uses findOneAndUpdate with $inc for atomic seat decrement
 * 
 * @realtime Socket.io Events Emitted:
 * - Event: 'ride-approved-notification'
 *   - Room: `user-${passengerId}`
 *   - Payload: { rideId, tripId, message, timestamp }
 * - Event: 'trip-seats-updated'
 *   - Room: broadcast to all
 *   - Payload: { tripId, availableSeats, timestamp }
 */
export const approveRide = async (req, res) => {
  try {
    const rideRequestId = req.params.id;

    // Find the ride request
    const rideRequest = await RideRequest.findById(rideRequestId)
      .populate('passengerId', 'name email')
      .populate('tripId');

    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }

    // Check if the user is the driver of this trip
    if (rideRequest.tripId.driverId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip driver can approve this request'
      });
    }

    // Check if request is still pending
    if (rideRequest.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with status ${rideRequest.status}`
      });
    }

    // Atomically decrement seats and approve request
    const trip = await Trip.findOneAndUpdate(
      {
        _id: rideRequest.tripId._id,
        availableSeats: { $gt: 0 }
      },
      {
        $inc: { availableSeats: -1 }
      },
      { new: true }
    );

    if (!trip) {
      return res.status(400).json({
        success: false,
        message: 'No seats available or trip not found'
      });
    }

    // Update ride request status
    rideRequest.status = 'APPROVED';
    await rideRequest.save();

    // Emit Socket.io event to passenger
    try {
      const io = getIO();
      io.to(`user-${rideRequest.passengerId._id}`).emit('ride-approved-notification', {
        rideId: rideRequest._id,
        tripId: rideRequest.tripId._id,
        message: 'Your ride request has been approved',
        timestamp: new Date()
      });
      
      // Emit trip seats update event for all users
      io.emit('trip-seats-updated', {
        tripId: rideRequest.tripId._id,
        availableSeats: trip.availableSeats,
        timestamp: new Date()
      });
    } catch (socketError) {
      console.error('Socket.io emit error:', socketError);
      // Continue even if socket fails
    }

    res.status(200).json({
      success: true,
      data: rideRequest,
      trip: {
        availableSeats: trip.availableSeats
      }
    });

  } catch (error) {
    console.error('Approve ride error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to approve ride'
    });
  }
};

/**
 * Reject Ride Request
 * 
 * @description Driver rejects a passenger's ride request. Does not affect available seats.
 * Notifies passenger via Socket.io.
 * 
 * @route POST /api/rides/:id/reject
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of ride request to reject
 * 
 * @returns {Object} 200 - Ride request rejected successfully
 * @returns {Object} 400 - Cannot reject (wrong status)
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Ride request not found
 * 
 * @example
 * // Request
 * POST /api/rides/507f1f77bcf86cd799439012/reject
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439012",
 *     "status": "REJECTED",
 *     "passengerId": { ... },
 *     "tripId": { ... }
 *   }
 * }
 * 
 * @businessLogic
 * - Validates driver owns the trip
 * - Only PENDING requests can be rejected
 * - Updates request status to REJECTED
 * - Does NOT affect trip.availableSeats (no seat was reserved)
 * - Emits Socket.io event to passenger
 * - Passenger can request other trips
 * 
 * @realtime Socket.io Events Emitted:
 * - Event: 'ride-rejected-notification'
 *   - Room: `user-${passengerId}`
 *   - Payload: { rideId, tripId, message, timestamp }
 */
export const rejectRide = async (req, res) => {
  try {
    const rideRequestId = req.params.id;

    // Find the ride request
    const rideRequest = await RideRequest.findById(rideRequestId)
      .populate('passengerId', 'name email')
      .populate('tripId');

    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }

    // Check if the user is the driver of this trip
    if (rideRequest.tripId.driverId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip driver can reject this request'
      });
    }

    // Check if request is still pending
    if (rideRequest.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status ${rideRequest.status}`
      });
    }

    // Update ride request status
    rideRequest.status = 'REJECTED';
    await rideRequest.save();

    // Emit Socket.io event to passenger
    try {
      const io = getIO();
      io.to(`user-${rideRequest.passengerId._id}`).emit('ride-rejected-notification', {
        rideId: rideRequest._id,
        tripId: rideRequest.tripId._id,
        message: 'Your ride request has been rejected',
        timestamp: new Date()
      });
      
      // Note: No seat update needed for rejection
    } catch (socketError) {
      console.error('Socket.io emit error:', socketError);
      // Continue even if socket fails
    }

    res.status(200).json({
      success: true,
      data: rideRequest
    });

  } catch (error) {
    console.error('Reject ride error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reject ride'
    });
  }
};

/**
 * Get Ride Requests for Trip
 * 
 * @description Retrieves all ride requests (pending, approved, rejected) for a specific trip.
 * Only the trip driver can view requests for their trip.
 * 
 * @route GET /api/rides/trip/:tripId
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.tripId - MongoDB ObjectId of the trip
 * 
 * @returns {Object} 200 - List of ride requests
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * GET /api/rides/trip/507f1f77bcf86cd799439011
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "count": 3,
 *   "rides": [
 *     {
 *       "_id": "...",
 *       "passengerId": { "name": "John Doe", "email": "..." },
 *       "tripId": { "source": "...", "destination": "...", ... },
 *       "status": "PENDING",
 *       "createdAt": "2026-02-12T10:30:00.000Z"
 *     },
 *     ...
 *   ]
 * }
 * 
 * @businessLogic
 * - Validates trip exists
 * - Verifies user is the trip driver
 * - Returns all requests sorted by creation date (newest first)
 * - Populates passenger info (name, email)
 * - Populates trip details (source, destination, time, vehicle)
 * - Driver uses this to manage incoming ride requests
 */
export const getRideRequestsForTrip = async (req, res) => {
  try {
    const { tripId } = req.params;

    // Find the trip
    const trip = await Trip.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Check if user is the driver of this trip
    if (trip.driverId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip driver can view ride requests'
      });
    }

    // Get all ride requests for this trip
    const rideRequests = await RideRequest.find({ tripId })
      .populate('passengerId', 'name email')
      .populate('tripId', 'source destination scheduledTime vehicleType')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: rideRequests.length,
      rides: rideRequests
    });

  } catch (error) {
    console.error('Get ride requests error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get ride requests'
    });
  }
};

/**
 * Get Passenger's Rides
 * 
 * @description Retrieves all ride requests made by the authenticated passenger across
 * all trips, including trip and driver details.
 * 
 * @route GET /api/rides/passenger/rides
 * @access Private (Authenticated users)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated passenger
 * 
 * @returns {Object} 200 - List of passenger's ride requests
 * 
 * @example
 * // Request
 * GET /api/rides/passenger/rides
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "count": 5,
 *   "rides": [
 *     {
 *       "_id": "...",
 *       "passengerId": { "name": "John Doe", "email": "..." },
 *       "tripId": {
 *         "source": "Downtown",
 *         "destination": "Airport",
 *         "scheduledTime": "2026-02-12T15:00:00.000Z",
 *         "driverId": { "name": "Jane Smith", "email": "..." },
 *         ...
 *       },
 *       "status": "APPROVED",
 *       "pickupStatus": "PICKED_UP",
 *       "createdAt": "2026-02-12T10:30:00.000Z"
 *     },
 *     ...
 *   ]
 * }
 * 
 * @businessLogic
 * - Returns all ride requests for authenticated user
 * - Sorted by creation date (newest first)
 * - Populates full trip details including driver info
 * - Shows status (PENDING/APPROVED/REJECTED)
 * - Shows pickup status if applicable (PICKED_UP/DROPPED_OFF)
 * - Used by passenger dashboard to track ride history
 */
export const getPassengerRides = async (req, res) => {
  try {
    const passengerId = req.user.userId;

    // Get all ride requests for this passenger
    const rideRequests = await RideRequest.find({ passengerId })
      .populate('tripId')
      .populate('passengerId', 'name email')
      .sort({ createdAt: -1 });

    // Populate driver information from tripId
    const ridesWithDriver = await Promise.all(
      rideRequests.map(async (ride) => {
        if (ride.tripId) {
          await ride.tripId.populate('driverId', 'name email');
        }
        return ride;
      })
    );

    res.status(200).json({
      success: true,
      count: ridesWithDriver.length,
      rides: ridesWithDriver
    });

  } catch (error) {
    console.error('Get passenger rides error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get passenger rides'
    });
  }
};

/**
 * Mark Passenger as Picked Up
 * 
 * @description Driver marks an approved passenger as picked up. Records timestamp and
 * updates pickup status. Notifies passenger and trip room via Socket.io.
 * 
 * @route POST /api/rides/:id/pickup
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of ride request
 * 
 * @returns {Object} 200 - Passenger marked as picked up
 * @returns {Object} 400 - Invalid operation (not approved, already picked up)
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Ride request not found
 * 
 * @example
 * // Request
 * POST /api/rides/507f1f77bcf86cd799439012/pickup
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Passenger marked as picked up",
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439012",
 *     "status": "APPROVED",
 *     "pickupStatus": "PICKED_UP",
 *     "pickedUpAt": "2026-02-12T15:05:00.000Z",
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Validates driver owns the trip
 * - Only APPROVED passengers can be picked up
 * - Prevents duplicate pickup (already PICKED_UP)
 * - Sets pickupStatus to PICKED_UP
 * - Records pickedUpAt timestamp
 * - Emits Socket.io events to passenger and trip room
 * - Enables tracking of passenger journey
 * - Required before marking as dropped off
 * 
 * @realtime Socket.io Events Emitted:
 * - Event: 'pickup-status-update'
 *   - Room: `user-${passengerId}`
 *   - Payload: { rideId, pickupStatus, message, timestamp }
 * - Event: 'passengerPickup'
 *   - Room: `trip:${tripId}`
 *   - Payload: { rideId, passengerId, passengerName, pickupStatus }
 */
export const markAsPickedUp = async (req, res) => {
  try {
    const rideRequestId = req.params.id;

    // Find the ride request
    const rideRequest = await RideRequest.findById(rideRequestId)
      .populate('passengerId', 'name email')
      .populate('tripId');

    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }

    // Check if the user is the driver of this trip
    if (rideRequest.tripId.driverId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip driver can mark passengers as picked up'
      });
    }

    // Check if request is approved
    if (rideRequest.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only approved passengers can be picked up'
      });
    }

    // Check if already picked up
    if (rideRequest.pickupStatus === 'PICKED_UP') {
      return res.status(400).json({
        success: false,
        message: 'Passenger already marked as picked up'
      });
    }

    // Update pickup status
    rideRequest.pickupStatus = 'PICKED_UP';
    rideRequest.pickedUpAt = new Date();
    await rideRequest.save();

    // Emit Socket.io event to passenger
    try {
      const io = getIO();
      io.to(`user-${rideRequest.passengerId._id}`).emit('pickup-status-update', {
        rideId: rideRequest._id,
        pickupStatus: 'PICKED_UP',
        message: 'You have been picked up',
        timestamp: new Date()
      });
      
      // Also emit to trip room
      io.to(`trip:${rideRequest.tripId._id}`).emit('passengerPickup', {
        rideId: rideRequest._id,
        passengerId: rideRequest.passengerId._id,
        passengerName: rideRequest.passengerId.name,
        pickupStatus: 'PICKED_UP'
      });
    } catch (socketError) {
      console.error('Socket.io emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      data: rideRequest,
      message: 'Passenger marked as picked up'
    });

  } catch (error) {
    console.error('Mark as picked up error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark passenger as picked up'
    });
  }
};

/**
 * Mark Passenger as Dropped Off
 * 
 * @description Driver marks a picked-up passenger as dropped off at destination.
 * Records timestamp and completes pickup journey. Notifies passenger and trip room.
 * 
 * @route POST /api/rides/:id/dropoff
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of ride request
 * 
 * @returns {Object} 200 - Passenger marked as dropped off
 * @returns {Object} 400 - Invalid operation (not approved, not picked up yet)
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Ride request not found
 * 
 * @example
 * // Request
 * POST /api/rides/507f1f77bcf86cd799439012/dropoff
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Passenger marked as dropped off",
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439012",
 *     "status": "APPROVED",
 *     "pickupStatus": "DROPPED_OFF",
 *     "pickedUpAt": "2026-02-12T15:05:00.000Z",
 *     "droppedOffAt": "2026-02-12T15:45:00.000Z",
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Validates driver owns the trip
 * - Only APPROVED passengers can be dropped off
 * - Requires passenger to be PICKED_UP first (enforces journey flow)
 * - Sets pickupStatus to DROPPED_OFF
 * - Records droppedOffAt timestamp
 * - Emits Socket.io events to passenger and trip room
 * - Completes the passenger journey for this ride
 * - Used for trip history and analytics
 * 
 * @realtime Socket.io Events Emitted:
 * - Event: 'pickup-status-update'
 *   - Room: `user-${passengerId}`
 *   - Payload: { rideId, pickupStatus, message, timestamp }
 * - Event: 'passengerDropoff'
 *   - Room: `trip:${tripId}`
 *   - Payload: { rideId, passengerId, passengerName, pickupStatus }
 */
export const markAsDroppedOff = async (req, res) => {
  try {
    const rideRequestId = req.params.id;

    // Find the ride request
    const rideRequest = await RideRequest.findById(rideRequestId)
      .populate('passengerId', 'name email')
      .populate('tripId');

    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }

    // Check if the user is the driver of this trip
    if (rideRequest.tripId.driverId.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip driver can mark passengers as dropped off'
      });
    }

    // Check if request is approved
    if (rideRequest.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Only approved passengers can be dropped off'
      });
    }

    // Check if picked up
    if (rideRequest.pickupStatus !== 'PICKED_UP') {
      return res.status(400).json({
        success: false,
        message: 'Passenger must be picked up before being dropped off'
      });
    }

    // Update pickup status
    rideRequest.pickupStatus = 'DROPPED_OFF';
    rideRequest.droppedOffAt = new Date();
    await rideRequest.save();

    // Emit Socket.io event to passenger
    try {
      const io = getIO();
      io.to(`user-${rideRequest.passengerId._id}`).emit('pickup-status-update', {
        rideId: rideRequest._id,
        pickupStatus: 'DROPPED_OFF',
        message: 'You have been dropped off',
        timestamp: new Date()
      });
      
      // Also emit to trip room
      io.to(`trip:${rideRequest.tripId._id}`).emit('passengerDropoff', {
        rideId: rideRequest._id,
        passengerId: rideRequest.passengerId._id,
        passengerName: rideRequest.passengerId.name,
        pickupStatus: 'DROPPED_OFF'
      });
    } catch (socketError) {
      console.error('Socket.io emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      data: rideRequest,
      message: 'Passenger marked as dropped off'
    });

  } catch (error) {
    console.error('Mark as dropped off error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to mark passenger as dropped off'
    });
  }
};

/**
 * Cancel Ride Request (Passenger)
 *
 * @description Passenger cancels their own PENDING or APPROVED ride request.
 * - PENDING cancellation: straight status update, no seat change.
 * - APPROVED cancellation: atomically restores 1 seat on the trip, then notifies driver.
 * - Blocked once the trip has STARTED or progressed further.
 *
 * @route POST /api/rides/:id/cancel
 * @access Private (Authenticated users – the requesting passenger only)
 *
 * @param {string} req.params.id - MongoDB ObjectId of the ride request
 *
 * @returns {Object} 200 - Ride cancelled successfully
 * @returns {Object} 400 - Cannot cancel (trip already started / invalid status)
 * @returns {Object} 403 - Not authorised (not the passenger who made the request)
 * @returns {Object} 404 - Ride request not found
 *
 * @realtime Socket.io Events Emitted:
 * - Event: 'ride-cancelled-by-passenger'
 *   - Room: `user-${driverId}`
 *   - Payload: { rideId, tripId, passengerName, message, seatsRestored, timestamp }
 * - Event: 'trip-seats-updated'
 *   - Room: broadcast to all (only when APPROVED ride is cancelled)
 *   - Payload: { tripId, availableSeats, timestamp }
 */
export const cancelRide = async (req, res) => {
  try {
    const rideRequestId = req.params.id;
    const passengerId = req.user.userId;

    // Find the ride request with trip and passenger details
    const rideRequest = await RideRequest.findById(rideRequestId)
      .populate('passengerId', 'name email')
      .populate('tripId');

    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }

    // Only the passenger who made the request can cancel it
    if (rideRequest.passengerId._id.toString() !== passengerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the passenger who made this request can cancel it'
      });
    }

    const trip = rideRequest.tripId;

    // Cannot cancel after trip has started
    if (trip.status === 'STARTED' || trip.status === 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a ride after the trip has started'
      });
    }

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ride for a trip that is ${trip.status.toLowerCase()}`
      });
    }

    // Can only cancel PENDING or APPROVED rides
    if (rideRequest.status !== 'PENDING' && rideRequest.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ride request with status ${rideRequest.status}`
      });
    }

    const wasApproved = rideRequest.status === 'APPROVED';

    // Update ride request to REJECTED (used as "passenger cancelled")
    rideRequest.status = 'REJECTED';
    await rideRequest.save();

    let updatedAvailableSeats = trip.availableSeats;

    // Restore the seat if the request was already approved
    if (wasApproved) {
      const updatedTrip = await Trip.findByIdAndUpdate(
        trip._id,
        { $inc: { availableSeats: 1 } },
        { new: true }
      );
      updatedAvailableSeats = updatedTrip.availableSeats;
    }

    // Notify the driver in real-time
    try {
      const io = getIO();
      // Ensure ObjectId is cast explicitly to string
      const driverStrId = trip.driverId._id ? trip.driverId._id.toString() : trip.driverId.toString();
      
      io.to(`user-${driverStrId}`).emit('ride-cancelled-by-passenger', {
        rideId: rideRequest._id.toString(),
        tripId: trip._id.toString(),
        passengerName: rideRequest.passengerId.name,
        message: `${rideRequest.passengerId.name} has cancelled their ride request`,
        seatsRestored: wasApproved,
        timestamp: new Date()
      });

      // Broadcast seat update to all if a seat was freed
      if (wasApproved) {
        io.emit('trip-seats-updated', {
          tripId: trip._id.toString(),
          availableSeats: updatedAvailableSeats,
          timestamp: new Date()
        });
      }
    } catch (socketError) {
      console.error('Socket.io emit error in cancelRide:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
      data: rideRequest,
      seatRestored: wasApproved
    });

  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel ride'
    });
  }
};
