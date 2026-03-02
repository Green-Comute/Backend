/**
 * @fileoverview Epic-2 Compatible Authentication Middleware
 * @description Alternative authentication middleware compatible with Epic-2 routes.
 * Provides same functionality as auth.middleware.js with different naming convention.
 * @module middlewares/authMiddleware
 */

import jwt from "jsonwebtoken";

/**
 * Protect Middleware (Epic-2 Compatible)
 * 
 * @description JWT authentication middleware for Epic-2 routes. Validates token and
 * attaches decoded payload to req.user.
 * 
 * @middleware
 * @param {Object} req - Express request object
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers.authorization - Bearer token (format: "Bearer <token>")
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @sets req.user - Decoded JWT payload
 * 
 * @returns {void} Calls next() on success
 * @returns {Object} 401 - Authentication failed
 * 
 * @note This is an alias middleware for compatibility with Epic-2 naming conventions
 * @see auth.middleware.js - Primary authentication middleware
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "No token provided. Authorization denied." 
      });
    }

    const token = authHeader.split(" ")[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded JWT payload to request (contains userId, role, isDriver, etc.)
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ 
      success: false,
      message: "Invalid or expired token" 
    });
  }
};

export default protect;
