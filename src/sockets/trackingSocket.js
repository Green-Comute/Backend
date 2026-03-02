/**
 * @fileoverview Tracking Socket.io Handlers
 * @description Real-time trip tracking with live location updates and trip lifecycle events.
 * Provides passenger-side tracking interface for monitoring active trips.
 * @module sockets/trackingSocket
 */

import Trip from '../models/Trip.js';
import jwt from 'jsonwebtoken';
import { calculateETA } from '../services/etaService.js';

/**
 * Setup Tracking Socket Handlers
 * 
 * @description Initializes Socket.io event handlers for real-time trip tracking.
 * Implements JWT authentication, trip monitoring, and location broadcasting.
 * 
 * @param {Object} io - Socket.io server instance
 * 
 * @authentication
 * - Requires JWT token in socket.handshake.auth.token
 * - Token verified using JWT_SECRET from environment
 * - socket.userId and socket.userRole attached from decoded token
 * 
 * @rooms
 * - `trip:${tripId}`: Trip tracking room for passengers and driver
 * 
 * @events
 * 
 * ## Client -> Server Events:
 * 
 * ### joinTrip
 * Join a trip tracking room and receive current trip status
 * @param {string} tripId - MongoDB ObjectId of trip
 * @emits tripStatus - Current trip status and location
 * @emits error - If trip not found
 * @async Fetches trip from database
 * 
 * ### leaveTrip
 * Leave a trip tracking room
 * @param {string} tripId - MongoDB ObjectId of trip
 * 
 * ### updateLocation
 * Driver updates current GPS location
 * @param {Object} data
 * @param {string} data.tripId - MongoDB ObjectId of trip
 * @param {Object} data.location - Location coordinates
 * @param {number} data.location.lat - Latitude
 * @param {number} data.location.lng - Longitude
 * @emits locationUpdate - Broadcast to all in trip room
 * @emits error - If validation fails or unauthorized
 * @security Only trip driver can update location
 * @async Updates trip.currentLocation in database
 * 
 * ### startTrip
 * Driver starts the trip
 * @param {string} tripId - MongoDB ObjectId of trip
 * @emits tripStarted - Broadcast to all in trip room
 * @emits error - If trip not found or unauthorized
 * @security Only trip driver can start trip
 * @async Updates trip.status to 'STARTED'
 * 
 * ## Server -> Client Events:
 * 
 * ### tripStatus
 * Current trip status sent on room join
 * @payload {Object}
 * @payload.tripId - MongoDB ObjectId
 * @payload.status - Trip status (SCHEDULED, STARTED, etc.)
 * @payload.currentLocation - GeoJSON Point or null
 * 
 * ### locationUpdate
 * Real-time driver location update
 * @payload {Object}
 * @payload.tripId - MongoDB ObjectId
 * @payload.location - { lat, lng } coordinates
 * @payload.timestamp - Update timestamp
 * @room trip:${tripId}
 * 
 * ### tripStarted
 * Trip start notification
 * @payload {Object}
 * @payload.tripId - MongoDB ObjectId
 * @payload.status - 'STARTED'
 * @payload.actualStartTime - Start timestamp
 * @room trip:${tripId}
 * 
 * ### error
 * Error notification
 * @payload {Object} { message }
 * 
 * @businessLogic
 * - Passengers join trip room to track driver location
 * - Driver broadcasts location periodically during trip
 * - All users in room receive real-time updates
 * - Trip status changes broadcast to all participants
 * - Only driver can update location and trip status
 * 
 * @security
 * - JWT authentication required
 * - Driver authorization verified for location updates
 * - Driver authorization verified for trip control events
 * - Trip existence validated before operations
 * 
 * @example Client Usage (Passenger):
 * ```javascript
 * const socket = io('http://localhost:5000', {
 *   auth: { token: jwtToken }
 * });
 * 
 * // Join trip to track driver
 * socket.emit('joinTrip', tripId);
 * 
 * // Receive current status
 * socket.on('tripStatus', (data) => {
 *   console.log('Trip status:', data.status);
 *   console.log('Driver location:', data.currentLocation);
 * });
 * 
 * // Receive live location updates
 * socket.on('locationUpdate', ({ location, timestamp }) => {
 *   updateMapMarker(location.lat, location.lng);
 * });
 * 
 * // Trip started notification
 * socket.on('tripStarted', (data) => {
 *   console.log('Trip started at:', data.actualStartTime);
 * });
 * ```
 * 
 * @example Client Usage (Driver):
 * ```javascript
 * const socket = io('http://localhost:5000', {
 *   auth: { token: jwtToken }
 * });
 * 
 * // Start trip
 * socket.emit('startTrip', tripId);
 * 
 * // Update location periodically
 * setInterval(() => {
 *   navigator.geolocation.getCurrentPosition((position) => {
 *     socket.emit('updateLocation', {
 *       tripId,
 *       location: {
 *         lat: position.coords.latitude,
 *         lng: position.coords.longitude
 *       }
 *     });
 *   });
 * }, 5000); // Every 5 seconds
 * ```
 */
