import mongoose from 'mongoose';

/**
 * @fileoverview Ride Request Model
 * @description Defines the RideRequest schema representing a passenger's request to
 * join a driver's trip. Tracks approval status and pickup/dropoff progress.
 * @module models/RideRequest
 */

/**
 * Ride Request Schema
 * 
 * @description Represents a passenger's request to join a scheduled trip.
 * Links passengers to trips and tracks the complete ride lifecycle.
 * 
 * @schema
 * 
 * @property {ObjectId} passengerId - Reference to User (passenger)
 * @property {ObjectId} tripId - Reference to Trip
 * @property {string} status - Request status: PENDING, APPROVED, REJECTED (default: PENDING)
 * @property {string} pickupStatus - Pickup status: WAITING, PICKED_UP, DROPPED_OFF (default: WAITING)
 * @property {Date} [pickedUpAt] - Timestamp when marked as picked up
 * @property {Date} [droppedOffAt] - Timestamp when marked as dropped off
 * @property {Date} createdAt - Request creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * 
 * @lifecycle
 * 1. Passenger requests ride via /api/rides/request
 *    - status = PENDING, pickupStatus = WAITING
 * 2. Driver reviews via /api/rides/trip/:tripId
 * 3. Driver approves via /api/rides/:id/approve
 *    - status = APPROVED, trip.availableSeats decremented
 * 4. Driver marks picked up via /api/rides/:id/pickup
 *    - pickupStatus = PICKED_UP, pickedUpAt = now
 * 5. Driver marks dropped off via /api/rides/:id/dropoff
 *    - pickupStatus = DROPPED_OFF, droppedOffAt = now
 * 
 * @alternatively Driver rejects:
 * 3. Driver rejects via /api/rides/:id/reject
 *    - status = REJECTED, no seat decrement
 * 
 * @realtime
 * - Socket.io events emitted on status changes
 * - Passenger notified of approval/rejection
 * - Passenger notified of pickup/dropoff updates
 * - Trip room notified of passenger status changes
 * 
 * @businessRules
 * - Only one PENDING request per passenger per trip
 * - Only APPROVED passengers can be picked up
 * - Must be PICKED_UP before DROPPED_OFF
 * - Driver cannot request their own trip
 * 
 * @example
 * {
 *   "passengerId": "507f1f77bcf86cd799439011",
 *   "tripId": "507f1f77bcf86cd799439012",
 *   "status": "APPROVED",
 *   "pickupStatus": "PICKED_UP",
 *   "pickedUpAt": "2026-02-13T09:05:00.000Z",
 *   "createdAt": "2026-02-13T08:30:00.000Z"
 * }
 */
const rideRequestSchema = new mongoose.Schema({
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Passenger ID is required']
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: [true, 'Trip ID is required']
  },
  status: {
    type: String,
    enum: {
      values: ['PENDING', 'APPROVED', 'REJECTED'],
      message: '{VALUE} is not a valid status'
    },
    default: 'PENDING'
  },
  pickupStatus: {
    type: String,
    enum: {
      values: ['WAITING', 'PICKED_UP', 'DROPPED_OFF'],
      message: '{VALUE} is not a valid pickup status'
    },
    default: 'WAITING'
  },
  pickedUpAt: {
    type: Date
  },
  droppedOffAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
rideRequestSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Index for querying pending requests by passenger
rideRequestSchema.index({ passengerId: 1, status: 1 });
rideRequestSchema.index({ tripId: 1, status: 1 });

const RideRequest = mongoose.model('RideRequest', rideRequestSchema);

export default RideRequest;
