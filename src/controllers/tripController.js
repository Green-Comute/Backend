import Trip from '../models/Trip.js';
import RideRequest from '../models/RideRequest.js';
import { getIO } from '../config/socket.js';
import { calculateCo2Saved } from '../services/carbon.service.js';

/**
 * @fileoverview Trip Management Controller
 * @description Handles all trip lifecycle operations including creation, search, status updates,
 * and location tracking. Drivers create and manage trips, passengers search and join them.
 * Implements geospatial queries and real-time Socket.io notifications.
 * @module controllers/tripController
 */

/**
 * Create New Trip
 * 
 * @description Driver creates a new scheduled trip with route and seat availability.
 * Supports geolocation-based route planning. Notifies all users of new trip via Socket.io.
 * 
 * @route POST /api/trips
 * @access Private (Drivers only)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {boolean} req.user.isDriver - Must be true
 * @param {Object} req.body - Request body
 * @param {string} req.body.vehicleType - Type of vehicle (CAR or BIKE)
 * @param {number} req.body.totalSeats - Total seats available (CAR: 1-7, BIKE: 1)
 * @param {string} req.body.scheduledTime - ISO timestamp (must be within next 7 days)
 * @param {string} req.body.source - Source location text
 * @param {string} req.body.destination - Destination location text
 * @param {Object} [req.body.sourceLocation] - Source coordinates (optional)
 * @param {number} req.body.sourceLocation.lat - Source latitude
 * @param {number} req.body.sourceLocation.lng - Source longitude
 * @param {string} [req.body.sourceLocation.address] - Source address
 * @param {Object} [req.body.destinationLocation] - Destination coordinates (optional)
 * @param {number} req.body.destinationLocation.lat - Destination latitude
 * @param {number} req.body.destinationLocation.lng - Destination longitude
 * @param {string} [req.body.destinationLocation.address] - Destination address
 * 
 * @returns {Object} 201 - Trip created successfully
 * @returns {Object} 400 - Validation error (missing fields, invalid seats, invalid time)
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 403 - Not a driver
 * 
 * @example
 * // Request
 * POST /api/trips
 * Authorization: Bearer <jwt_token>
 * {
 *   "vehicleType": "CAR",
 *   "totalSeats": 4,
 *   "scheduledTime": "2026-02-13T09:00:00.000Z",
 *   "source": "Downtown Office",
 *   "destination": "Airport Terminal 2",
 *   "sourceLocation": {
 *     "lat": 40.7128,
 *     "lng": -74.0060,
 *     "address": "123 Main St, New York, NY"
 *   },
 *   "destinationLocation": {
 *     "lat": 40.6413,
 *     "lng": -73.7781,
 *     "address": "JFK Airport, Queens, NY"
 *   }
 * }
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Trip created successfully",
 *   "trip": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "driverId": { "_id": "...", "name": "Jane Smith", "email": "..." },
 *     "vehicleType": "CAR",
 *     "totalSeats": 4,
 *     "availableSeats": 4,
 *     "scheduledTime": "2026-02-13T09:00:00.000Z",
 *     "source": "Downtown Office",
 *     "destination": "Airport Terminal 2",
 *     "estimatedCost": 90,
 *     "status": "SCHEDULED",
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Only users with isDriver=true can create trips
 * - Scheduled time must be within next 7 days
 * - CAR: 1-7 seats, BIKE: exactly 1 seat
 * - availableSeats initialized to totalSeats
 * - estimatedCost calculated: 50 + (totalSeats * 10)
 * - Status set to SCHEDULED
 * - Geolocation stored as GeoJSON Point (lng, lat order)
 * - Route created as LineString if both coordinates provided
 * - Emits Socket.io 'new-trip-created' event to all users
 * 
 * @geospatial
 * - sourceLocation.coordinates: GeoJSON Point format [lng, lat]
 * - destinationLocation.coordinates: GeoJSON Point format [lng, lat]
 * - route: GeoJSON LineString connecting source to destination
 * - Enables proximity-based trip search
 * 
 * @realtime Socket.io Events Emitted:
 * - Event: 'new-trip-created'
 *   - Room: broadcast to all
 *   - Payload: { trip, timestamp }
 */
