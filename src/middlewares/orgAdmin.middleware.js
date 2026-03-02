/**
 * @fileoverview Organization Admin Authorization Middleware
 * @description Validates that authenticated user has ORG_ADMIN role before allowing
 * access to organization admin endpoints.
 * @module middlewares/orgAdmin.middleware
 */

/**
 * Require Organization Admin Middleware
 * 
 * @description Verifies that the authenticated user has ORG_ADMIN role.
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
 * router.get('/pending-users', requireAuth, requireOrgAdmin, listPendingEmployees);
 * 
 * @returns {void} Calls next() if user is ORG_ADMIN
 * @returns {Object} 401 - User not authenticated
 * @returns {Object} 403 - User is not ORG_ADMIN
 * 
 * @security
 * - Only accepts ORG_ADMIN role (not PLATFORM_ADMIN or EMPLOYEE)
 * - ORG_ADMIN manages employees within their organization
 * - Protects operations:
 *   - Approve/reject employee registrations
 *   - Approve/reject driver applications
 *   - View pending users in organization
 * - Organization boundary enforced at controller level via organizationId
 */
const requireOrgAdmin = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  
    if (req.user.role !== "ORG_ADMIN") {
      return res.status(403).json({
        message: "Org admin access required",
      });
    }
  
    next();
  };
  
  export default requireOrgAdmin;