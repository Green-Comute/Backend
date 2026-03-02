/**
 * @fileoverview Platform Admin Authorization Middleware
 * @description Validates that authenticated user has PLATFORM_ADMIN role before allowing
 * access to platform-level administrative endpoints.
 * @module middlewares/platform.middleware
 */

/**
 * Require Platform Admin Middleware
 * 
 * @description Verifies that the authenticated user has PLATFORM_ADMIN role (super admin).
 * Must be used after authentication middleware.
 * 
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.user - Decoded JWT payload (set by auth middleware)
 * @param {string} req.user.role - User role
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @example
 * // Usage in route
 * router.post('/organizations', requireAuth, requirePlatformAdmin, createOrganization);
 * 
 * @returns {void} Calls next() if user is PLATFORM_ADMIN
 * @returns {Object} 403 - User is not PLATFORM_ADMIN
 * 
 * @security
 * - Highest privilege level in the system
 * - Only accepts PLATFORM_ADMIN role
 * - Protects super admin operations:
 *   - Create organizations
 *   - Create organization admins
 *   - Platform-wide analytics and reports (future)
 *   - System configuration (future)
 * - PLATFORM_ADMIN users created manually or via seed scripts
 */
const requirePlatformAdmin = (req, res, next) => {
    if (req.user.role !== "PLATFORM_ADMIN") {
      return res.status(403).json({ message: "Platform admin access required" });
    }
    next();
  };
  
  export default requirePlatformAdmin;