export const createTrip = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication error. Please log out and log back in.'
      });
    }

    // Check if user is a driver
    if (!req.user.isDriver) {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can create trips'
      });
    }

    const { vehicleType, totalSeats, scheduledTime, source, destination, sourceLocation, destinationLocation, distanceKm, conventionalEmissionFactor, sustainableEmissionFactor } = req.body;

    // Validate required fields
    if (!source || !destination || !scheduledTime || !vehicleType || !totalSeats) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: source, destination, scheduledTime, vehicleType, totalSeats'
      });
    }

    // Validate scheduledTime is within 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const tripScheduledTime = new Date(scheduledTime);

    if (tripScheduledTime < now || tripScheduledTime > sevenDaysFromNow) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled time must be within the next 7 days'
      });
    }

    // Validate seats based on vehicle type
    if (vehicleType === 'CAR' && (totalSeats < 1 || totalSeats > 7)) {
      return res.status(400).json({
        success: false,
        message: 'CAR can have between 1 and 7 seats'
      });
    }

    if (vehicleType === 'BIKE' && totalSeats !== 1) {
      return res.status(400).json({
        success: false,
        message: 'BIKE must have exactly 1 seat'
      });
    }

    // Calculate estimated cost (simple formula: base + per km)
    const estimatedCost = 50 + (totalSeats * 10);

    // Prepare trip data
    const tripData = {
      driverId: req.user.userId,
      vehicleType,
      totalSeats: parseInt(totalSeats),
      availableSeats: parseInt(totalSeats),
      scheduledTime: tripScheduledTime,
      source,
      destination,
      estimatedCost,
      status: 'SCHEDULED'
    };

    // Add geolocation data if provided
    if (sourceLocation && sourceLocation.lat && sourceLocation.lng) {
      tripData.sourceLocation = {
        address: sourceLocation.address || source,
        coordinates: {
          type: 'Point',
          coordinates: [parseFloat(sourceLocation.lng), parseFloat(sourceLocation.lat)]
        }
      };
    }

    if (destinationLocation && destinationLocation.lat && destinationLocation.lng) {
      tripData.destinationLocation = {
        address: destinationLocation.address || destination,
        coordinates: {
          type: 'Point',
          coordinates: [parseFloat(destinationLocation.lng), parseFloat(destinationLocation.lat)]
        }
      };
    }

    // Set route if both source and destination coordinates are available
    if (tripData.sourceLocation && tripData.destinationLocation) {
      const sourceCoords = tripData.sourceLocation.coordinates.coordinates;
      const destCoords = tripData.destinationLocation.coordinates.coordinates;
      
      // Only set route if coordinates are distinct
      if (sourceCoords[0] !== destCoords[0] || sourceCoords[1] !== destCoords[1]) {
        tripData.route = {
          type: 'LineString',
          coordinates: [sourceCoords, destCoords]
        };
      }
    }

    // Calculate CO2 saved if distanceKm and emission factors are provided
    if (distanceKm !== undefined && conventionalEmissionFactor !== undefined && sustainableEmissionFactor !== undefined) {
      try {
        const carbonResult = calculateCo2Saved({
          distanceKm,
          conventionalEmissionFactor,
          sustainableEmissionFactor
        });
        tripData.distanceKm = carbonResult.distanceKm;
        tripData.co2SavedKg = carbonResult.co2SavedKg;
        console.log(`[tripController] CO2 saved for new trip: ${carbonResult.co2SavedKg} kg over ${carbonResult.distanceKm} km`);
      } catch (carbonError) {
        // Non-fatal: log and continue without CO2 data
        console.error('[tripController] CO2 calculation failed, proceeding without it:', carbonError.message);
      }
    } else if (distanceKm !== undefined) {
      // Store distance even if emission factors are absent
      const parsedDist = Number(distanceKm);
      if (!isNaN(parsedDist) && parsedDist > 0) {
        tripData.distanceKm = parsedDist;
      }
    }

    // Create trip
    const trip = await Trip.create(tripData);

    const populatedTrip = await Trip.findById(trip._id).populate('driverId', 'name email');

    // Emit socket event for new trip creation
    try {
      const io = getIO();
      io.emit('new-trip-created', {
        trip: populatedTrip,
        timestamp: new Date()
      });
    } catch (socketError) {
      console.error('Socket.io emit error:', socketError);
    }

    res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      trip: populatedTrip
    });

  } catch (error) {
    console.error('Create trip error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create trip'
    });
  }
};

