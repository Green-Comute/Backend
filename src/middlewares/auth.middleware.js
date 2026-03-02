import jwt from "jsonwebtoken";

/**
 * @fileoverview Authentication Middleware
 * @description JWT-based authentication middleware that verifies tokens and attaches
 * decoded user context to request object.
 * @module middlewares/auth.middleware
 */

/**
 * Require Authentication Middleware
 * 
 * @description Validates JWT token from Authorization header and attaches decoded
 * user data to req.user for downstream use.
 * 
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers.authorization - Bearer token (format: "Bearer <token>")
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @sets req.user - Decoded JWT payload containing:
 *   - userId: MongoDB ObjectId of authenticated user
 *   - role: User role (EMPLOYEE, ORG_ADMIN, PLATFORM_ADMIN)
 *   - organizationId: Organization ObjectId (if applicable)
 *   - isDriver: Boolean indicating driver privileges
 * 
 * @example
 * // Usage in route
 * router.get('/protected', requireAuth, (req, res) => {
 *   console.log(req.user.userId); // '507f1f77bcf86cd799439011'
 *   console.log(req.user.role);   // 'EMPLOYEE'
 *   console.log(req.user.isDriver); // true
 * });
 * 
 * @security
 * - Requires Authorization header with Bearer scheme
 * - Validates token signature using JWT_SECRET
 * - Checks token expiration (1 day default)
 * - Returns 401 if token missing, invalid, or expired
 * 
 * @returns {void} Calls next() on success
 * @returns {Object} 401 - No token provided or invalid token
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default requireAuth;

// Named export alias so passkey routes can import { verifyToken }
export { requireAuth as verifyToken };
