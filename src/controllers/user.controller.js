import User from "../models/User.js";

/**
 * @fileoverview User Profile Management Controller
 * @description Handles user profile operations including profile retrieval, profile completion,
 * and driver access requests. All endpoints require authentication.
 * @module controllers/user.controller
 */

/**
 * Get Current User Profile
 * 
 * @description Retrieves the authenticated user's complete profile information.
 * Sensitive data (password hash, tokens) are excluded from response.
 * 
 * @route GET /api/users/me
 * @access Private (Authenticated users)
 * 
 * @param {Object} req.user - Decoded JWT payload with userId
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated user
 * 
 * @returns {Object} 200 - User profile data
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * GET /api/users/me
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "user": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "email": "employee@company.com",
 *     "phone": "+1234567890",
 *     "name": "John Doe",
 *     "role": "EMPLOYEE",
 *     "approvalStatus": "APPROVED",
 *     "profileCompleted": true,
 *     "isDriver": false,
 *     "driverStatus": null,
 *     "organizationId": "507f1f77bcf86cd799439012"
 *   }
 * }
 * 
 * @businessLogic
 * - Requires valid JWT token in Authorization header
 * - Excludes sensitive fields: passwordHash, passwordResetToken, passwordResetExpires
 * - Returns full profile including driver status if applicable
 * - Used by frontend to display user dashboard and profile
 */
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "-passwordHash -passwordResetToken -passwordResetExpires"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

/**
 * Complete User Profile (First-Time Setup)
 * 
 * @description Allows newly registered users to complete their profile with mandatory
 * personal and address information. Can only be done once - subsequent attempts rejected.
 * 
 * @route POST /api/users/complete-profile
 * @access Private (Authenticated users with incomplete profiles)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated user
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Full name of the user
 * @param {string} req.body.dob - Date of birth (ISO format)
 * @param {string} req.body.gender - Gender (e.g., Male, Female, Other)
 * @param {string} req.body.homeAddress - Home address
 * @param {string} req.body.workAddress - Work/office address
 * @param {string} [req.body.emergencyContactName] - Emergency contact name (optional)
 * @param {string} [req.body.emergencyContactPhone] - Emergency contact phone (optional)
 * 
 * @returns {Object} 200 - Profile completed successfully
 * @returns {Object} 400 - Missing required fields or profile already completed
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/users/complete-profile
 * Authorization: Bearer <jwt_token>
 * {
 *   "name": "John Doe",
 *   "dob": "1990-05-15",
 *   "gender": "Male",
 *   "homeAddress": "123 Main St, City, State 12345",
 *   "workAddress": "456 Office Blvd, City, State 12345",
 *   "emergencyContactName": "Jane Doe",
 *   "emergencyContactPhone": "+1234567890"
 * }
 * 
 * // Response
 * {
 *   "message": "Profile completed successfully"
 * }
 * 
 * @businessLogic
 * - One-time operation: rejects if profileCompleted is already true
 * - Validates all required fields are provided
 * - Emergency contact information is optional but stored if provided
 * - Sets profileCompleted flag to true upon success
 * - Required before user can access most platform features
 * - Home and work addresses used for ride matching and route optimization
 */
export const completeProfile = async (req, res) => {
  try {
    const {
      name,
      dob,
      gender,
      homeAddress,
      workAddress,
      emergencyContactName,
      emergencyContactPhone,
    } = req.body;

    // Required fields (emergency contact optional)
    if (!name || !dob || !gender || !homeAddress || !workAddress) {
      return res.status(400).json({
        message: "Please fill all required profile fields",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.profileCompleted) {
      return res.status(400).json({
        message: "Profile already completed",
      });
    }

    user.name = name;
    user.dob = dob;
    user.gender = gender;
    user.homeAddress = homeAddress;
    user.workAddress = workAddress;

    // Emergency contact (optional)
    if (emergencyContactName || emergencyContactPhone) {
      user.emergencyContact = {
        name: emergencyContactName || "",
        phone: emergencyContactPhone || "",
      };
    }

    user.profileCompleted = true;
    await user.save();

    res.json({
      message: "Profile completed successfully",
    });
  } catch (err) {
    console.error("Complete profile error:", err);
    res.status(500).json({ message: "Profile completion failed" });
  }
};

/**
 * Request Driver Access
 * 
 * @description Allows employees to opt-in as drivers. Sets driver status to PENDING
 * awaiting document upload and admin approval. Requires completed profile.
 * 
 * @route POST /api/users/driver-intent
 * @access Private (Authenticated employees with completed profiles)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated user
 * 
 * @returns {Object} 200 - Driver request submitted successfully
 * @returns {Object} 400 - Profile not completed or request already exists
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/users/driver-intent
 * Authorization: Bearer <jwt_token>
 * 
 * // Response
 * {
 *   "message": "Driver request submitted",
 *   "driverStatus": "PENDING"
 * }
 * 
 * @businessLogic
 * - User must have completed profile first (profileCompleted = true)
 * - Prevents duplicate requests (checks existing PENDING status or isDriver = true)
 * - Sets driverStatus to PENDING (not yet a driver)
 * - Sets documentsUploaded to false (awaiting document upload)
 * - Does NOT set isDriver to true until admin approves
 * - Next step: user must upload driver documents (license, RC)
 * - After document upload: org admin reviews and approves/rejects
 * - Only approved drivers can create trips
 * 
 * @workflow
 * 1. User requests driver access (this endpoint)
 * 2. User uploads documents via /api/driver/upload-documents
 * 3. Org admin reviews via /api/org-admin/driver-requests
 * 4. Org admin approves/rejects via /api/org-admin/driver-requests/:id/approve
 * 5. If approved, isDriver set to true and user can create trips
 */
export const requestDriverAccess = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profileCompleted) {
      return res.status(400).json({
        message: "Complete profile before requesting driver access",
      });
    }

    if (user.isDriver || user.driverStatus === "PENDING") {
      return res.status(400).json({
        message: "Driver request already submitted",
      });
    }

    // Don't set isDriver true until admin approves
    user.driverStatus = "PENDING";
    user.documentsUploaded = false;

    await user.save();

    res.json({
      message: "Driver request submitted",
      driverStatus: user.driverStatus,
    });
  } catch (err) {
    console.error("Driver request error:", err);
    res.status(500).json({ message: "Failed to request driver access" });
  }
};
