import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * @fileoverview Ticket Upload Middleware
 * @description Configures multer for support ticket attachment uploads (5.11).
 * Enforces 5 MB file size limit and restricts files to images and PDFs.
 * @module middlewares/ticketUpload.middleware
 */

const uploadDir = 'uploads/support-tickets';
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /\.(jpg|jpeg|png|gif|pdf)$/i;
  if (allowed.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, jpeg, png, gif) and PDF files are allowed'));
  }
};

/** 5 MB limit per attachment */
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Single-file upload middleware for support ticket attachments.
 * Field name: 'attachment'
 */
const uploadTicketAttachment = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single('attachment');

/**
 * Express middleware wrapper that converts multer errors to JSON 400 responses.
 */
export const handleTicketUpload = (req, res, next) => {
  uploadTicketAttachment(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Attachment must be 5 MB or smaller',
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};
