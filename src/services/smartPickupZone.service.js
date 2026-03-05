import SmartPickupZone from '../models/SmartPickupZone.js';

/**
 * @fileoverview Smart Pickup Zone Service
 * @description Service for detecting and managing smart pickup zones near passenger locations
 * @module services/smartPickupZone.service
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Find Nearby Smart Pickup Zones
 * 
 * @description Searches for active smart pickup zones near the given coordinates.
 * Uses MongoDB's geospatial query with $near operator.
 * 
 * @param {number[]} coordinates - [longitude, latitude] of pickup location
 * @param {number} [maxDistance=500] - Maximum search radius in meters
 * @param {string} [organizationId=null] - Optional organization ID for org-specific zones
 * @returns {Promise<Array>} Array of nearby zones with calculated distances
 * 
 * @example
 * const zones = await findNearbyPickupZones([-122.4194, 37.7749], 300);
 * // Returns zones within 300 meters, sorted by distance
 */
export const findNearbyPickupZones = async (coordinates, maxDistance = 500, organizationId = null) => {
  try {
    const [longitude, latitude] = coordinates;

    // Build query filter
    const filter = {
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      }
    };

    // Include organization-specific zones or public zones
    if (organizationId) {
      filter.$or = [
        { organizationId: organizationId },
        { organizationId: null } // Public zones
      ];
    } else {
      filter.organizationId = null; // Only public zones
    }

    const zones = await SmartPickupZone.find(filter).limit(5);

    // Calculate precise distances for each zone
    const zonesWithDistance = zones.map(zone => {
      const [zoneLon, zoneLat] = zone.location.coordinates;
      const distance = calculateDistance(latitude, longitude, zoneLat, zoneLon);
      
      return {
        _id: zone._id,
        name: zone.name,
        type: zone.type,
        address: zone.address,
        description: zone.description,
        location: zone.location,
        radius: zone.radius,
        distance: Math.round(distance) // Round to nearest meter
      };
    });

    return zonesWithDistance;
  } catch (error) {
    console.error('Error finding nearby pickup zones:', error);
    throw error;
  }
};

/**
 * Get Closest Smart Pickup Zone
 * 
 * @description Finds the single closest smart pickup zone to the given coordinates
 * 
 * @param {number[]} coordinates - [longitude, latitude] of pickup location
 * @param {number} [maxDistance=500] - Maximum search radius in meters
 * @param {string} [organizationId=null] - Optional organization ID for org-specific zones
 * @returns {Promise<Object|null>} Closest zone with distance, or null if none found
 * 
 * @example
 * const zone = await getClosestPickupZone([-122.4194, 37.7749]);
 * if (zone) {
 *   console.log(`Closest zone: ${zone.name}, ${zone.distance}m away`);
 * }
 */
export const getClosestPickupZone = async (coordinates, maxDistance = 500, organizationId = null) => {
  try {
    const zones = await findNearbyPickupZones(coordinates, maxDistance, organizationId);
    return zones.length > 0 ? zones[0] : null;
  } catch (error) {
    console.error('Error getting closest pickup zone:', error);
    throw error;
  }
};

/**
 * Check if Pickup Zone Suggestion is Warranted
 * 
 * @description Determines if a smart pickup zone suggestion should be made
 * based on distance threshold and zone availability
 * 
 * @param {number[]} coordinates - [longitude, latitude] of pickup location
 * @param {number} [suggestionThreshold=300] - Suggest zones within this many meters
 * @param {string} [organizationId=null] - Optional organization ID
 * @returns {Promise<Object|null>} Suggested zone or null
 * 
 * @businessLogic
 * - Only suggest zones within suggestionThreshold (default 300m)
 * - Only suggest if zone is significantly closer/more convenient
 * - Prioritize PARKING_LOT and PICKUP_POINT types
 */
export const getSuggestedPickupZone = async (coordinates, suggestionThreshold = 300, organizationId = null) => {
  try {
    const closestZone = await getClosestPickupZone(coordinates, suggestionThreshold, organizationId);
    
    // Only suggest if zone is found within threshold
    if (closestZone && closestZone.distance <= suggestionThreshold) {
      return closestZone;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting suggested pickup zone:', error);
    return null; // Fail gracefully, don't block ride request
  }
};

/**
 * Format Pickup Zone Notification Message
 * 
 * @description Creates a user-friendly notification message about the suggested zone
 * 
 * @param {Object} zone - Smart pickup zone object
 * @returns {string} Formatted notification message
 */
export const formatPickupZoneNotification = (zone) => {
  const distanceText = zone.distance < 100 
    ? `just ${zone.distance}m away`
    : `about ${Math.round(zone.distance / 10) * 10}m away`;
  
  const typeText = zone.type === 'PARKING_LOT' ? 'parking lot' :
                   zone.type === 'PICKUP_POINT' ? 'designated pickup point' :
                   zone.type === 'TAXI_STAND' ? 'taxi stand' :
                   'transit hub';
  
  return `A convenient ${typeText} "${zone.name}" is ${distanceText}. ` +
         `This location may make it easier for your driver to pick you up safely.`;
};
