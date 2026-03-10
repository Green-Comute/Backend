import mongoose from 'mongoose';

/**
 * @fileoverview TripShareToken Model
 * @description Short-lived tokens for live trip tracking links (5.6).
 * Token expires when trip ends; GPS permission required before generation.
 * @module models/TripShareToken
 */

const tripShareTokenSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Cryptographically random hex token (32 bytes). */
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('TripShareToken', tripShareTokenSchema);
