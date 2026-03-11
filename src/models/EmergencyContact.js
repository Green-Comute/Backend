import mongoose from 'mongoose';

/**
 * @fileoverview EmergencyContact Model
 * @description Stores emergency contacts per user (5.5).
 * Maximum 3 contacts per user enforced at service layer.
 * @module models/EmergencyContact
 */

const emergencyContactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    /** E.164 or local format – validated at service layer */
    phone: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true, maxlength: 50 },
  },
  { timestamps: true }
);

export default mongoose.model('EmergencyContact', emergencyContactSchema);
