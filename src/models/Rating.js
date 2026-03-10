import mongoose from 'mongoose';

/**
 * @fileoverview Rating Model
 * @description Defines the Rating schema for user-to-user trip ratings.
 * Supports double-blind rating (5.3): both sides must submit before ratings become visible.
 * @module models/Rating
 */

const ratingSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
    /** PASSENGER_TO_DRIVER or DRIVER_TO_PASSENGER */
    ratingType: {
      type: String,
      enum: ['PASSENGER_TO_DRIVER', 'DRIVER_TO_PASSENGER'],
      required: true,
    },
    /**
     * Double-blind flag (5.3).  Remains false until both sides have submitted
     * ratings for the same trip, or the 48-hour window expires.
     */
    isVisible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent a reviewer from submitting more than one rating per trip
ratingSchema.index({ tripId: 1, reviewerId: 1 }, { unique: true });

export default mongoose.model('Rating', ratingSchema);
