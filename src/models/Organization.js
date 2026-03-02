import mongoose from "mongoose";

/**
 * @fileoverview Organization Model
 * @description Defines the Organization schema for multi-tenant organization management.
 * Organizations group employees and provide isolation boundaries.
 * @module models/Organization
 */

/**
 * Organization Schema
 * 
 * @description Represents a company or organization using the platform. Employees
 * belong to organizations and are managed by organization admins.
 * 
 * @schema
 * 
 * @property {string} name - Organization name
 * @property {string} orgCode - Unique organization code (uppercase, indexed)
 * @property {ObjectId[]} admins - Array of User ObjectIds with ORG_ADMIN role
 * @property {boolean} isActive - Organization active status (default: true)
 * @property {Date} createdAt - Auto-generated creation timestamp
 * @property {Date} updatedAt - Auto-generated update timestamp
 * 
 * @indexes
 * - orgCode: Unique index for fast lookup during employee registration
 * 
 * @usage
 * - Employees provide orgCode during registration
 * - System validates orgCode exists and isActive = true
 * - Employee assigned to organizationId
 * - Organization admins manage employees within their organization
 * - Cross-organization access prevented at controller level
 * 
 * @multiTenancy
 * - Each organization is isolated
 * - Admins can only manage users within their organization
 * - Organization code is public (used for signup)
 * - Organization data is private (only admins access)
 * 
 * @example
 * {
 *   "name": "Acme Corporation",
 *   "orgCode": "ACME2024",
 *   "admins": ["507f1f77bcf86cd799439011"],
 *   "isActive": true,
 *   "createdAt": "2026-02-12T10:30:00.000Z"
 * }
 */
const organizationSchema = new mongoose.Schema(
  {
    // --------------------
    // Core Identity
    // --------------------
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Used ONLY during employee signup
    orgCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },

    // Email domains allowed for self-service signup (e.g. ["tcs.com", "amrita.edu"])
    // If empty → any email allowed but requires Org Admin manual approval
    allowedDomains: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],

    // Org admins are Users with role = ORG_ADMIN
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Used to disable org-wide access
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

export default mongoose.model("Organization", organizationSchema);