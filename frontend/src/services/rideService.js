/**
 * @fileoverview Ride Request Service
 * @description Manages passenger ride requests and driver ride management operations.
 * Handles ride lifecycle: request, approval/rejection, pickup, dropoff.
 * @module services/rideService
 */

import apiRequest from './api';

/**
 * Ride Request Service
 * 
 * @description Provides comprehensive ride management operations for passengers and drivers.
 * All methods use authenticated API requests.
 */
export const rideService = {
  /**
   * Request Ride
   * 
   * @description Passenger requests to join a trip offered by a driver.
   * Creates a new ride request with PENDING status.
   * 
   * @async
   * @param {string} tripId - ID of the trip to request
   * 
   * @returns {Promise<Object>} Created ride request data
   * @returns {string} result._id - Ride request ID
   * @returns {string} result.status - 'PENDING'
   * 
   * @throws {Error} If request fails or trip not found
   * 
   * @example
   * const ride = await rideService.requestRide('64abc123def456789');
   * console.log('Ride request created:', ride._id);
   */
  async requestRide(tripId) {
    return await apiRequest('/rides/request', {
      method: 'POST',
      body: JSON.stringify({ tripId }),
    });
  },

  /**
   * Get Trip Ride Requests (Driver)
   * 
   * @description Retrieves all ride requests for a specific trip.
   * Used by drivers to view pending and approved ride requests.
   * 
   * @async
   * @param {string} tripId - Trip ID
   * 
   * @returns {Promise<Array<Object>>} Array of ride requests
   * 
   * @example
   * const requests = await rideService.getRideRequests('64abc123def456789');
   * const pending = requests.filter(r => r.status === 'PENDING');
   */
  async getRideRequests(tripId) {
    return await apiRequest(`/rides/trip/${tripId}`, {
      method: 'GET',
    });
  },

  /**
   * Approve Ride Request
   * 
   * @description Driver approves a passenger's ride request.
   * Updates ride status to APPROVED and adds passenger to trip.
   * 
   * @async
   * @param {string} rideId - Ride request ID
   * 
   * @returns {Promise<Object>} Updated ride request
   * 
   * @throws {Error} If not authorized or already processed
   * 
   * @example
   * const ride = await rideService.approveRideRequest('64xyz789abc123');
   * console.log('Passenger approved:', ride.passenger);
   */
  async approveRideRequest(rideId) {
    return await apiRequest(`/rides/${rideId}/approve`, {
      method: 'POST',
    });
  },

  /**
   * Reject Ride Request
   * 
   * @description Driver rejects a passenger's ride request.
   * Updates ride status to REJECTED.
   * 
   * @async
   * @param {string} rideId - Ride request ID
   * 
   * @returns {Promise<Object>} Updated ride request
   * 
   * @example
   * await rideService.rejectRideRequest('64xyz789abc123');
   */
  async rejectRideRequest(rideId) {
    return await apiRequest(`/rides/${rideId}/reject`, {
      method: 'POST',
    });
  },

  /**
   * Decide on Ride Request
   * 
   * @description Convenience method to approve or reject a ride request.
   * Calls appropriate method based on decision parameter.
   * 
   * @async
   * @param {string} rideId - Ride request ID
   * @param {string} decision - 'APPROVED' or 'REJECTED'
   * 
   * @returns {Promise<Object>} Updated ride request
   * @throws {Error} If decision is invalid
   * 
   * @example
   * // Approve
   * await rideService.decideRideRequest('64xyz789', 'APPROVED');
   * 
   * // Reject
   * await rideService.decideRideRequest('64xyz789', 'REJECTED');
   */
  async decideRideRequest(rideId, decision) {
    if (decision === 'APPROVED') {
      return await this.approveRideRequest(rideId);
    } else if (decision === 'REJECTED') {
      return await this.rejectRideRequest(rideId);
    } else {
      throw new Error('Invalid decision. Must be APPROVED or REJECTED');
    }
  },

  /**
   * Get Passenger Rides
   * 
   * @description Retrieves all rides for the authenticated passenger.
   * Includes pending, approved, completed, and rejected rides.
   * 
   * @async
   * @returns {Promise<Array<Object>>} Array of passenger's rides
   * 
   * @example
   * const myRides = await rideService.getPassengerRides();
   * const active = myRides.filter(r => r.status === 'APPROVED');
   */
  async getPassengerRides() {
    return await apiRequest('/rides/passenger/rides', {
      method: 'GET',
    });
  },

  /**
   * Get Ride Status
   * 
   * @description Retrieves detailed status of a specific ride.
   * 
   * @async
   * @param {string} rideId - Ride request ID
   * 
   * @returns {Promise<Object>} Ride details with status, passenger, trip info
   * 
   * @example
   * const ride = await rideService.getRideStatus('64xyz789abc123');
   * console.log('Current status:', ride.status);
   * console.log('Pickup status:', ride.pickedUp);
   */
  async getRideStatus(rideId) {
    return await apiRequest(`/rides/${rideId}`, {
      method: 'GET',
    });
  },

  /**
   * Mark Passenger as Picked Up
   * 
   * @description Driver marks that passenger has been picked up.
   * Updates ride's pickedUp flag to true.
   * 
   * @async
   * @param {string} rideId - Ride request ID
   * 
   * @returns {Promise<Object>} Updated ride request
   * 
   * @example
   * await rideService.markAsPickedUp('64xyz789abc123');
   * console.log('Passenger picked up successfully');
   */
  async markAsPickedUp(rideId) {
    return await apiRequest(`/rides/${rideId}/pickup`, {
      method: 'POST',
    });
  },

  /**
   * Mark Passenger as Dropped Off
   * 
   * @description Driver marks that passenger has been dropped off.
   * Updates ride's droppedOff flag to true and potentially completes ride.
   * 
   * @async
   * @param {string} rideId - Ride request ID
   * 
   * @returns {Promise<Object>} Updated ride request
   * 
   * @example
   * await rideService.markAsDroppedOff('64xyz789abc123');
   * console.log('Passenger dropped off successfully');
   */
  async markAsDroppedOff(rideId) {
    return await apiRequest(`/rides/${rideId}/dropoff`, {
      method: 'POST',
    });
  },

  /**
   * Cancel Ride Request (Passenger)
   *
   * @description Passenger cancels their own PENDING or APPROVED ride request.
   * Only allowed before the trip has started. Restores seat if request was APPROVED.
   *
   * @async
   * @param {string} rideId - Ride request ID to cancel
   *
   * @returns {Promise<Object>} Updated ride request
   *
   * @example
   * await rideService.cancelRide('64xyz789abc123');
   * console.log('Ride cancelled successfully');
   */
  async cancelRide(rideId) {
    return await apiRequest(`/rides/${rideId}/cancel`, {
      method: 'POST',
    });
  },
};

