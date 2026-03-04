import Trip from '../models/Trip.js';
import RideRequest from '../models/RideRequest.js';

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
 * 
 * @summary
 * Includes:
 * - Trip details (source, destination, vehicle type)
 * - Time metrics (scheduled, actual start/end, duration)
 * - Distance traveled (calculated from route if available)
 * - Passenger statistics (total, picked up, dropped off)
 * - Passenger list with pickup status
 * - Driver information
 * - Cost breakdown
 * 
 * @example Response
 * {
 *   "success": true,
 *   "summary": {
 *     "tripId": "507f1f77bcf86cd799439011",
 *     "status": "COMPLETED",
 *     "driver": {
 *       "name": "Jane Smith",
 *       "email": "jane@example.com"
 *     },
 *     "route": {
 *       "source": "Downtown Office",
 *       "destination": "Airport Terminal 2",
 *       "sourceAddress": "123 Main St",
 *       "destinationAddress": "JFK Airport"
 *     },
 *     "timing": {
 *       "scheduledTime": "2026-02-13T09:00:00.000Z",
 *       "actualStartTime": "2026-02-13T09:05:00.000Z",
 *       "actualEndTime": "2026-02-13T10:30:00.000Z",
 *       "durationMinutes": 85,
 *       "delayMinutes": 5
 *     },
 *     "passengers": {
 *       "total": 3,
 *       "pickedUp": 3,
 *       "droppedOff": 3,
 *       "list": [
 *         {
 *           "name": "John Doe",
 *           "pickupStatus": "DROPPED_OFF",
 *           "pickedUpAt": "2026-02-13T09:10:00.000Z",
 *           "droppedOffAt": "2026-02-13T10:25:00.000Z"
 *         }
 *       ]
 *     },
 *     "vehicleType": "CAR",
 *     "totalSeats": 4,
 *     "estimatedCost": 90
 *   }
 * }
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
        estimatedDistance: estimatedDistance ? `${estimatedDistance} km` : 'Not available',
        waypoints: trip.waypoints?.map(wp => ({
          address: wp.address,
          order: wp.order,
          coordinates: wp.coordinates?.coordinates ? {
            lat: wp.coordinates.coordinates[1],
            lng: wp.coordinates.coordinates[0]
          } : null
        })) || [],
        isOptimized: trip.isOptimized || false,
        routeMetadata: trip.routeMetadata || null
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
