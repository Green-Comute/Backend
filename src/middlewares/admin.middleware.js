/**
 * @fileoverview Admin Authorization Middleware
 * @description Validates that authenticated user has admin privileges (ORG_ADMIN or
 * PLATFORM_ADMIN) before allowing access to admin endpoints.
 * @module middlewares/admin.middleware
 */

/**
 * Require Admin Middleware
 * 
 * @description Verifies that the authenticated user has admin role (ORG_ADMIN or
 * PLATFORM_ADMIN). Must be used after authentication middleware.
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
 * router.get('/admin/stats', requireAuth, requireAdmin, getStats);
 * 
 * @returns {void} Calls next() if user is admin
 * @returns {Object} 401 - Authentication error
 * @returns {Object} 403 - User is not an admin
 * 
 * @security
 * - Accepts both ORG_ADMIN and PLATFORM_ADMIN roles
 * - ORG_ADMIN: manages employees and drivers within organization
 * - PLATFORM_ADMIN: super admin with platform-wide access
 * - Protects admin-only operations:
 *   - Approve/reject employees
 *   - Approve/reject drivers
 *   - View organization reports
 *   - Create organizations (PLATFORM_ADMIN only)
 */
const requireAdmin = (req, res, next) => {
    try {
      const { role } = req.user;
  
      if (role !== "ORG_ADMIN" && role !== "PLATFORM_ADMIN") {
        return res.status(403).json({
          message: "Admin access required",
        });
      }
  
      next();
    } catch {
      return res.status(401).json({
        message: "Authentication error"
      });
    }
  };
  
  export default requireAdmin;
  