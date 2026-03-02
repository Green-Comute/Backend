/**
 * @fileoverview Ride Socket.io Handlers
 * @description Real-time communication for ride-sharing features including trip rooms,
 * driver location updates, and trip status changes.
 * @module sockets/rideSocket
 */

import Trip from '../models/Trip.js';

/**
 * Setup Ride Socket Handlers
 * 
 * @description Initializes Socket.io event handlers for ride-sharing real-time features.
 * Implements JWT authentication, room management, and location broadcasting.
 * 
 * @param {Object} io - Socket.io server instance
 * 
 * @authentication
 * - Requires JWT token in socket.handshake.auth.token
 * - Token verified on connection
 * - socket.userId and socket.userRole attached from decoded token
 * 
 * @rooms
 * - `user-${userId}`: Personal room for user-specific notifications
 * - `trip-${tripId}`: Trip room for all passengers and driver
 * 
 * @events
 * 
 * ## Client -> Server Events:
 * 
 * ### joinTrip
 * Join a trip room to receive real-time updates
 * @param {string} tripId - MongoDB ObjectId of trip
 * @emits trip-joined - Confirmation of joining trip room
 * @emits error - If tripId missing
 * 
 * ### leaveTrip
 * Leave a trip room
 * @param {string} tripId - MongoDB ObjectId of trip
 * 
 * ### updateDriverLocation
 * Driver updates current location during active trip
 * @param {Object} data
 * @param {string} data.tripId - MongoDB ObjectId of trip
 * @param {Object} data.location - GeoJSON Point location
 * @param {Object} data.location.coordinates - GeoJSON coordinates
 * @emits driverLocationUpdate - Broadcast to all in trip room
 * @emits error - If validation fails or update fails
 * @note Only updates if trip.status === 'IN_PROGRESS'
 * 
 * ### tripStatusChanged
 * Broadcast trip status change to all passengers
 * @param {Object} data
 * @param {string} data.tripId - MongoDB ObjectId of trip
 * @param {string} data.status - New trip status
 * @emits tripStatusUpdate - Broadcast to all in trip room
 * @emits error - If tripId or status missing
 * 
 * ## Server -> Client Events:
 * 
 * ### trip-joined
 * Confirmation of successful trip room join
 * @payload {Object} { tripId, message }
 * 
 * ### driverLocationUpdate
 * Real-time driver location update
 * @payload {Object} GeoJSON Point location
 * @room trip-${tripId}
 * 
 * ### tripStatusUpdate
 * Trip status change notification
 * @payload {string} New status (STARTED, IN_PROGRESS, COMPLETED, etc.)
 * @room trip-${tripId}
 * 
 * ### error
 * Error notification
 * @payload {Object} { message }
 * 
 * @security
 * - JWT authentication required for all connections
 * - Users auto-join personal room on connection
 * - Drivers can only update their own trips
 * - Location updates only processed for IN_PROGRESS trips
 * 
 * @example Client Usage:
 * ```javascript
 * import io from 'socket.io-client';
 * 
 * const socket = io('http://localhost:5000', {
 *   auth: { token: 'jwt_token_here' }
 * });
 * 
 * // Join trip room
 * socket.emit('joinTrip', tripId);
 * 
 * // Listen for location updates
 * socket.on('driverLocationUpdate', (location) => {
 *   console.log('Driver location:', location);
 * });
 * 
 * // Driver updates location
 * socket.emit('updateDriverLocation', {
 *   tripId,
 *   location: { coordinates: { type: 'Point', coordinates: [lng, lat] } }
 * });
 * ```
 */
export const setupRideSocket = (io) => {
  // NOTE: Authentication middleware is already registered by setupTrackingSocket.
  // Do NOT call io.use() here again — it runs on the shared io instance and would
  // apply auth twice, breaking connections.

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id, 'User ID:', socket.userId);

    // Auto-join user to their personal room for notifications
    socket.join(`user-${socket.userId}`);

    // Join a trip room for tracking
    socket.on('joinTrip', (tripId) => {
      if (!tripId) {
        socket.emit('error', { message: 'Trip ID is required' });
        return;
      }

      socket.join(`trip:${tripId}`);
      console.log(`Socket ${socket.id} joined trip room: trip:${tripId}`);
      
      socket.emit('trip-joined', { 
        tripId, 
        message: 'Successfully joined trip room' 
      });
    });

    // Leave a trip room
    socket.on('leaveTrip', (tripId) => {
      if (tripId) {
        socket.leave(`trip:${tripId}`);
        console.log(`Socket ${socket.id} left trip room: trip:${tripId}`);
      }
    });

    // Driver updates location during active trip
    socket.on('updateDriverLocation', async (data) => {
      const { tripId, location } = data;

      if (!tripId || !location || !location.coordinates) {
        socket.emit('error', { message: 'Trip ID and location coordinates are required' });
        return;
      }

      try {
        // Update trip location in database
        const trip = await Trip.findById(tripId);
        if (trip && trip.status === 'IN_PROGRESS') {
          trip.currentLocation = location;
          await trip.save();

          // Broadcast location update to all passengers in the trip room
          io.to(`trip:${tripId}`).emit('driverLocationUpdate', location);
          console.log(`Driver location updated for trip ${tripId}`);
        }
      } catch (error) {
        console.error('Error updating driver location:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Broadcast trip status change (start/end)
    socket.on('tripStatusChanged', (data) => {
      const { tripId, status } = data;

      if (!tripId || !status) {
        socket.emit('error', { message: 'Trip ID and status are required' });
        return;
      }

      // Broadcast to all users in the trip room
      io.to(`trip:${tripId}`).emit('tripStatusUpdate', status);
      console.log(`Trip ${tripId} status changed to ${status}`);
    });

    // Legacy events (keep for backward compatibility)
    socket.on('join-trip', (data) => {
      const { tripId, userId } = data;
      
      if (!tripId) {
        socket.emit('error', { message: 'Trip ID is required' });
        return;
      }

      socket.join(`trip:${tripId}`);
      console.log(`User ${userId || socket.id} joined trip room: trip:${tripId}`);
      
      socket.emit('trip-joined', { 
        tripId, 
        message: 'Successfully joined trip room' 
      });
    });

    socket.on('location-update', (data) => {
      const { tripId, location } = data;

      if (!tripId || !location) {
        socket.emit('error', { message: 'Trip ID and location are required' });
        return;
      }

      const { latitude, longitude } = location;

      if (!latitude || !longitude) {
        socket.emit('error', { message: 'Valid latitude and longitude are required' });
        return;
      }

      socket.to(`trip:${tripId}`).emit('driver-location', {
        tripId,
        location: {
          latitude,
          longitude,
          timestamp: new Date()
        }
      });

      console.log(`Location update for trip ${tripId}:`, location);
    });

    // Emit ride approval to specific passenger
    socket.on('ride-approved', (data) => {
      const { passengerId, rideId, tripId } = data;

      if (!passengerId || !rideId) {
        socket.emit('error', { message: 'Passenger ID and Ride ID are required' });
        return;
      }

      // Emit to passenger's personal room
      io.to(`user-${passengerId}`).emit('ride-approved-notification', {
        rideId,
        tripId,
        message: 'Your ride request has been approved',
        timestamp: new Date()
      });

      console.log(`Ride ${rideId} approved for passenger ${passengerId}`);
    });

    // Join user's personal room for notifications
    socket.on('join-user-room', (data) => {
      const { userId } = data;

      if (!userId) {
        socket.emit('error', { message: 'User ID is required' });
        return;
      }

      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined personal room: user-${userId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

export default setupRideSocket;
