import jwt from "jsonwebtoken";

/**
 * @fileoverview JWT Token Service
 * @description Provides JWT token generation for user authentication and authorization.
 * Tokens include user context (userId, role, organizationId, isDriver) for stateless auth.
 * @module services/token.service
 */

/**
 * Generate JWT Token
 * 
 * @description Creates a signed JWT token containing user authentication context.
 * Used for stateless authentication - token includes all necessary user information.
 * 
 * @param {Object} payload - Token payload data
 * @param {string} payload.userId - MongoDB ObjectId of user
 * @param {string} payload.role - User role (EMPLOYEE, ORG_ADMIN, PLATFORM_ADMIN)
 * @param {string} [payload.organizationId] - MongoDB ObjectId of user's organization
 * @param {boolean} [payload.isDriver] - Whether user has driver privileges
 * 
 * @returns {string} Signed JWT token string
 * 
 * @example
 * const token = generateToken({
 *   userId: '507f1f77bcf86cd799439011',
 *   role: 'EMPLOYEE',
 *   organizationId: '507f1f77bcf86cd799439012',
 *   isDriver: true
 * });
 * 
 * @security
 * - Tokens signed with JWT_SECRET from environment variables
 * - Expires in 1 day (86400 seconds)
 * - Contains minimal necessary information
 * - Validated by auth middleware on protected routes
 * - Token payload is base64 encoded but NOT encrypted (don't include sensitive data)
 * 
 * @requires JWT_SECRET environment variable
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};