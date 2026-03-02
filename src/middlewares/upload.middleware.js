import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * @fileoverview File Upload Middleware
 * @description Configures multer for driver document uploads. Handles file storage,
 * naming, and validation for driving license and vehicle registration documents.
 * @module middlewares/upload.middleware
 */

/**
 * Upload Directory Configuration
 * @constant {string}
 * @description Directory path for storing driver documents
 */
const uploadDir = "uploads/driver-docs";

// Create upload directory if it doesn't exist
fs.mkdirSync(uploadDir, { recursive: true });

/**
 * Multer Storage Configuration
 * 
 * @description Defines how and where to store uploaded files:
 * - Destination: uploads/driver-docs directory
 * - Filename: {userId}-{fieldname}{extension}
 *   Example: 507f1f77bcf86cd799439011-license.pdf
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}-${file.fieldname}${ext}`);
  },
});

/**
 * Driver Documents Upload Middleware
 * 
 * @description Multer middleware configured for driver document uploads.
 * Handles driving license and vehicle registration certificate uploads.
 * 
 * @middleware
 * 
 * @configuration
 * - Storage: Disk storage in uploads/driver-docs
 * - File size limit: 5 MB per file
 * - Filename format: {userId}-{fieldname}.{ext}
 * - Supported fields: 'license' and 'rc'
 * 
 * @usage
 * router.post('/upload-documents',
 *   requireAuth,
 *   uploadDriverDocs.fields([
 *     { name: 'license', maxCount: 1 },
 *     { name: 'rc', maxCount: 1 }
 *   ]),
 *   uploadDriverDocuments
 * );
 * 
 * @uploaded Files accessible via:
 * - req.files.license[0] - License document
 * - req.files.rc[0] - RC document
 * 
 * @properties File object properties:
 * - path: Full file path on disk
 * - originalname: Original filename
 * - mimetype: File MIME type
 * - size: File size in bytes
 * 
 * @security
 * - Files stored on local disk (consider cloud storage for production)
 * - File size limited to 5 MB
 * - Filename includes userId to prevent collisions
 * - Directory created with recursive flag
 * 
 * @production
 * - Consider uploading to cloud storage (AWS S3, Google Cloud Storage)
 * - Implement file type validation (accept only PDF, JPG, PNG)
 * - Add virus scanning for uploaded files
 * - Implement file cleanup for rejected applications
 * - Consider encryption for sensitive documents
 */
export const uploadDriverDocs = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});
