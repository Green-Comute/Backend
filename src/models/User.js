import mongoose from "mongoose";

/**
 * @fileoverview User Model
 * @description Defines the User schema for employees, organization admins, and platform admins.
 * Includes authentication, profile, driver capabilities, and approval workflow fields.
 * @module models/User
 */

/**
 * User Schema
 * 
 * @description Comprehensive user model supporting multiple roles and workflows:
 * - Employee registration and approval workflow
 * - Driver application and document verification
 * - Organization admin management
 * - Platform admin (super admin) capabilities
 * - Password reset functionality
 * - Profile completion tracking
 * 
 * @schema
 * 
 * @property {string} email - Unique email address (lowercase, indexed)
 * @property {string} phone - Unique phone number
 * @property {string} passwordHash - bcrypt hashed password (12 rounds)
 * @property {string} [passwordResetToken] - SHA-256 hashed token for password reset
 * @property {Date} [passwordResetExpires] - Token expiration timestamp (15 minutes)
 * @property {boolean} isEmailVerified - Email verification status (default: false)
 * @property {boolean} isPhoneVerified - Phone verification status (default: false)
 * @property {string} role - User role: EMPLOYEE, ORG_ADMIN, PLATFORM_ADMIN
 * @property {ObjectId} organizationId - Reference to Organization (required except PLATFORM_ADMIN)
 * @property {string} approvalStatus - PENDING, APPROVED, REJECTED (default: PENDING)
 * @property {string} [name] - Full name (set during profile completion)
 * @property {Date} [dob] - Date of birth
 * @property {string} [gender] - MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
 * @property {string} [homeAddress] - Home address
 * @property {string} [workAddress] - Work/office address
 * @property {Object} [emergencyContact] - Emergency contact information
 * @property {string} emergencyContact.name - Emergency contact name
 * @property {string} emergencyContact.phone - Emergency contact phone
 * @property {boolean} profileCompleted - Profile completion status (default: false)
 * @property {boolean} isDriver - Driver privileges granted (default: false)
 * @property {string} driverStatus - NONE, PENDING, APPROVED, REJECTED (default: NONE)
 * @property {boolean} documentsUploaded - Driver documents uploaded flag (default: false)
 * @property {ObjectId} [driverReviewedBy] - Admin who reviewed driver application
 * @property {Date} [driverReviewedAt] - Driver review timestamp
 * @property {Object} [driverDocuments] - Driver document file paths
 * @property {string} driverDocuments.license - License file path
 * @property {string} driverDocuments.rc - RC file path
 * @property {string} [driverRejectionReason] - Reason for driver rejection
 * @property {Date} [lastLogin] - Last successful login timestamp
 * @property {Date} createdAt - Auto-generated creation timestamp
 * @property {Date} updatedAt - Auto-generated update timestamp
 * 
 * @indexes
 * - email: Unique index for fast lookup
 * - organizationId: Index for organization-scoped queries
 * 
 * @workflow Employee Registration:
 * 1. User registers with email, phone, password, orgCode
 * 2. approvalStatus = PENDING, profileCompleted = false
 * 3. Org admin approves via /api/org-admin/approve-user
 * 4. approvalStatus = APPROVED
 * 5. User completes profile via /api/users/complete-profile
 * 6. profileCompleted = true
 * 
 * @workflow Driver Application:
 * 1. Employee requests driver access via /api/users/driver-intent
 * 2. driverStatus = PENDING, documentsUploaded = false
 * 3. User uploads docs via /api/driver/upload-documents
 * 4. documentsUploaded = true
 * 5. Org admin reviews and approves via /api/org-admin/driver-requests/:id/approve
 * 6. isDriver = true, driverStatus = APPROVED
 * 7. User can now create trips
 */
const userSchema = new mongoose.Schema(
  {
    // --------------------
    // Identity (Login)
    // --------------------
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    // --------------------
    // Password Reset
    // --------------------
    passwordResetToken: String,
    passwordResetExpires: Date,

    // --------------------
    // Verification State
    // --------------------
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    // --------------------
    // Role & Organization
    // --------------------
    role: {
      type: String,
      enum: ["EMPLOYEE", "ORG_ADMIN", "PLATFORM_ADMIN"],
      default: "EMPLOYEE",
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: function () {
        return this.role !== "PLATFORM_ADMIN";
      },
    },

    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    // --------------------
    // Profile Information
    // --------------------
    name: {
      type: String,
      trim: true,
    },

    dob: Date,

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
    },

    homeAddress: {
      type: String,
      trim: true,
    },

    workAddress: {
      type: String,
      trim: true,
    },

    emergencyContact: {
      name: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    // --------------------
    // Driver Capability
    // --------------------
    isDriver: {
      type: Boolean,
      default: false,
    },

    driverStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },

    documentsUploaded: {
      type: Boolean,
      default: false,
    },



driverReviewedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User", // admin
},

driverReviewedAt: {
  type: Date,
},

driverDocuments: {
  license: { type: String },
  rc: { type: String },
},


driverRejectionReason: {
  type: String,
},



    // --------------------
    // Passkey (WebAuthn)
    // --------------------
    passkeys: [
      {
        credentialID: { type: String, required: true },   // base64url
        publicKey: { type: String, required: true },       // base64url COSE
        counter: { type: Number, default: 0 },            // replay prevention
        transports: [{ type: String }],                   // 'internal','usb',etc.
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // --------------------
    // System Metadata
    // --------------------
    lastLogin: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
