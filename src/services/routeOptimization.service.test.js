import { describe, it, expect } from '@jest/globals';
import { 
  optimizeRoute, 
  validateRouteInput,
  calculateDistance,
  calculateTotalDistance 
} from './routeOptimization.service.js';

/**
 * @fileoverview Route Optimization Service Tests
 * @description Tests for waypoint optimization and route calculation
 */

describe('Route Optimization Service', () => {
  
  describe('optimizeRoute', () => {
    const source = { lat: 40.7128, lng: -74.0060, address: 'New York, NY' };
    const destination = { lat: 42.3601, lng: -71.0589, address: 'Boston, MA' };

    it('should optimize route with 2 waypoints', () => {
      const waypoints = [
        { lat: 41.3082, lng: -72.9251, address: 'New Haven, CT' },
        { lat: 41.8240, lng: -71.4128, address: 'Providence, RI' }
      ];

      const result = optimizeRoute(source, destination, waypoints);
      
      expect(result).toBeDefined();
      expect(result.orderedWaypoints).toHaveLength(2);
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(result.legs).toHaveLength(3); // source -> wp1 -> wp2 -> dest
    });

    it('should handle direct route with no waypoints', () => {
      const result = optimizeRoute(source, destination, []);
      
      expect(result.orderedWaypoints).toHaveLength(0);
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.legs).toHaveLength(1); // just source -> dest
    });

    it('should optimize 4 waypoints (maximum allowed)', () => {
      const waypoints = [
        { lat: 40.7589, lng: -73.9851, address: 'Times Square' },
        { lat: 40.7614, lng: -73.9776, address: 'Central Park' },
        { lat: 40.7306, lng: -73.9352, address: 'Queens' },
        { lat: 40.6782, lng: -73.9442, address: 'Brooklyn' }
      ];

      const result = optimizeRoute(source, destination, waypoints);
      
      expect(result.orderedWaypoints).toHaveLength(4);
      expect(result.legs).toHaveLength(5); // source + 4 waypoints + dest
    });

    it('should throw error for more than 4 waypoints', () => {
      const waypoints = [
        { lat: 40.7589, lng: -73.9851, address: 'Stop 1' },
        { lat: 40.7614, lng: -73.9776, address: 'Stop 2' },
        { lat: 40.7306, lng: -73.9352, address: 'Stop 3' },
        { lat: 40.6782, lng: -73.9442, address: 'Stop 4' },
        { lat: 40.6500, lng: -73.9500, address: 'Stop 5' }
      ];

      expect(() => optimizeRoute(source, destination, waypoints)).toThrow('Maximum 4 intermediate stops allowed');
    });

    it('should throw error for missing source', () => {
      expect(() => optimizeRoute(null, destination, [])).toThrow('Source and destination are required');
    });

    it('should throw error for missing destination', () => {
      expect(() => optimizeRoute(source, null, [])).toThrow('Source and destination are required');
    });

    it('should throw error for waypoint without coordinates', () => {
      const waypoints = [
        { address: 'Incomplete Stop' } // missing lat/lng
      ];

      expect(() => optimizeRoute(source, destination, waypoints)).toThrow('All waypoints must have lat and lng coordinates');
    });

    it('should order waypoints by nearest neighbor', () => {
      // Start from NYC (40.7128, -74.0060), end at Boston (42.3601, -71.0589)
      const waypoints = [
        { lat: 42.0000, lng: -71.3000, address: 'Near Boston' }, // Closer to Boston
        { lat: 40.8000, lng: -73.9000, address: 'Near NYC' }     // Closer to NYC
      ];

      const result = optimizeRoute(source, destination, waypoints);
      
      // Should visit NYC-near waypoint first, then Boston-near waypoint
      expect(result.orderedWaypoints[0].address).toBe('Near NYC');
      expect(result.orderedWaypoints[1].address).toBe('Near Boston');
    });
  });

  describe('validateRouteInput', () => {
    it('should validate correct input', () => {
      const source = { lat: 40.7128, lng: -74.0060 };
      const destination = { lat: 42.3601, lng: -71.0589 };
      const waypoints = [{ lat: 41.3082, lng: -72.9251 }];

      const result = validateRouteInput(source, destination, waypoints);
      
      expect(result.valid).toBe(true);
    });

    it('should invalidate missing source coordinates', () => {
      const source = { lng: -74.0060 }; // missing lat
      const destination = { lat: 42.3601, lng: -71.0589 };

      const result = validateRouteInput(source, destination, []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Source must have lat and lng');
    });

    it('should invalidate missing destination coordinates', () => {
      const source = { lat: 40.7128, lng: -74.0060 };
      const destination = { lat: 42.3601 }; // missing lng

      const result = validateRouteInput(source, destination, []);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Destination must have lat and lng');
    });

    it('should invalidate more than 4 waypoints', () => {
      const source = { lat: 40.7128, lng: -74.0060 };
      const destination = { lat: 42.3601, lng: -71.0589 };
      const waypoints = Array(5).fill({ lat: 40.0, lng: -73.0 });

      const result = validateRouteInput(source, destination, waypoints);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Maximum 4 intermediate stops');
    });

    it('should invalidate waypoint without coordinates', () => {
      const source = { lat: 40.7128, lng: -74.0060 };
      const destination = { lat: 42.3601, lng: -71.0589 };
      const waypoints = [{ lat: 40.0 }]; // missing lng

      const result = validateRouteInput(source, destination, waypoints);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Waypoint 1 must have lat and lng');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const point1 = { lat: 40.7128, lng: -74.0060 };
      const point2 = { lat: 42.3601, lng: -71.0589 };

      const distance = calculateDistance(point1, point2);
      
      expect(distance).toBeGreaterThan(300); // NYC to Boston ~300+ km
      expect(distance).toBeLessThan(350);
    });

    it('should return 0 for same point', () => {
      const point = { lat: 40.7128, lng: -74.0060 };

      const distance = calculateDistance(point, point);
      
      expect(distance).toBe(0);
    });
  });

  describe('calculateTotalDistance', () => {
    it('should calculate total distance for multiple points', () => {
      const points = [
        { lat: 40.7128, lng: -74.0060 }, // NYC
        { lat: 41.3082, lng: -72.9251 }, // New Haven
        { lat: 42.3601, lng: -71.0589 }  // Boston
      ];

      const totalDistance = calculateTotalDistance(points);
      
      expect(totalDistance).toBeGreaterThan(300);
      expect(totalDistance).toBeLessThan(400);
    });

    it('should return 0 for single point', () => {
      const points = [{ lat: 40.7128, lng: -74.0060 }];

      const totalDistance = calculateTotalDistance(points);
      
      expect(totalDistance).toBe(0);
    });
  });

  describe('optimization efficiency', () => {
    it('should produce shorter route than unoptimized order', () => {
      const source = { lat: 40.7128, lng: -74.0060, address: 'Start' };
      const destination = { lat: 42.3601, lng: -71.0589, address: 'End' };
      
      // Waypoints in inefficient order
      const waypoints = [
        { lat: 42.0000, lng: -71.5000, address: 'Far' },
        { lat: 40.8000, lng: -73.9000, address: 'Near' }
      ];

      const optimized = optimizeRoute(source, destination, waypoints);
      
      // Calculate unoptimized distance (using original order)
      const unoptimizedPoints = [source, ...waypoints, destination];
      const unoptimizedDistance = calculateTotalDistance(unoptimizedPoints);
      
      // Optimized should be better or equal
      expect(optimized.totalDistance).toBeLessThanOrEqual(unoptimizedDistance);
    });
  });
});
