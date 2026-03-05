import mongoose from 'mongoose';

/**
 * @fileoverview Smart Pickup Zone Model
 * @description Defines designated pickup zones like parking lots, taxi stands, or
 * designated pickup areas that are convenient for drivers and passengers.
 * @module models/SmartPickupZone
 */

/**
 * Smart Pickup Zone Schema
 * 
 * @description Represents a designated pickup zone that makes it easier for drivers
 * to pick up passengers. These zones are parking lots, designated pickup areas, or
 * other convenient locations near common pickup points.
 * 
 * @schema
 * 
 * @property {string} name - Name of the pickup zone (e.g., "Main Street Parking Lot")
 * @property {string} type - Type of zone: PARKING_LOT, PICKUP_POINT, TAXI_STAND, TRANSIT_HUB
 * @property {Object} location - GeoJSON Point representing zone center
 * @property {string} location.type - Always 'Point'
 * @property {number[]} location.coordinates - [longitude, latitude]
 * @property {string} address - Full address of the zone
 * @property {string} [description] - Additional details about the zone
 * @property {number} radius - Suggested radius in meters for proximity detection (default: 100)
 * @property {boolean} isActive - Whether zone is currently active (default: true)
 * @property {ObjectId} [organizationId] - Reference to Organization (for org-specific zones)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * 
 * @indexes
 * - 2dsphere index on location for geospatial queries
 * - organizationId for filtering org-specific zones
 * 
 * @example
 * {
 *   "name": "Central Mall Parking",
 *   "type": "PARKING_LOT",
 *   "location": {
 *     "type": "Point",
 *     "coordinates": [-122.4194, 37.7749]
 *   },
 *   "address": "123 Central Mall Way, San Francisco, CA",
 *   "description": "Use entrance B for easiest access",
 *   "radius": 150,
 *   "isActive": true
 * }
 */
const smartPickupZoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Zone name is required'],
    trim: true,
    maxlength: [100, 'Zone name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['PARKING_LOT', 'PICKUP_POINT', 'TAXI_STAND', 'TRANSIT_HUB'],
      message: '{VALUE} is not a valid zone type'
    },
    required: [true, 'Zone type is required']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Zone coordinates are required'],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates format. Must be [longitude, latitude]'
      }
    }
  },
  address: {
    type: String,
    required: [true, 'Zone address is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  radius: {
    type: Number,
    default: 100, // meters
    min: [10, 'Radius must be at least 10 meters'],
    max: [1000, 'Radius cannot exceed 1000 meters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null // null means it's a public/global zone
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
smartPickupZoneSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create 2dsphere index for geospatial queries
smartPickupZoneSchema.index({ location: '2dsphere' });
smartPickupZoneSchema.index({ organizationId: 1, isActive: 1 });
smartPickupZoneSchema.index({ type: 1, isActive: 1 });

const SmartPickupZone = mongoose.model('SmartPickupZone', smartPickupZoneSchema);

export default SmartPickupZone;
