import SmartPickupZone from '../models/SmartPickupZone.js';
import { findNearbyPickupZones } from '../services/smartPickupZone.service.js';

/**
 * @fileoverview Smart Pickup Zone Controller
 * @description Manages CRUD operations for smart pickup zones
 * @module controllers/smartPickupZone.controller
 */

/**
 * Create Smart Pickup Zone
 * 
 * @description Creates a new smart pickup zone (admin/org-admin only)
 * 
 * @route POST /api/pickup-zones
 * @access Private (Platform Admin or Org Admin)
 * 
 * @param {Object} req.body - Zone data
 * @param {string} req.body.name - Zone name
 * @param {string} req.body.type - Zone type (PARKING_LOT, PICKUP_POINT, TAXI_STAND, TRANSIT_HUB)
 * @param {Object} req.body.location - GeoJSON Point
 * @param {string} req.body.address - Zone address
 * @param {string} [req.body.description] - Optional description
 * @param {number} [req.body.radius] - Radius in meters (default: 100)
 * @param {string} [req.body.organizationId] - Organization ID for org-specific zones
 * 
 * @returns {Object} 201 - Zone created successfully
 * @returns {Object} 400 - Validation error
 */
export const createPickupZone = async (req, res) => {
  try {
    const { name, type, location, address, description, radius, organizationId } = req.body;

    // Validate required fields
    if (!name || !type || !location || !address) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, location, and address are required'
      });
    }

    // Validate location format
    if (!location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Location must be a GeoJSON Point with [longitude, latitude]'
      });
    }

    const zoneData = {
      name,
      type,
      location: {
        type: 'Point',
        coordinates: location.coordinates
      },
      address,
      description,
      radius: radius || 100
    };

    // Add organization if specified (for org-specific zones)
    if (organizationId) {
      zoneData.organizationId = organizationId;
    }

    const zone = await SmartPickupZone.create(zoneData);

    res.status(201).json({
      success: true,
      data: zone
    });

  } catch (error) {
    console.error('Create pickup zone error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create pickup zone'
    });
  }
};

/**
 * Get All Pickup Zones
 * 
 * @description Retrieves all active pickup zones, optionally filtered by organization
 * 
 * @route GET /api/pickup-zones
 * @access Public
 * 
 * @param {string} [req.query.organizationId] - Filter by organization
 * @param {string} [req.query.type] - Filter by zone type
 * @param {number} [req.query.limit] - Limit results (default: 100)
 * 
 * @returns {Object} 200 - List of pickup zones
 */
export const getAllPickupZones = async (req, res) => {
  try {
    const { organizationId, type, limit = 100 } = req.query;

    const filter = { isActive: true };

    if (organizationId) {
      filter.$or = [
        { organizationId: organizationId },
        { organizationId: null }
      ];
    } else {
      filter.organizationId = null; // Only public zones
    }

    if (type) {
      filter.type = type;
    }

    const zones = await SmartPickupZone.find(filter)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: zones.length,
      data: zones
    });

  } catch (error) {
    console.error('Get pickup zones error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to retrieve pickup zones'
    });
  }
};

/**
 * Get Pickup Zone by ID
 * 
 * @description Retrieves a single pickup zone by ID
 * 
 * @route GET /api/pickup-zones/:id
 * @access Public
 * 
 * @param {string} req.params.id - Zone ID
 * 
 * @returns {Object} 200 - Pickup zone details
 * @returns {Object} 404 - Zone not found
 */
export const getPickupZoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await SmartPickupZone.findById(id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Pickup zone not found'
      });
    }

    res.status(200).json({
      success: true,
      data: zone
    });

  } catch (error) {
    console.error('Get pickup zone error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to retrieve pickup zone'
    });
  }
};

