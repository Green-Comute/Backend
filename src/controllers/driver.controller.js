import User from "../models/User.js";

/**
 * @fileoverview Driver Document Management Controller
 * @description Handles driver document upload and verification process. Drivers must upload
 * required documents (driving license and vehicle registration certificate) for admin review.
 * @module controllers/driver.controller
 */

/**
 * Upload Driver Documents
 * 
 * @description Enables drivers to upload required documents (license and RC) for verification.
 * Documents are stored as file paths and marked for admin review. Uses multer middleware
 * for file handling.
 * 
 * @route POST /api/driver/upload-documents
 * @access Private (Users with isDriver=true or driverStatus=PENDING)
 * 
 * @param {Object} req.user - Decoded JWT payload
 * @param {string} req.user.userId - MongoDB ObjectId of authenticated user
 * @param {Object} req.files - Uploaded files (handled by multer middleware)
 * @param {Array} req.files.license - Driving license document (required)
 * @param {Array} req.files.rc - Vehicle Registration Certificate (required)
 * 
 * @returns {Object} 200 - Documents uploaded successfully
 * @returns {Object} 400 - Invalid driver request or missing documents
 * @returns {Object} 500 - Internal server error
 * 
 * @example
 * // Request (multipart/form-data)
 * POST /api/driver/upload-documents
 * Authorization: Bearer <jwt_token>
 * Content-Type: multipart/form-data
 * 
 * FormData:
 * - license: [File] (PDF/Image)
 * - rc: [File] (PDF/Image)
 * 
 * // Response
 * {
 *   "message": "Documents uploaded successfully. Awaiting approval."
 * }
 * 
 * @businessLogic
 * - User must be a driver (isDriver = true) to upload documents
 * - Both license and RC documents are mandatory
 * - Files are stored in uploads/driver-docs directory (configured in middleware)
 * - File paths are saved to user.driverDocuments object
 * - Sets documentsUploaded flag to true
 * - Sets driverStatus to PENDING (awaiting admin review)
 * - Admin will review documents via /api/org-admin/driver-requests endpoint
 * - Supported file formats: configured in upload.middleware.js
 * - File size limits: configured in upload.middleware.js
 * 
 * @requires upload.middleware.js - Multer middleware for file upload handling
 * @see orgAdmin.controller.js - Document review and approval endpoints
 */
export const uploadDriverDocuments = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user || !user.isDriver) {
      return res.status(400).json({ message: "Invalid driver request" });
    }

    if (!req.files?.license || !req.files?.rc) {
      return res.status(400).json({
        message: "License and RC are required",
      });
    }

    user.driverDocuments = {
      license: req.files.license[0].path,
      rc: req.files.rc[0].path,
    };

    user.documentsUploaded = true;
    user.driverStatus = "PENDING";

    await user.save();

    res.json({
      message: "Documents uploaded successfully. Awaiting approval.",
    });
  } catch (err) {
    console.error("Upload docs error:", err);
    res.status(500).json({ message: "Document upload failed" });
  }
};