/**
 * Search Trips
 * 
 * @description Search for available trips by source and destination with optional geospatial
 * proximity matching. Supports text-based and coordinate-based search.
 * 
 * @route GET /api/trips/search
 * @access Private (Authenticated users)
 * 
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.source - Source location text (required)
 * @param {string} req.query.destination - Destination location text (required)
 * @param {string} [req.query.vehicleType] - Filter by vehicle type (CAR or BIKE)
 * @param {number} [req.query.sourceLat] - Source latitude for geospatial search
 * @param {number} [req.query.sourceLng] - Source longitude for geospatial search
 * @param {number} [req.query.destLat] - Destination latitude for geospatial search
 * @param {number} [req.query.destLng] - Destination longitude for geospatial search
 * @param {number} [req.query.maxDistance=5000] - Max distance in meters (default 5km)
 * 
 * @returns {Object} 200 - List of matching trips
 * @returns {Object} 400 - Missing required parameters or search error
 * 
 * @example
 * // Geospatial search
 * GET /api/trips/search?source=Downtown&destination=Airport&sourceLat=40.7128&sourceLng=-74.0060&destLat=40.6413&destLng=-73.7781&maxDistance=3000
 * Authorization: Bearer <jwt_token>
 * 
 * // Text-based search
 * GET /api/trips/search?source=Downtown&destination=Airport&vehicleType=CAR
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "count": 3,
 *   "trips": [
 *     {
 *       "_id": "...",
 *       "driverId": { "name": "Jane Smith", "email": "..." },
 *       "source": "Downtown Office",
 *       "destination": "Airport Terminal 2",
 *       "scheduledTime": "2026-02-13T09:00:00.000Z",
 *       "vehicleType": "CAR",
 *       "availableSeats": 3,
 *       "estimatedCost": 90,
 *       "sourceDistance": 850.5,
 *       ...
 *     },
 *     ...
 *   ]
 * }
 * 
 * @businessLogic
 * - Returns only SCHEDULED trips with availableSeats > 0
 * - Geospatial mode: uses MongoDB $geoNear aggregation
 * - Finds trips with source within maxDistance of search source
 * - Finds trips with destination within maxDistance of search destination
 * - Text mode (fallback): uses regex matching on source and destination
 * - Results sorted by scheduledTime (ascending)
 * - Populates driver info (name, email)
 * - Calculates sourceDistance in meters (geospatial only)
 * 
 * @geospatial Aggregation Pipeline (when coordinates provided):
 * 1. $geoNear: Find trips with source near search source
 * 2. $addFields: Calculate distance to destination
 * 3. $match: Filter by destination proximity
 * 4. $lookup: Join with users collection for driver info
 * 5. $sort: Order by scheduledTime
 */
