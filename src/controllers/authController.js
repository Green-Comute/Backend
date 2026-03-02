import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import isStrongPassword from "../utils/passwordValidator.js";
import { generateToken } from "../services/token.service.js";
import { sendEmail } from "../services/email.service.js";
import { generateOTP, verifyOTP } from "../utils/otp.utils.js";

/**
 * @fileoverview Authentication Controller
 * @description Handles all authentication-related operations including user registration,
 * login, password management. Implements secure authentication flows with JWT tokens.
 * @module controllers/authController
 */

/**
 * Send Email OTP
 *
 * @description Sends a 6-digit OTP to the user's email after validating org code
 * and checking email domain against org's allowedDomains (if configured).
 *
 * @route POST /auth/send-otp
 * @access Public
 */
export const sendOtp = async (req, res) => {
  try {
    const { email, orgCode } = req.body;

    if (!email || !orgCode) {
      return res.status(400).json({ message: "Email and orgCode are required" });
    }

    // 1️⃣ Validate organization
    const organization = await Organization.findOne({
      orgCode: orgCode.toUpperCase(),
      isActive: true,
    });

    if (!organization) {
      return res.status(400).json({ message: "Invalid or inactive organization code" });
    }

    // 2️⃣ Domain check (if org has allowedDomains configured)
    if (organization.allowedDomains && organization.allowedDomains.length > 0) {
      const emailDomain = email.split("@")[1]?.toLowerCase();
      if (!emailDomain || !organization.allowedDomains.includes(emailDomain)) {
        return res.status(400).json({
          message: `Your email domain is not authorized for ${organization.name}. Allowed: ${organization.allowedDomains.join(", ")}`,
        });
      }
    }

    // 3️⃣ Generate and send OTP
    const code = generateOTP(email);

    await sendEmail({
      to: email,
      subject: "Your GreenCommute verification code",
      html: `
        <p>Hello,</p>
        <p>Your verification code for GreenCommute signup is:</p>
        <h1 style="letter-spacing:6px;font-size:36px;text-align:center;
                    color:#059669;font-family:monospace;">${code}</h1>
        <p>This code expires in 5 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });

    return res.json({ message: "Verification code sent to your email" });
  } catch (err) {
    console.error("sendOtp error:", err);
    return res.status(500).json({ message: "Failed to send verification code" });
  }
};

/**
 * Register Employee User
 *
 * @description Creates a new employee account. Requires a verified email OTP.
 * If the email domain matches the org's allowedDomains, the user is auto-approved.
 * Otherwise, the user is set to PENDING for Org Admin manual approval.
 *
 * @route POST /auth/register
 * @access Public
 */
export const registerEmployee = async (req, res) => {
  try {
    const { email, phone, password, orgCode, otp } = req.body;

    // 1️⃣ Basic validation
    if (!email || !phone || !password || !orgCode || !otp) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2️⃣ Verify OTP
    if (!verifyOTP(email, otp)) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    // 3️⃣ Password strength
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
      });
    }

    // 4️⃣ Validate organization
    const organization = await Organization.findOne({
      orgCode: orgCode.toUpperCase(),
      isActive: true,
    });

    if (!organization) {
      return res.status(400).json({ message: "Invalid or inactive organization code" });
    }

    // 5️⃣ Domain check — determines auto-approve vs manual
    const emailDomain = email.split("@")[1]?.toLowerCase();
    const domainMatched =
      organization.allowedDomains &&
      organization.allowedDomains.length > 0 &&
      organization.allowedDomains.includes(emailDomain);

    // 6️⃣ Existing user check
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User with this email or phone already exists",
      });
    }

    // 7️⃣ Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 8️⃣ Create employee (auto-approve if domain matched)
    await User.create({
      email,
      phone,
      passwordHash,
      organizationId: organization._id,
      role: "EMPLOYEE",
      approvalStatus: domainMatched ? "APPROVED" : "PENDING",
      isEmailVerified: true, // OTP just proved ownership
      isPhoneVerified: false,
      profileCompleted: false,
    });

    const message = domainMatched
      ? "Registration successful! You can now log in."
      : "Registration successful. Awaiting organization admin approval.";

    return res.status(201).json({ message, autoApproved: domainMatched });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Authenticate User Login
 * 
 * @description Authenticates user credentials and returns JWT token for authorized access.
 * Implements approval gate - only APPROVED users can successfully login.
 * 
 * @route POST /api/auth/login
 * @access Public
 * 
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email address
 * @param {string} req.body.password - User password
 * 
 * @returns {Object} 200 - Login successful with token and user data
 * @returns {Object} 400 - Missing email or password
 * @returns {Object} 401 - Invalid credentials (wrong email or password)
 * @returns {Object} 403 - Account not approved by organization admin
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/auth/login
 * {
 *   "email": "employee@company.com",
 *   "password": "SecurePass123!"
 * }
 * 
 * // Success Response
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "user": {
 *     "id": "507f1f77bcf86cd799439011",
 *     "email": "employee@company.com",
 *     "role": "EMPLOYEE",
 *     "approvalStatus": "APPROVED",
 *     "profileCompleted": true,
 *     "isDriver": false
 *   }
 * }
 * 
 * @businessLogic
 * - Validates email and password are provided
 * - Retrieves user by email
 * - Verifies password using bcrypt comparison
 * - Checks approval status - only APPROVED users can login
 * - Generates JWT token with user context (userId, role, organizationId, isDriver)
 * - Returns sanitized user data (excludes password hash)
 * - Token must be included in Authorization header for protected routes
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ⛔ Approval gate
    if (user.approvalStatus !== "APPROVED") {
      return res.status(403).json({
        message:
          "Your account is awaiting organization admin approval. Please contact your administrator.",
        approvalStatus: user.approvalStatus,
      });
    }

    // ✅ Generate token
    const token = generateToken({
      userId: user._id,
      role: user.role,
      organizationId: user.organizationId || null,
      isDriver: user.isDriver || false,
    });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
        profileCompleted: user.profileCompleted,
        isDriver: user.isDriver || false,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

/**
 * Initiate Password Reset
 * 
 * @description Generates a secure password reset token and sends reset link via email.
 * Implements security best practice of not revealing whether email exists in system.
 * 
 * @route POST /api/auth/forgot-password
 * @access Public
 * 
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email address
 * 
 * @returns {Object} 200 - Generic success message (doesn't reveal if email exists)
 * @returns {Object} 400 - Email not provided
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/auth/forgot-password
 * {
 *   "email": "employee@company.com"
 * }
 * 
 * // Response (same whether email exists or not)
 * {
 *   "message": "If this email exists, a password reset link has been generated."
 * }
 * 
 * @businessLogic
 * - Validates email is provided
 * - Searches for user by email
 * - Generates cryptographically secure random token (32 bytes)
 * - Hashes token with SHA-256 before storing (prevents token theft from DB)
 * - Sets token expiration to 15 minutes
 * - Constructs reset link with original (unhashed) token
 * - Sends email with clickable reset link styled with button
 * - Returns generic message regardless of whether email exists (security)
 * - Email includes 15-minute expiration notice
 * - Requires FRONTEND_URL environment variable for reset link
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    // ⚠️ Do not reveal user existence
    if (!user) {
      return res.json({
        message:
          "If this email exists, a password reset link has been generated.",
      });
    }

    // 1️⃣ Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 2️⃣ Hash before storing
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    // 3️⃣ Build reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // 4️⃣ Send email
    await sendEmail({
      to: user.email,
      subject: "Reset your GreenCommute password",
      html: `
        <p>Hello,</p>
        <p>You requested a password reset for your GreenCommute account.</p>
        <p>
          <a href="${resetLink}" style="
            padding:10px 16px;
            background:#059669;
            color:#ffffff;
            border-radius:6px;
            text-decoration:none;
            display:inline-block;
          ">
            Reset Password
          </a>
        </p>
        <p>This link expires in 15 minutes.</p>
        <p>If you didn’t request this, you can safely ignore this email.</p>
      `,
    });

    return res.json({
      message:
        "If this email exists, a password reset link has been generated.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Failed to process request" });
  }
};

/**
 * Reset User Password
 * 
 * @description Validates reset token and updates user password. Token must be valid
 * and not expired (within 15 minutes of generation).
 * 
 * @route POST /api/auth/reset-password/:token
 * @access Public
 * 
 * @param {string} req.params.token - Password reset token from email link
 * @param {Object} req.body - Request body
 * @param {string} req.body.password - New password (must meet strength requirements)
 * 
 * @returns {Object} 200 - Password reset successful
 * @returns {Object} 400 - Missing password, weak password, or invalid/expired token
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request
 * POST /api/auth/reset-password/abc123def456...
 * {
 *   "password": "NewSecurePass123!"
 * }
 * 
 * // Success Response
 * {
 *   "message": "Password reset successful"
 * }
 * 
 * @businessLogic
 * - Validates new password is provided
 * - Enforces strong password policy (same as registration)
 * - Hashes incoming token to match stored hashed version
 * - Finds user with matching token and checks expiration
 * - Rejects if token expired or doesn't exist (15-minute window)
 * - Hashes new password with bcrypt (12 rounds)
 * - Clears reset token and expiration from database
 * - User can immediately login with new password
 * - Single-use tokens (cleared after successful reset)
 */
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Password reset failed" });
  }
};
