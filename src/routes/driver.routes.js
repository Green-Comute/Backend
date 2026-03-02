import express from "express";
import requireAuth from "../middlewares/auth.middleware.js";
import { uploadDriverDocs } from "../middlewares/upload.middleware.js";
import { uploadDriverDocuments } from "../controllers/driver.controller.js";

/**
 * @fileoverview Driver Document Routes
 * @description Defines endpoints for drivers to upload required verification documents
 * (driving license and vehicle registration certificate).
 * @module routes/driver.routes
 */

const router = express.Router();

/**
 * @api {post} /api/driver/upload-documents Upload Driver Documents
 * @apiDescription Upload driving license and vehicle registration certificate
 * @apiPermission driver-applicant
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiHeader {String} Content-Type multipart/form-data
 * @apiBody {File} license Driving license document (PDF/Image)
 * @apiBody {File} rc Vehicle Registration Certificate (PDF/Image)
 * @apiNote Requires isDriver=true or driverStatus=PENDING
 * @apiNote Uses multer middleware for file upload handling
 * @apiNote Files stored in uploads/driver-docs directory
 */
router.post(
  "/upload-documents",
  requireAuth,
  uploadDriverDocs.fields([
    { name: "license", maxCount: 1 },
    { name: "rc", maxCount: 1 },
  ]),
  uploadDriverDocuments
);

export default router;
