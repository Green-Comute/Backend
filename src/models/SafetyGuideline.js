import mongoose from 'mongoose';

/**
 * @fileoverview SafetyGuideline Model
 * @description Versioned safety guidelines published by admins (5.13).
 * Users must re-accept whenever a new version is published.
 * @module models/SafetyGuideline
 */

const acceptanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const safetyGuidelineSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true },
    /** Monotonically increasing integer. */
    version: { type: Number, required: true },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Only the most recent active guideline is shown to users. */
    isActive: { type: Boolean, default: true, index: true },
    /** Per-user acceptance records for current version. */
    acceptances: [acceptanceSchema],
  },
  { timestamps: true }
);

export default mongoose.model('SafetyGuideline', safetyGuidelineSchema);
