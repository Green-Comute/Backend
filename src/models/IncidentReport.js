import mongoose from 'mongoose';

/**
 * @fileoverview IncidentReport Model
 * @description Immutable safety incident reports submitted by users (5.7).
 * Admin actions are appended to adminNotes array; report body is never mutated.
 * @module models/IncidentReport
 */

const adminActionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['WARN', 'INVESTIGATE', 'SUSPEND'],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const incidentReportSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
      index: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'],
      default: 'PENDING',
    },
    /** Append-only audit log of admin actions (5.14). */
    adminNotes: [adminActionSchema],
  },
  { timestamps: true }
);

export default mongoose.model('IncidentReport', incidentReportSchema);