export const searchTrips = async (req, res) => {
  try {
    const { source, destination, vehicleType, sourceLat, sourceLng, destLat, destLng, maxDistance = 5000 } = req.query;

    // Validate required parameters
    if (!source || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination are required'
      });
    }

    let trips;

    // If geolocation coordinates are provided, use geospatial query
    if (sourceLat && sourceLng && destLat && destLng) {
      const sourceLon = parseFloat(sourceLng);
      const sourceLa = parseFloat(sourceLat);
      const destLon = parseFloat(destLng);
      const destLa = parseFloat(destLat);
      const maxDist = parseInt(maxDistance);

      // Build base query
      const baseQuery = {
        status: 'SCHEDULED',
        availableSeats: { $gt: 0 },
        'sourceLocation.coordinates.coordinates': { $exists: true, $ne: [0, 0] },
        'destinationLocation.coordinates.coordinates': { $exists: true, $ne: [0, 0] }
      };

      // Add vehicle type filter if provided
      if (vehicleType) {
        baseQuery.vehicleType = vehicleType.toUpperCase();
      }

      // Find trips with source and destination within radius
      // Using aggregation pipeline for better geospatial matching
      trips = await Trip.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [sourceLon, sourceLa]
            },
            distanceField: 'sourceDistance',
            maxDistance: maxDist,
            spherical: true,
            key: 'sourceLocation.coordinates',
            query: baseQuery
          }
        },
        {
          $addFields: {
            destDistance: {
              $let: {
                vars: {
                  destCoords: '$destinationLocation.coordinates.coordinates'
                },
                in: {
                  $sqrt: {
                    $add: [
                      {
                        $pow: [
                          { $subtract: [{ $arrayElemAt: ['$$destCoords', 0] }, destLon] },
                          2
                        ]
                      },
                      {
                        $pow: [
                          { $subtract: [{ $arrayElemAt: ['$$destCoords', 1] }, destLa] },
                          2
                        ]
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            destDistance: { $lte: maxDist / 111320 } // Approximate conversion to degrees
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'driverId',
            foreignField: '_id',
            as: 'driverInfo'
          }
        },
        {
          $unwind: '$driverInfo'
        },
        {
          $addFields: {
            driverId: {
              _id: '$driverInfo._id',
              name: '$driverInfo.name',
              email: '$driverInfo.email'
            }
          }
        },
        {
          $project: {
            driverInfo: 0
          }
        },
        {
          $sort: { scheduledTime: 1 }
        }
      ]);

    } else {
      // Fallback to text-based search using regex
      const query = {
        status: 'SCHEDULED',
        availableSeats: { $gt: 0 },
        source: { $regex: source, $options: 'i' },
        destination: { $regex: destination, $options: 'i' }
      };

      // Add vehicle type filter if provided
      if (vehicleType) {
        query.vehicleType = vehicleType.toUpperCase();
      }

      trips = await Trip.find(query)
        .populate('driverId', 'name email')
        .sort({ scheduledTime: 1 });
    }

    res.status(200).json({
      success: true,
      count: trips.length,
      trips: trips
    });

  } catch (error) {
    console.error('Search trips error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to search trips'
    });
  }
};

/**
 * Get Driver's Trips
 * 
 * @description Retrieves all trips created by the authenticated driver, sorted by
 * most recent first.
 * 
 * @route GET /api/trips/driver/trips
 * @access Private (Drivers only)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * 
 * @returns {Object} 200 - List of driver's trips
 * 
 * @example
 * // Request
 * GET /api/trips/driver/trips
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "count": 10,
 *   "trips": [
 *     {
 *       "_id": "...",
 *       "source": "Downtown",
 *       "destination": "Airport",
 *       "scheduledTime": "2026-02-13T09:00:00.000Z",
 *       "status": "COMPLETED",
 *       "vehicleType": "CAR",
 *       "totalSeats": 4,
 *       "availableSeats": 1,
 *       ...
 *     },
 *     ...
 *   ]
 * }
 * 
 * @businessLogic
 * - Returns all trips where driverId matches authenticated user
 * - Includes trips in all statuses (SCHEDULED, STARTED, IN_PROGRESS, COMPLETED, CANCELLED)
 * - Sorted by scheduledTime descending (newest first)
 * - Populates driver details
 * - Used by driver dashboard to manage trips and view history
 */
export const getDriverTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ driverId: req.user.userId })
      .populate('driverId', 'name email')
      .sort({ scheduledTime: -1 });

    res.status(200).json({
      success: true,
      count: trips.length,
      trips: trips
    });

  } catch (error) {
    console.error('Get driver trips error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get driver trips'
    });
  }
};

