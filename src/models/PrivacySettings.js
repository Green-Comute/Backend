import mongoose from 'mongoose';

/**
 * @fileoverview PrivacySettings Model
 * @description Per-user privacy preferences, GPS toggle, and tutorial completion flag (5.9, 5.10, 5.12).
 * One document per user (upsert pattern).
 * @module models/PrivacySettings
 */

const privacySettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    /** 5.9 – Privacy Settings Hub */
    hideProfile: { type: Boolean, default: false },
    hideRatings: { type: Boolean, default: false },
    hideTrips: { type: Boolean, default: false },
    /** 5.10 – GPS Toggle: false blocks ride booking */
    gpsEnabled: { type: Boolean, default: true },
    /** 5.12 – Onboarding Tutorial */
    tutorialCompleted: { type: Boolean, default: false },
    /** 5.8 – Women-only ride preference */
    womenOnlyPreference: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('PrivacySettings', privacySettingsSchema);
