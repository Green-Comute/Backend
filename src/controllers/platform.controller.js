import Organization from "../models/Organization.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

/**
 * @fileoverview Platform Administration Controller
 * @description Handles platform-level administrative operations including organization
 * creation and organization admin user creation. These are super-admin level operations.
 * @module controllers/platform.controller
 */

/**
 * Create Organization
 * 
 * @description Platform admin creates a new organization entity. Organizations group
 * employees and provide isolation boundaries for multi-tenancy.
 * 
 * @route POST /api/platform/organizations
 * @access Private (Platform Admin only)
 * 
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Organization name
 * @param {string} req.body.orgCode - Unique organization code (converted to uppercase)
 * 
 * @returns {Object} 201 - Organization created successfully
 * @returns {Object} 400 - Missing required fields
 * @returns {Object} 409 - Organization code already exists
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/platform/organizations
 * Authorization: Bearer <platform_admin_token>
 * {
 *   "name": "Acme Corporation",
 *   "orgCode": "ACME2024"
 * }
 * 
 * // Response
 * {
 *   "_id": "507f1f77bcf86cd799439011",
 *   "name": "Acme Corporation",
 *   "orgCode": "ACME2024",
 *   "admins": [],
 *   "isActive": true,
 *   "createdAt": "2026-02-12T10:30:00.000Z"
 * }
 * 
 * @businessLogic
 * - Validates name and orgCode are provided
 * - Converts orgCode to uppercase for consistency
 * - Checks for duplicate orgCode (must be unique)
 * - Creates organization with default isActive=true
 * - Initializes empty admins array
 * - Employees use orgCode during registration
 * - Organization admin must be created separately via createOrgAdmin
 * 
 * @security
 * - Platform-level operation (restricted to super admins)
 * - Organization codes are unique global identifiers
 */
export const createOrganization = async (req, res) => {
  try {
    const { name, orgCode, allowedDomains } = req.body;

    if (!name || !orgCode) {
      return res.status(400).json({ message: "Name and orgCode required" });
    }

    const exists = await Organization.findOne({ orgCode: orgCode.toUpperCase() });
    if (exists) {
      return res.status(409).json({ message: "Org code already exists" });
    }

    // Parse allowedDomains: accepts comma-separated string or array
    let domains = [];
    if (allowedDomains) {
      domains = Array.isArray(allowedDomains)
        ? allowedDomains
        : allowedDomains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    }

    const org = await Organization.create({
      name,
      orgCode: orgCode.toUpperCase(),
      allowedDomains: domains,
      admins: [],
      isActive: true,
    });

    res.status(201).json(org);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create organization" });
  }
};

/**
 * List All Organizations
 *
 * @route GET /platform/organizations
 * @access Private (Platform Admin only)
 */
export const listOrganizations = async (req, res) => {
  try {
    const orgs = await Organization.find()
      .select("_id name orgCode allowedDomains isActive createdAt")
      .sort({ createdAt: -1 });

    res.json({ organizations: orgs });
  } catch (err) {
    console.error("listOrganizations error:", err);
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
};

/**
 * Create Organization Admin
 * 
 * @description Platform admin creates an organization admin user who can manage employees
 * within their organization. ORG_ADMIN has elevated privileges for employee approval.
 * 
 * @route POST /api/platform/org-admins
 * @access Private (Platform Admin only)
 * 
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Admin email address (must be unique)
 * @param {string} req.body.phone - Admin phone number (must be unique)
 * @param {string} req.body.password - Admin account password
 * @param {string} req.body.orgCode - Organization code to associate admin with
 * 
 * @returns {Object} 201 - Organization admin created successfully
 * @returns {Object} 400 - Missing required fields
 * @returns {Object} 404 - Organization not found
 * @returns {Object} 409 - User already exists with email or phone
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/platform/org-admins
 * Authorization: Bearer <platform_admin_token>
 * {
 *   "email": "admin@acme.com",
 *   "phone": "+1234567890",
 *   "password": "SecureAdminPass123!",
 *   "orgCode": "ACME2024"
 * }
 * 
 * // Response
 * {
 *   "message": "Organization admin created",
 *   "orgAdminId": "507f1f77bcf86cd799439011"
 * }
 * 
 * @businessLogic
 * - Validates all required fields are provided
 * - Converts orgCode to uppercase and finds matching organization
 * - Returns 404 if organization doesn't exist
 * - Prevents duplicate email or phone (checks across all users)
 * - Hashes password with bcrypt (12 rounds)
 * - Creates user with role=ORG_ADMIN
 * - Sets organizationId to link admin to organization
 * - Auto-approves admin (approvalStatus=APPROVED)
 * - Marks email and phone as verified
 * - Sets profileCompleted=true (no profile completion needed)
 * - Adds admin's userId to organization.admins array
 * - Admin can immediately login and manage employees
 * 
 * @security
 * - Platform-level operation (restricted to super admins)
 * - Admin accounts are pre-verified and approved
 * - No employee approval workflow for admins
 * 
 * @note Organization admin can:
 * - Approve/reject employee registrations
 * - Approve/reject driver document uploads
 * - View organization-specific reports (future)
 */
export const createOrgAdmin = async (req, res) => {
  try {
    const { email, phone, password, orgCode } = req.body;

    if (!email || !phone || !password || !orgCode) {
      return res.status(400).json({ message: "All fields required" });
    }

    // 🔑 Convert orgCode → Organization
    const org = await Organization.findOne({ orgCode: orgCode.toUpperCase() });
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const orgAdmin = await User.create({
      email,
      phone,
      passwordHash,
      role: "ORG_ADMIN",
      organizationId: org._id, // 👈 INTERNAL USE ONLY
      approvalStatus: "APPROVED",
      isEmailVerified: true,
      isPhoneVerified: true,
      profileCompleted: true,
    });

    org.admins.push(orgAdmin._id);
    await org.save();

    res.status(201).json({
      message: "Organization admin created",
      orgAdminId: orgAdmin._id,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create org admin" });
  }
};