/**
 * End Trip
 * 
 * @description Driver ends an in-progress trip and marks it as completed. Only for trips
 * in IN_PROGRESS status.
 * 
 * @route POST /api/trips/:id/end
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of trip to end
 * 
 * @returns {Object} 200 - Trip ended successfully
 * @returns {Object} 400 - Cannot end (not in IN_PROGRESS status)
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * POST /api/trips/507f1f77bcf86cd799439011/end
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Trip ended successfully",
 *   "trip": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "status": "COMPLETED",
 *     "actualEndTime": "2026-02-13T10:30:00.000Z",
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Only trip owner (driver) can end their trip
 * - Trip must be in IN_PROGRESS status
 * - Status transitions: IN_PROGRESS -> COMPLETED
 * - Records actualEndTime timestamp
 * - Similar to completeTrip but requires IN_PROGRESS status
 */
export const endTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

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
        message: 'Only the trip driver can end this trip'
      });
    }

    // Check if trip is in IN_PROGRESS status
    if (trip.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: `Cannot end trip with status ${trip.status}. Trip must be in IN_PROGRESS status`
      });
    }

    // Update status to COMPLETED
    trip.status = 'COMPLETED';
    trip.actualEndTime = new Date();
    await trip.save();

    res.status(200).json({
      success: true,
      message: 'Trip ended successfully',
      trip: trip
    });

  } catch (error) {
    console.error('End trip error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to end trip'
    });
  }
};

/**
 * Update Driver Location
 * 
 * @description Driver updates their current GPS location during trip. Enables real-time
 * passenger tracking. Location stored as GeoJSON Point.
 * 
 * @route POST /api/trips/:id/location
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of the trip
 * @param {Object} req.body - Request body
 * @param {number} req.body.lat - Current latitude
 * @param {number} req.body.lng - Current longitude
 * 
 * @returns {Object} 200 - Location updated successfully
 * @returns {Object} 400 - Missing coordinates
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * POST /api/trips/507f1f77bcf86cd799439011/location
 * Authorization: Bearer <jwt_token>
 * {
 *   "lat": 40.7128,
 *   "lng": -74.0060
 * }
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Location updated successfully",
 *   "location": {
 *     "type": "Point",
 *     "coordinates": [-74.0060, 40.7128]
 *   }
 * }
 * 
 * @businessLogic
 * - Only trip owner (driver) can update location
 * - Latitude and longitude are required
 * - Location stored as GeoJSON Point [lng, lat]
 * - Typically called periodically (e.g., every 5-30 seconds) during active trip
 * - Passengers can track driver location in real-time
 * - Consider emitting Socket.io event for live updates (future enhancement)
 * 
 * @geospatial
 * - currentLocation: GeoJSON Point format [lng, lat]
 * - Enables distance calculations and map display
 */
export const updateDriverLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const trip = await Trip.findById(req.params.id);

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
        message: 'Only the trip driver can update location'
      });
    }

    // Update current location
    trip.currentLocation = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)]
    };
    
    await trip.save();

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      location: trip.currentLocation
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update location'
    });
  }
};

/**
 * Get Trip Details
 * 
 * @description Retrieves complete trip information including driver details and all
 * associated ride requests with passenger information.
 * 
 * @route GET /api/trips/:id
 * @access Private (Authenticated users)
 * 
 * @param {string} req.params.id - MongoDB ObjectId of the trip
 * 
 * @returns {Object} 200 - Complete trip details
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * GET /api/trips/507f1f77bcf86cd799439011
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "trip": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "driverId": {
 *       "_id": "...",
 *       "name": "Jane Smith",
 *       "email": "jane@example.com",
 *       "phone": "+1234567890"
 *     },
 *     "source": "Downtown Office",
 *     "destination": "Airport Terminal 2",
 *     "scheduledTime": "2026-02-13T09:00:00.000Z",
 *     "vehicleType": "CAR",
 *     "totalSeats": 4,
 *     "availableSeats": 2,
 *     "status": "SCHEDULED",
 *     "rides": [
 *       {
 *         "_id": "...",
 *         "passengerId": {
 *           "_id": "...",
 *           "name": "John Doe",
 *           "email": "john@example.com",
 *           "phone": "+0987654321"
 *         },
 *         "status": "APPROVED",
 *         "pickupStatus": "PICKED_UP"
 *       }
 *     ],
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Available to all authenticated users
 * - Populates driver contact information (name, email, phone)
 * - Populates all ride requests associated with trip
 * - Each ride includes passenger details (name, email, phone)
 * - Shows current seat availability
 * - Used for trip detail view and live tracking
 */