export const setupTrackingSocket = (io) => {
  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected to tracking`);

    // Join a specific trip room
    socket.on('joinTrip', async (tripId) => {
      try {
        const trip = await Trip.findById(tripId);
        
        if (!trip) {
          socket.emit('error', { message: 'Trip not found' });
          return;
        }

        socket.join(`trip:${tripId}`);
        console.log(`User ${socket.userId} joined trip ${tripId}`);

        // Send current trip status
        socket.emit('tripStatus', {
          tripId: trip._id,
          status: trip.status,
          currentLocation: trip.currentLocation
        });
      } catch {
        socket.emit('error', { message: 'Failed to join trip' });
      }
    });

    // Leave a trip room
    socket.on('leaveTrip', (tripId) => {
      socket.leave(`trip:${tripId}`);
      console.log(`User ${socket.userId} left trip ${tripId}`);
    });

    // Update driver location
    socket.on('updateLocation', async ({ tripId, location }) => {
      try {
        // Verify the user is the driver of this trip
        const trip = await Trip.findById(tripId);
        
        if (!trip) {
          socket.emit('error', { message: 'Trip not found' });
          return;
        }

        if (trip.driverId.toString() !== socket.userId) {
          socket.emit('error', { message: 'Only the driver can update location' });
          return;
        }

        // Update trip's current location
        trip.currentLocation = {
          type: 'Point',
          coordinates: [location.lng, location.lat] // MongoDB uses [lng, lat]
        };
        
        await trip.save();

        // ── ETA Calculation ──────────────────────────────────────────────────
        // Attempt to get accurate ETA from driver's current position to destination
        let eta = null;
        try {
          const destCoords = trip.destinationLocation?.coordinates?.coordinates;
          if (destCoords && destCoords.length === 2) {
            // MongoDB stores [lng, lat]; OSRM needs {lat, lng}
            const destination = { lat: destCoords[1], lng: destCoords[0] };
            eta = await calculateETA(location, destination);
          }
        } catch (etaErr) {
          console.warn('[ETA] Failed to compute ETA for trip', tripId, etaErr.message);
        }
        // ─────────────────────────────────────────────────────────────────────

        // Broadcast location (+ ETA) to all users in the trip room
        io.to(`trip:${tripId}`).emit('locationUpdate', {
          tripId,
          location: {
            lat: location.lat,
            lng: location.lng
          },
          eta,          // null when calculation not possible
          timestamp: new Date()
        });

        console.log(`Location updated for trip ${tripId}`);
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Start trip
    socket.on('startTrip', async (tripId) => {
      try {
        const trip = await Trip.findById(tripId);
        
        if (!trip) {
          socket.emit('error', { message: 'Trip not found' });
          return;
        }

        if (trip.driverId.toString() !== socket.userId) {
          socket.emit('error', { message: 'Only the driver can start the trip' });
          return;
        }

        if (trip.status !== 'SCHEDULED') {
          socket.emit('error', { message: 'Trip already started or completed' });
          return;
        }

        trip.status = 'STARTED';
        trip.actualStartTime = new Date();
        await trip.save();

        // Notify all passengers
        io.to(`trip:${tripId}`).emit('tripStatusUpdate', {
          tripId,
          status: 'STARTED',
          message: 'Trip has started!'
        });

        console.log(`Trip ${tripId} started`);
      } catch (error) {
        console.error('Start trip error:', error);
        socket.emit('error', { message: 'Failed to start trip' });
      }
    });

    // Complete trip
    socket.on('completeTrip', async (tripId) => {
      try {
        const trip = await Trip.findById(tripId);
        
        if (!trip) {
          socket.emit('error', { message: 'Trip not found' });
          return;
        }

        if (trip.driverId.toString() !== socket.userId) {
          socket.emit('error', { message: 'Only the driver can complete the trip' });
          return;
        }

        if (trip.status === 'COMPLETED') {
          socket.emit('error', { message: 'Trip already completed' });
          return;
        }

        trip.status = 'COMPLETED';
        trip.actualEndTime = new Date();
        await trip.save();

        // Notify all passengers
        io.to(`trip:${tripId}`).emit('tripStatusUpdate', {
          tripId,
          status: 'COMPLETED',
          message: 'Trip has been completed!'
        });

        console.log(`Trip ${tripId} completed`);
      } catch (error) {
        console.error('Complete trip error:', error);
        socket.emit('error', { message: 'Failed to complete trip' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from tracking`);
    });
  });
};

export default setupTrackingSocket;