/**
 * Get Nearby Pickup Zones
 * 
 * @description Finds pickup zones near given coordinates
 * 
 * @route GET /api/pickup-zones/nearby
 * @access Public
 * 
 * @param {number} req.query.longitude - Longitude coordinate
 * @param {number} req.query.latitude - Latitude coordinate
 * @param {number} [req.query.maxDistance] - Max distance in meters (default: 500)
 * @param {string} [req.query.organizationId] - Organization ID
 * 
 * @returns {Object} 200 - List of nearby zones with distances
 */
export const getNearbyPickupZones = async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 500, organizationId } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: 'Longitude and latitude are required'
      });
    }

    const coordinates = [parseFloat(longitude), parseFloat(latitude)];
    const zones = await findNearbyPickupZones(
      coordinates,
      parseInt(maxDistance),
      organizationId || null
    );

    res.status(200).json({
      success: true,
      count: zones.length,
      data: zones
    });

  } catch (error) {
    console.error('Get nearby pickup zones error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to find nearby pickup zones'
    });
  }
};

/**
 * Update Pickup Zone
 * 
 * @description Updates an existing pickup zone (admin/org-admin only)
 * 
 * @route PUT /api/pickup-zones/:id
 * @access Private (Platform Admin or Org Admin)
 * 
 * @param {string} req.params.id - Zone ID
 * @param {Object} req.body - Updated zone data
 * 
 * @returns {Object} 200 - Zone updated successfully
 * @returns {Object} 404 - Zone not found
 */
export const updatePickupZone = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdAt;

    const zone = await SmartPickupZone.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Pickup zone not found'
      });
    }

    res.status(200).json({
      success: true,
      data: zone
    });

  } catch (error) {
    console.error('Update pickup zone error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update pickup zone'
    });
  }
};

/**
 * Delete Pickup Zone
 * 
 * @description Soft deletes a pickup zone by setting isActive to false
 * 
 * @route DELETE /api/pickup-zones/:id
 * @access Private (Platform Admin or Org Admin)
 * 
 * @param {string} req.params.id - Zone ID
 * 
 * @returns {Object} 200 - Zone deleted successfully
 * @returns {Object} 404 - Zone not found
 */
export const deletePickupZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await SmartPickupZone.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Pickup zone not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Pickup zone deleted successfully',
      data: zone
    });

  } catch (error) {
    console.error('Delete pickup zone error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete pickup zone'
    });
  }
};

/**
 * Accept Suggested Pickup Zone
 * 
 * @description Passenger accepts the suggested pickup zone for their ride request
 * 
 * @route POST /api/pickup-zones/accept/:rideRequestId
 * @access Private (Authenticated passenger)
 * 
 * @param {string} req.params.rideRequestId - Ride request ID
 * @param {Object} req.user - Authenticated user
 * 
 * @returns {Object} 200 - Suggestion accepted
 * @returns {Object} 404 - Ride request not found
 */
export const acceptSuggestedZone = async (req, res) => {
  try {
    const { rideRequestId } = req.params;
    const passengerId = req.user.userId;

    const RideRequest = (await import('../models/RideRequest.js')).default;
    
    const rideRequest = await RideRequest.findOne({
      _id: rideRequestId,
      passengerId: passengerId
    }).populate('suggestedPickupZone.zoneId');

    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }

    if (!rideRequest.suggestedPickupZone || !rideRequest.suggestedPickupZone.zoneId) {
      return res.status(400).json({
        success: false,
        message: 'No suggested pickup zone for this ride request'
      });
    }

    // Update the pickup location to the suggested zone
    const zone = rideRequest.suggestedPickupZone.zoneId;
    rideRequest.pickupLocation = {
      address: zone.address,
      coordinates: zone.location
    };
    rideRequest.suggestedPickupZone.isAccepted = true;
    
    await rideRequest.save();

    res.status(200).json({
      success: true,
      message: 'Pickup zone accepted successfully',
      data: rideRequest
    });

  } catch (error) {
    console.error('Accept suggested zone error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to accept suggested zone'
    });
  }
};