export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('driverId', 'name email phone')
      .populate({
        path: 'rides',
        populate: {
          path: 'passengerId',
          select: 'name email phone'
        }
      });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    res.status(200).json({
      success: true,
      trip
    });

  } catch (error) {
    console.error('Get trip error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get trip'
    });
  }
};

/**
 * Start Trip
 * 
 * @description Driver marks trip as started when beginning the journey. Records actual
 * start time and transitions status from SCHEDULED to STARTED.
 * 
 * @route POST /api/trips/:id/start
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of trip to start
 * 
 * @returns {Object} 200 - Trip started successfully
 * @returns {Object} 400 - Cannot start (wrong status)
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * POST /api/trips/507f1f77bcf86cd799439011/start
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Trip started successfully",
 *   "trip": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "status": "STARTED",
 *     "actualStartTime": "2026-02-13T09:02:00.000Z",
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Only trip owner (driver) can start their trip
 * - Can only start SCHEDULED trips
 * - Status transitions: SCHEDULED -> STARTED
 * - Records actualStartTime timestamp
 * - Driver can now update location and mark passengers as picked up
 */
export const startTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Verify the user is the driver
    if (trip.driverId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the driver can start this trip'
      });
    }

    if (trip.status !== 'SCHEDULED') {
      return res.status(400).json({
        success: false,
        message: `Cannot start trip with status ${trip.status}`
      });
    }

    trip.status = 'STARTED';
    trip.actualStartTime = new Date();
    await trip.save();

    res.status(200).json({
      success: true,
      message: 'Trip started successfully',
      trip
    });

  } catch (error) {
    console.error('Start trip error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to start trip'
    });
  }
};

/**
 * Complete Trip
 * 
 * @description Driver marks trip as completed when journey ends. Records actual end time.
 * 
 * @route POST /api/trips/:id/complete
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of trip to complete
 * 
 * @returns {Object} 200 - Trip completed successfully
 * @returns {Object} 400 - Trip already completed
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * POST /api/trips/507f1f77bcf86cd799439011/complete
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Trip completed successfully",
 *   "trip": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "status": "COMPLETED",
 *     "actualEndTime": "2026-02-13T10:30:00.000Z",
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Only trip owner (driver) can complete their trip
 * - Can complete from any status except already COMPLETED
 * - Status transitions: SCHEDULED/STARTED/IN_PROGRESS -> COMPLETED
 * - Records actualEndTime timestamp
 * - Marks trip as finished in history
 * - No further modifications allowed after completion
 */
export const completeTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Verify the user is the driver
    if (trip.driverId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the driver can complete this trip'
      });
    }

    if (trip.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Trip is already completed'
      });
    }

    trip.status = 'COMPLETED';
    trip.actualEndTime = new Date();
    await trip.save();

    res.status(200).json({
      success: true,
      message: 'Trip completed successfully',
      trip
    });

  } catch (error) {
    console.error('Complete trip error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to complete trip'
    });
  }
};

