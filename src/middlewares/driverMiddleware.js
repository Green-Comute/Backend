/**
 * @fileoverview Driver Authorization Middleware
 * @description Validates that authenticated user has driver privileges before allowing
 * access to driver-specific endpoints.
 * @module middlewares/driverMiddleware
 */

/**
 * Require Driver Middleware
 * 
 * @description Verifies that the authenticated user has driver privileges (isDriver=true).
 * Must be used after authentication middleware (protect or requireAuth).
 * 
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.user - Decoded JWT payload (set by auth middleware)
 * @param {boolean} req.user.isDriver - Driver privilege flag
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @example
 * // Usage in route (chain after auth middleware)
 * router.post('/trips', protect, requireDriver, createTrip);
 * 
 * @chain
 * 1. protect/requireAuth middleware - validates JWT and sets req.user
 * 2. requireDriver middleware - validates isDriver flag
 * 3. Controller - handles business logic
 * 
 * @returns {void} Calls next() if user is driver
 * @returns {Object} 401 - User not authenticated (req.user missing)
 * @returns {Object} 403 - User is not a driver
 * @returns {Object} 500 - Server error
 * 
 * @security
 * - Requires prior authentication (req.user must exist)
 * - Checks isDriver flag from JWT payload
 * - isDriver set to true only after ORG_ADMIN approval
 * - Protects driver-only operations:
 *   - Create trips
 *   - Approve/reject ride requests
 *   - Mark pickup/dropoff status
 *   - Update location during trip
 */
const requireDriver = (req, res, next) => {
  try {
    // Check if user is authenticated (should be set by protect middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Check if user has driver privileges
    if (!req.user.isDriver) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Driver privileges required."
      });
    }

    next();
  } catch (error) {
    console.error("Driver middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in driver middleware"
    });
  }
};

export default requireDriver;
