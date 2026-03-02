import User from "../models/User.js";

/**
 * @fileoverview Driver Approval Management Controller
 * @description Handles organization admin operations for reviewing and approving driver
 * applications. Admins review uploaded documents and grant/deny driver privileges.
 * @module controllers/adminDriver.controller
 */

/**
 * Get Driver Requests
 * 
 * @description Retrieves all pending driver applications with uploaded documents for
 * organization admin review. Only employees from admin's organization are returned.
 * 
 * @route GET /api/org-admin/driver-requests
 * @access Private (ORG_ADMIN only)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.role - Must be ORG_ADMIN
 * @param {string} req.user.organizationId - MongoDB ObjectId of admin's organization
 * 
 * @returns {Object} 200 - List of pending driver requests
 * @returns {Object} 403 - Access denied (not ORG_ADMIN)
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * GET /api/org-admin/driver-requests
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "drivers": [
 *     {
 *       "_id": "507f1f77bcf86cd799439011",
 *       "name": "John Doe",
 *       "email": "john@company.com",
 *       "phone": "+1234567890",
 *       "createdAt": "2026-02-12T10:30:00.000Z",
 *       "driverDocuments": {
 *         "license": "uploads/driver-docs/license-123.pdf",
 *         "rc": "uploads/driver-docs/rc-123.pdf"
 *       }
 *     },
 *     ...
 *   ]
 * }
 * 
 * @businessLogic
 * - Only ORG_ADMIN role can access
 * - Returns employees from same organization only
 * - Filters: role=EMPLOYEE, documentsUploaded=true, driverStatus=PENDING
 * - Shows name, email, phone, creation date, and document paths
 * - Admin reviews documents and approves/rejects via separate endpoints
 * - Document paths point to uploaded files for admin review
 * 
 * @security
 * - Organization boundary enforced by organizationId match
 * - Only pending requests shown (not approved/rejected)
 * 
 * @workflow
 * 1. Employee requests driver access via /api/users/driver-intent
 * 2. Employee uploads documents via /api/driver/upload-documents
 * 3. Admin views requests via this endpoint
 * 4. Admin reviews document files
 * 5. Admin approves via /api/org-admin/driver-requests/:id/approve
 * 6. Or admin rejects via /api/org-admin/driver-requests/:id/reject
 */
export const getDriverRequests = async (req, res) => {
  try {
    if (req.user.role !== "ORG_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const drivers = await User.find({
      role: "EMPLOYEE",
      documentsUploaded: true,
      driverStatus: "PENDING",
      organizationId: req.user.organizationId,
    }).select("name email phone createdAt driverDocuments");

    res.json({ drivers });
  } catch (err) {
    console.error("Fetch driver requests error:", err);
    res.status(500).json({ message: "Failed to fetch driver requests" });
  }
};

/**
 * Approve Driver Request
 * 
 * @description Organization admin approves driver application, granting driver privileges.
 * Sets isDriver=true enabling the employee to create and manage trips.
 * 
 * @route POST /api/org-admin/driver-requests/:id/approve
 * @access Private (ORG_ADMIN only)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.role - Must be ORG_ADMIN
 * @param {string} req.params.id - MongoDB ObjectId of user to approve as driver
 * 
 * @returns {Object} 200 - Driver approved successfully
 * @returns {Object} 403 - Access denied (not ORG_ADMIN)
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/org-admin/driver-requests/507f1f77bcf86cd799439011/approve
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "message": "Driver approved successfully"
 * }
 * 
 * @businessLogic
 * - Only ORG_ADMIN role can approve drivers
 * - Finds user by ID
 * - Sets driverStatus to APPROVED
 * - Sets isDriver to true (critical: enables driver features)
 * - User can now create trips via /api/trips
 * - User's JWT isDriver flag updated on next login
 * - Consider sending email notification (future enhancement)
 * 
 * @security
 * - Requires ORG_ADMIN role validation by middleware
 * - Admin should verify documents before approval
 * - Consider adding cross-organization check (future enhancement)
 * 
 * @critical Setting isDriver=true grants significant platform privileges:
 * - Create trips
 * - Approve/reject ride requests
 * - Mark passengers as picked up/dropped off
 * - Access driver dashboard and analytics
 */
export const approveDriver = async (req, res) => {
  try {
    if (req.user.role !== "ORG_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const driver = await User.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: "User not found" });
    }

    driver.driverStatus = "APPROVED";
    driver.isDriver = true; // Set isDriver to true on approval
    await driver.save();

    res.json({ message: "Driver approved successfully" });
  } catch (err) {
    console.error("Approve driver error:", err);
    res.status(500).json({ message: "Approval failed" });
  }
};

/**
 * Reject Driver Request
 * 
 * @description Organization admin rejects driver application with optional reason.
 * Denies driver privileges and records rejection reason for user reference.
 * 
 * @route POST /api/org-admin/driver-requests/:id/reject
 * @access Private (ORG_ADMIN only)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.role - Must be ORG_ADMIN
 * @param {string} req.params.id - MongoDB ObjectId of user to reject
 * @param {Object} req.body - Request body
 * @param {string} [req.body.reason] - Optional rejection reason
 * 
 * @returns {Object} 200 - Driver rejected successfully
 * @returns {Object} 403 - Access denied (not ORG_ADMIN)
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/org-admin/driver-requests/507f1f77bcf86cd799439011/reject
 * Authorization: Bearer <jwt_token>
 * {
 *   "reason": "License document is unclear, please re-upload"
 * }
 * 
 * // Response
 * {
 *   "message": "Driver rejected"
 * }
 * 
 * @businessLogic
 * - Only ORG_ADMIN role can reject drivers
 * - Finds user by ID
 * - Sets driverStatus to REJECTED
 * - Stores rejection reason (defaults to "Not specified" if not provided)
 * - Sets isDriver to false (ensures no driver privileges)
 * - User can see rejection reason and reapply (future enhancement)
 * - Consider sending email notification with rejection reason
 * 
 * @security
 * - Requires ORG_ADMIN role validation by middleware
 * - Consider adding cross-organization check (future enhancement)
 * 
 * @futureEnhancements
 * - Allow user to reapply after rejection
 * - Email notification with rejection reason and reapplication instructions
 * - Track rejection history for audit purposes
 */
export const rejectDriver = async (req, res) => {
  try {
    const { reason } = req.body;

    if (req.user.role !== "ORG_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const driver = await User.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: "User not found" });
    }

    driver.driverStatus = "REJECTED";
    driver.driverRejectionReason = reason || "Not specified";
    driver.isDriver = false;

    await driver.save();

    res.json({ message: "Driver rejected" });
  } catch (err) {
    console.error("Reject driver error:", err);
    res.status(500).json({ message: "Rejection failed" });
  }
};