/**
 * Cancel Trip
 * 
 * @description Driver cancels a trip before or during journey. Prevents further passenger
 * requests and modifications.
 * 
 * @route POST /api/trips/:id/cancel
 * @access Private (Drivers only - must be the trip owner)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated driver
 * @param {string} req.params.id - MongoDB ObjectId of trip to cancel
 * 
 * @returns {Object} 200 - Trip cancelled successfully
 * @returns {Object} 400 - Cannot cancel (already completed or cancelled)
 * @returns {Object} 403 - Not authorized (not the trip driver)
 * @returns {Object} 404 - Trip not found
 * 
 * @example
 * // Request
 * POST /api/trips/507f1f77bcf86cd799439011/cancel
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "success": true,
 *   "message": "Trip cancelled successfully",
 *   "trip": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "status": "CANCELLED",
 *     ...
 *   }
 * }
 * 
 * @businessLogic
 * - Only trip owner (driver) can cancel their trip
 * - Cannot cancel COMPLETED or already CANCELLED trips
 * - Status transitions: SCHEDULED/STARTED/IN_PROGRESS -> CANCELLED
 * - Trip removed from search results
 * - Existing ride requests remain but trip unavailable
 * - Consider notifying passengers (future enhancement)
 */
export const cancelTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Verify the user is the driver
    if (trip.driverId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the driver can cancel this trip'
      });
    }

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a trip that is already ${trip.status.toLowerCase()}`
      });
    }

    // Block cancellation once the trip has started
    if (trip.status === 'STARTED' || trip.status === 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a trip that has already started'
      });
    }

    // Find all affected ride requests (APPROVED and PENDING)
    const affectedRides = await RideRequest.find({
      tripId: trip._id,
      status: { $in: ['APPROVED', 'PENDING'] }
    }).populate('passengerId', 'name email');

    // Restore available seats atomically for APPROVED rides
    const approvedRidesCount = affectedRides.filter(r => r.status === 'APPROVED').length;
    if (approvedRidesCount > 0) {
      await Trip.findByIdAndUpdate(trip._id, {
        $inc: { availableSeats: approvedRidesCount }
      });
    }

    // Auto-reject any pending requests since the trip is gone
    await RideRequest.updateMany(
      { tripId: trip._id, status: 'PENDING' },
      { $set: { status: 'REJECTED' } }
    );

    // Mark trip as cancelled
    trip.status = 'CANCELLED';
    await trip.save();

    // Notify every affected passenger in real-time
    try {
      const io = getIO();
      for (const ride of affectedRides) {
        io.to(`user-${ride.passengerId._id.toString()}`).emit('trip-cancelled', {
          tripId: trip._id.toString(),
          rideId: ride._id.toString(),
          message: `Your requested trip from ${trip.source} to ${trip.destination} has been cancelled by the driver`,
          cancelledBy: 'driver',
          timestamp: new Date()
        });
      }
      // Also broadcast a general trip status update
      io.emit('trip-seats-updated', {
        tripId: trip._id.toString(),
        availableSeats: trip.totalSeats,
        status: 'CANCELLED',
        timestamp: new Date()
      });
    } catch (socketError) {
      console.error('Socket.io emit error in cancelTrip:', socketError);
    }

    const updatedTrip = await Trip.findById(trip._id).populate('driverId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Trip cancelled successfully',
      trip: updatedTrip,
      passengersNotified: affectedRides.length
    });

  } catch (error) {
    console.error('Cancel trip error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel trip'
    });
  }
};

/**
 * Get Trip Summary
 * 
 * @description Provides comprehensive trip summary after completion including statistics,
 * passenger details, time metrics, and route information. Used for post-trip review.
 * 
 * @route GET /api/trips/:id/summary
 * @access Private (Trip participants only - driver or approved passengers)
 * 
 * @param {Object} req.params
 * @param {string} req.params.id - MongoDB ObjectId of trip
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated user
 * 
 * @returns {Object} 200 - Trip summary data
 * @returns {Object} 403 - User not authorized to view this trip
 * @returns {Object} 404 - Trip not found
 */
export const getTripSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Fetch trip with driver details
    const trip = await Trip.findById(id)
      .populate('driverId', 'name email phoneNumber')
      .lean();

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Fetch all ride requests for this trip
    const rideRequests = await RideRequest.find({ tripId: id })
      .populate('passengerId', 'name email phoneNumber pickupLocation')
      .lean();

    // Authorization: Check if user is driver or an approved passenger
    const isDriver = trip.driverId._id.toString() === userId.toString();
    const isApprovedPassenger = rideRequests.some(
      ride => ride.status === 'APPROVED' && ride.passengerId._id.toString() === userId.toString()
    );

    if (!isDriver && !isApprovedPassenger) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this trip summary'
      });
    }

    // Calculate timing metrics
    const scheduledTime = new Date(trip.scheduledTime);
    const actualStartTime = trip.actualStartTime ? new Date(trip.actualStartTime) : null;
    const actualEndTime = trip.actualEndTime ? new Date(trip.actualEndTime) : null;

    let durationMinutes = null;
    let delayMinutes = null;

    if (actualStartTime && actualEndTime) {
      durationMinutes = Math.round((actualEndTime - actualStartTime) / 1000 / 60);
    }

    if (actualStartTime) {
      delayMinutes = Math.round((actualStartTime - scheduledTime) / 1000 / 60);
    }

    // Calculate passenger statistics
    const approvedRides = rideRequests.filter(ride => ride.status === 'APPROVED');
    const pickedUpCount = approvedRides.filter(ride => ride.pickupStatus === 'PICKED_UP' || ride.pickupStatus === 'DROPPED_OFF').length;
    const droppedOffCount = approvedRides.filter(ride => ride.pickupStatus === 'DROPPED_OFF').length;

    // Build passenger list
    const passengerList = approvedRides.map(ride => ({
      passengerId: ride.passengerId._id,
      name: ride.passengerId.name,
      email: ride.passengerId.email,
      phoneNumber: ride.passengerId.phoneNumber,
      pickupAddress: ride.passengerId.pickupLocation?.address || 'Not specified',
      pickupStatus: ride.pickupStatus,
      pickedUpAt: ride.pickedUpAt,
      droppedOffAt: ride.droppedOffAt,
      requestedAt: ride.createdAt
    }));

    // Extract route coordinates for distance calculation
    let estimatedDistance = null;
    if (trip.sourceLocation?.coordinates?.coordinates && trip.destinationLocation?.coordinates?.coordinates) {
      const [srcLng, srcLat] = trip.sourceLocation.coordinates.coordinates;
      const [destLng, destLat] = trip.destinationLocation.coordinates.coordinates;
      
      // Haversine formula for distance (in km)
      const R = 6371; // Earth's radius in km
      const dLat = (destLat - srcLat) * Math.PI / 180;
      const dLng = (destLng - srcLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(srcLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      estimatedDistance = Math.round(R * c * 10) / 10; // Round to 1 decimal
    }

    // Build summary response
    const summary = {
      tripId: trip._id,
      status: trip.status,
      driver: {
        id: trip.driverId._id,
        name: trip.driverId.name,
        email: trip.driverId.email,
        phoneNumber: trip.driverId.phoneNumber
      },
      route: {
        source: trip.source,
        destination: trip.destination,
        sourceAddress: trip.sourceLocation?.address || trip.source,
        destinationAddress: trip.destinationLocation?.address || trip.destination,
        estimatedDistance: estimatedDistance ? `${estimatedDistance} km` : 'Not available'
      },
      timing: {
        scheduledTime: trip.scheduledTime,
        actualStartTime: trip.actualStartTime,
        actualEndTime: trip.actualEndTime,
        durationMinutes,
        durationFormatted: durationMinutes ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : null,
        delayMinutes,
        delayFormatted: delayMinutes !== null ? (delayMinutes >= 0 ? `${delayMinutes}m late` : `${Math.abs(delayMinutes)}m early`) : null
      },
      passengers: {
        total: approvedRides.length,
        pickedUp: pickedUpCount,
        droppedOff: droppedOffCount,
        list: passengerList
      },
      vehicle: {
        type: trip.vehicleType,
        totalSeats: trip.totalSeats,
        seatsOccupied: approvedRides.length
      },
      cost: {
        estimated: trip.estimatedCost,
        currency: 'INR'
      },
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt
    };

    res.status(200).json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Get trip summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get trip summary'
    });
  }
};
