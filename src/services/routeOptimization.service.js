/**
 * @fileoverview Route Optimization Service
 * @description Optimizes multi-stop routes using nearest neighbor algorithm
 * to find the shortest path through waypoints (max 4 stops).
 * @module services/routeOptimizationService
 */

/**
 * Calculate Haversine distance between two points
 * 
 * @param {Object} point1 - First location {lat, lng}
 * @param {Object} point2 - Second location {lat, lng}
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (point1, point2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 * 
 * @param {number} degrees 
 * @returns {number} Radians
 */
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate total route distance
 * 
 * @param {Array<Object>} points - Array of ordered waypoints [{lat, lng}, ...]
 * @returns {number} Total distance in kilometers
 */
const calculateTotalDistance = (points) => {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
};

/**
 * Optimize waypoint order using Nearest Neighbor Algorithm
 * 
 * @description Finds the shortest path through all waypoints starting from source
 * and ending at destination. Uses a greedy nearest neighbor approach which is
 * efficient for small numbers of waypoints (max 4 stops).
 * 
 * For the Traveling Salesman Problem with fixed start and end points:
 * 1. Start at source
 * 2. Always visit the nearest unvisited waypoint
 * 3. End at destination
 * 
 * Time Complexity: O(n²) where n is the number of waypoints
 * 
 * @param {Object} source - Starting location {lat, lng, address}
 * @param {Object} destination - Ending location {lat, lng, address}
 * @param {Array<Object>} waypoints - Intermediate stops [{lat, lng, address}, ...]
 * @returns {Object} Optimized route data
 * @returns {Array<Object>} result.orderedWaypoints - Optimized waypoint order
 * @returns {number} result.totalDistance - Total route distance in km
 * @returns {number} result.estimatedDuration - Estimated duration in minutes (60 km/h avg)
 * @returns {Array<Object>} result.legs - Individual route segments with distances
 * 
 * @example
 * const optimized = optimizeRoute(
 *   { lat: 40.7128, lng: -74.0060, address: "NYC" },
 *   { lat: 42.3601, lng: -71.0589, address: "Boston" },
 *   [
 *     { lat: 41.3082, lng: -72.9251, address: "New Haven" },
 *     { lat: 41.8240, lng: -71.4128, address: "Providence" }
 *   ]
 * );
 * // Returns optimized order: NYC → New Haven → Providence → Boston
 */
export const optimizeRoute = (source, destination, waypoints = []) => {
  // Validate inputs
  if (!source || !destination) {
    throw new Error('Source and destination are required');
  }

  if (!waypoints || waypoints.length === 0) {
    // No waypoints, just direct route
    const distance = calculateDistance(source, destination);
    return {
      orderedWaypoints: [],
      totalDistance: Math.round(distance * 10) / 10,
      estimatedDuration: Math.round((distance / 60) * 60), // minutes at 60 km/h avg
      legs: [
        {
          from: source.address || 'Source',
          to: destination.address || 'Destination',
          distance: Math.round(distance * 10) / 10
        }
      ]
    };
  }

  // Validate max 4 waypoints
  if (waypoints.length > 4) {
    throw new Error('Maximum 4 intermediate stops allowed');
  }

  // Validate all waypoints have coordinates
  for (const wp of waypoints) {
    if (!wp.lat || !wp.lng) {
      throw new Error('All waypoints must have lat and lng coordinates');
    }
  }

  // Nearest Neighbor Algorithm
  const unvisited = [...waypoints];
  const ordered = [];
  let currentPoint = source;
  const legs = [];

  // Visit each waypoint in nearest order
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = calculateDistance(currentPoint, unvisited[0]);

    // Find nearest unvisited waypoint
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(currentPoint, unvisited[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    // Move to nearest waypoint
    const nearest = unvisited[nearestIndex];
    ordered.push(nearest);
    legs.push({
      from: currentPoint.address || 'Point',
      to: nearest.address || 'Waypoint',
      distance: Math.round(nearestDistance * 10) / 10
    });
    
    currentPoint = nearest;
    unvisited.splice(nearestIndex, 1);
  }

  // Add final leg to destination
  const finalDistance = calculateDistance(currentPoint, destination);
  legs.push({
    from: currentPoint.address || 'Last waypoint',
    to: destination.address || 'Destination',
    distance: Math.round(finalDistance * 10) / 10
  });

  // Calculate total distance
  const allPoints = [source, ...ordered, destination];
  const totalDistance = calculateTotalDistance(allPoints);

  return {
    orderedWaypoints: ordered,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedDuration: Math.round((totalDistance / 60) * 60), // minutes at 60 km/h avg
    legs
  };
};

/**
 * Validate route optimization input
 * 
 * @param {Object} source - Source location
 * @param {Object} destination - Destination location  
 * @param {Array<Object>} waypoints - Waypoints
 * @returns {Object} Validation result {valid: boolean, error: string}
 */
export const validateRouteInput = (source, destination, waypoints = []) => {
  if (!source || !source.lat || !source.lng) {
    return { valid: false, error: 'Source must have lat and lng coordinates' };
  }

  if (!destination || !destination.lat || !destination.lng) {
    return { valid: false, error: 'Destination must have lat and lng coordinates' };
  }

  if (waypoints.length > 4) {
    return { valid: false, error: 'Maximum 4 intermediate stops allowed' };
  }

  for (let i = 0; i < waypoints.length; i++) {
    if (!waypoints[i].lat || !waypoints[i].lng) {
      return { valid: false, error: `Waypoint ${i + 1} must have lat and lng coordinates` };
    }
  }

  return { valid: true };
};

export default {
  optimizeRoute,
  validateRouteInput,
  calculateDistance,
  calculateTotalDistance
};
