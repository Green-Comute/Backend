import mongoose from 'mongoose';

/**
 * @fileoverview Trip Model
 * @description Defines the Trip schema for driver-created ride-sharing trips.
 * Includes geospatial data for route planning and proximity matching.
 * @module models/Trip
 */

/**
 * Trip Schema
 * 
 * @description Represents a scheduled trip created by a driver. Passengers can
 * request to join trips and drivers manage passenger approvals.
 * 
 * @schema
 * 
 * @property {ObjectId} driverId - Reference to User (driver)
 * @property {string} vehicleType - CAR or BIKE
 * @property {number} totalSeats - Total seats available (CAR: 1-7, BIKE: 1)
 * @property {number} availableSeats - Current available seats (decrements on approval)
 * @property {string} source - Source location text
 * @property {Object} [sourceLocation] - GeoJSON Point for source
 * @property {string} sourceLocation.address - Source address
 * @property {Object} sourceLocation.coordinates - GeoJSON Point
 * @property {string} sourceLocation.coordinates.type - Always 'Point'
 * @property {number[]} sourceLocation.coordinates.coordinates - [longitude, latitude]
 * @property {string} destination - Destination location text
 * @property {Object} [destinationLocation] - GeoJSON Point for destination
 * @property {string} destinationLocation.address - Destination address
 * @property {Object} destinationLocation.coordinates - GeoJSON Point
 * @property {string} destinationLocation.coordinates.type - Always 'Point'
 * @property {number[]} destinationLocation.coordinates.coordinates - [longitude, latitude]
 * @property {Date} scheduledTime - Trip scheduled time (must be within 7 days)
 * @property {number} estimatedCost - Calculated cost (50 + totalSeats * 10)
 * @property {string} status - SCHEDULED, STARTED, IN_PROGRESS, COMPLETED, CANCELLED
 * @property {Object} [currentLocation] - Driver's current location (GeoJSON Point)
 * @property {string} currentLocation.type - Always 'Point'
 * @property {number[]} currentLocation.coordinates - [longitude, latitude]
 * @property {Object} [route] - GeoJSON LineString route
 * @property {Date} [actualStartTime] - When trip started
 * @property {Date} [actualEndTime] - When trip completed/ended
 * @property {Date} createdAt - Trip creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * 
 * @indexes
 * - sourceLocation.coordinates: 2dsphere index for geospatial queries
 * - destinationLocation.coordinates: 2dsphere index for geospatial queries
 * - status: Index for filtering available trips
 * 
 * @geospatial
 * - Coordinates stored as [longitude, latitude] (GeoJSON standard)
 * - 2dsphere indexes enable proximity searches
 * - Search trips within radius of user location
 * - Calculate distances between locations
 * 
 * @validation
 * - scheduledTime must be within next 7 days
 * - CAR: 1-7 seats, BIKE: exactly 1 seat
 * - availableSeats cannot be negative
 * 
 * @lifecycle
 * 1. Driver creates trip via /api/trips
 *    - status = SCHEDULED, availableSeats = totalSeats
 * 2. Passengers request via /api/rides/request
 * 3. Driver approves via /api/rides/:id/approve
 *    - availableSeats decremented atomically
 * 4. Driver starts trip via /api/trips/:id/start
 *    - status = STARTED, actualStartTime = now
 * 5. Driver updates location via /api/trips/:id/location
 *    - currentLocation updated periodically
 * 6. Driver completes via /api/trips/:id/complete
 *    - status = COMPLETED, actualEndTime = now
 * 
 * @example
 * {
 *   "driverId": "507f1f77bcf86cd799439011",
 *   "vehicleType": "CAR",
 *   "totalSeats": 4,
 *   "availableSeats": 2,
 *   "source": "Downtown Office",
 *   "sourceLocation": {
 *     "coordinates": {
 *       "type": "Point",
 *       "coordinates": [-74.0060, 40.7128]
 *     }
 *   },
 *   "destination": "Airport",
 *   "scheduledTime": "2026-02-13T09:00:00.000Z",
 *   "status": "SCHEDULED"
 * }
 */
const tripSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Driver ID is required']
  },
  vehicleType: {
    type: String,
    enum: {
      values: ['CAR', 'BIKE'],
      message: '{VALUE} is not a valid vehicle type'
    },
    required: [true, 'Vehicle type is required']
  },
  totalSeats: {
    type: Number,
    required: [true, 'Total seats is required'],
    min: [1, 'At least 1 seat must be available'],
    validate: {
      validator: function(value) {
        if (this.vehicleType === 'CAR') {
          return value <= 7;
        } else if (this.vehicleType === 'BIKE') {
          return value === 1;
        }
        return true;
      },
      message: function() {
        if (this.vehicleType === 'CAR') {
          return 'CAR can have maximum 7 seats';
        } else if (this.vehicleType === 'BIKE') {
          return 'BIKE must have exactly 1 seat';
        }
        return 'Invalid seats configuration';
      }
    }
  },
  availableSeats: {
    type: Number,
    required: [true, 'Available seats is required'],
    min: [0, 'Available seats cannot be negative']
  },
  source: {
    type: String,
    required: [true, 'Source location is required'],
    trim: true
  },
  sourceLocation: {
    address: String,
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    }
  },
  destination: {
    type: String,
    required: [true, 'Destination location is required'],
    trim: true
  },
  destinationLocation: {
    address: String,
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    }
  },
  scheduledTime: {
    type: Date,
    required: [true, 'Scheduled time is required'],
    validate: {
      validator: function(value) {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return value >= now && value <= sevenDaysFromNow;
      },
      message: 'Scheduled time must be within the next 7 days'
    }
  },
  estimatedCost: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: {
      values: ['SCHEDULED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      message: '{VALUE} is not a valid status'
    },
    default: 'SCHEDULED'
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date
  },
  // Legacy fields for backward compatibility with geo-based queries
  seatsAvailable: {
    type: Number,
    default: function() {
      return this.availableSeats;
    }
  },
  startTime: {
    type: Date,
    default: function() {
      return this.scheduledTime;
    }
  },
  route: {
    type: {
      type: String,
      enum: ['LineString']
    },
    coordinates: {
      type: [[Number]],
      validate: {
        validator: function(coords) {
          // Route must have at least 2 distinct vertices
          if (!coords || coords.length < 2) return false;
          // Check that not all coordinates are the same
          const first = coords[0];
          return coords.some(coord => coord[0] !== first[0] || coord[1] !== first[1]);
        },
        message: 'Route must have at least 2 distinct vertices'
      }
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for rides
tripSchema.virtual('rides', {
  ref: 'RideRequest',
  localField: '_id',
  foreignField: 'tripId'
});

// Create 2dsphere index on route
tripSchema.index({ route: '2dsphere' });
tripSchema.index({ 'sourceLocation.coordinates': '2dsphere' });
tripSchema.index({ 'destinationLocation.coordinates': '2dsphere' });
tripSchema.index({ currentLocation: '2dsphere' });

// Index for efficient searches
tripSchema.index({ status: 1, availableSeats: 1 });
tripSchema.index({ source: 1, destination: 1 });

const Trip = mongoose.model('Trip', tripSchema);

export default Trip;
