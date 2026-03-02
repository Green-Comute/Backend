import mongoose from 'mongoose';

/**
 * @fileoverview User Points Model
 * @description Denormalized running totals per user.
 * Updated atomically via $inc on every ledger event.
 * Single-document read satisfies <2s balance sync constraint (4.2).
 * @module models/UserPoints
 */
const userPointsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        // Spendable balance (decremented on redemption, never goes < 0)
        pointsBalance: {
            type: Number,
            default: 0,
            min: 0,
        },
        // Lifetime earned — only increases, used for tier evaluation
        totalEarned: {
            type: Number,
            default: 0,
            min: 0,
        },
        // Daily earned — resets at midnight UTC to enforce dailyCap (4.1)
        dailyEarned: {
            type: Number,
            default: 0,
            min: 0,
        },
        // Timestamp of last daily reset — compare date portion to today
        dailyReset: {
            type: Date,
            default: Date.now,
        },
        // Current tier name — updated whenever totalEarned crosses a threshold (4.5)
        currentTier: {
            type: String,
            default: 'BRONZE',
        },
        tierUpdatedAt: {
            type: Date,
            default: Date.now,
        },
        // 4.13 — user opted out of gamification leaderboards
        optedOut: {
            type: Boolean,
            default: false,
        },
        // 4.8 — department copied from User for leaderboard filtering (denormalized)
        department: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { timestamps: true }
);

// Leaderboard sort index (4.7)
userPointsSchema.index({ organizationId: 1, pointsBalance: -1 });
// Dept leaderboard index (4.8)
userPointsSchema.index({ organizationId: 1, department: 1, pointsBalance: -1 });

export default mongoose.model('UserPoints', userPointsSchema);
