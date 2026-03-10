import mongoose from 'mongoose';

/**
 * @fileoverview SupportTicket Model
 * @description In-app support tickets submitted by users (5.11).
 * Attachment file size validated at upload middleware (≤ 5 MB).
 * @module models/SupportTicket
 */

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    issueType: {
      type: String,
      required: true,
      enum: ['BILLING', 'SAFETY', 'DRIVER', 'TECHNICAL', 'OTHER'],
    },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    /** Relative path or URL to uploaded attachment; null if no attachment. */
    attachmentUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
    },
  },
  { timestamps: true }
);

export default mongoose.model('SupportTicket', supportTicketSchema);
