import mongoose from 'mongoose';

/**
 * @fileoverview BlockedUser Model
 * @description Stores user-to-user block relationships (5.4).
 * Blocked users are hidden from ride search results.
 * @module models/BlockedUser
 */

const blockedUserSchema = new mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Composite unique index prevents duplicate blocks
blockedUserSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export default mongoose.model('BlockedUser', blockedUserSchema);
