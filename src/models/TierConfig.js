import mongoose from 'mongoose';

/**
 * @fileoverview Tier Configuration Model
 * @description Per-org tier definitions. organizationId=null means platform default.
 * Org Admin configures their own tiers (4.4). Platform Admin sets global default (4.14).
 * Constraints: 3–10 tiers, no overlap in minPoints thresholds.
 * @module models/TierConfig
 */
const tierSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        // totalEarned threshold to enter this tier
        minPoints: {
            type: Number,
            required: true,
            min: 0,
        },
        // null on the top tier
        maxPoints: {
            type: Number,
            default: null,
        },
        // Tailwind-compatible hex or named color for UI badge
        color: {
            type: String,
            default: '#78716c',
        },
        // Emoji or icon name for UI
        icon: {
            type: String,
            default: '🥉',
        },
        // Points multiplier applied to base earn amount
        multiplier: {
            type: Number,
            default: 1.0,
            min: 0.1,
        },
        // Display perks/benefits for this tier
        perks: [{ type: String }],
    },
    { _id: false }
);

const tierConfigSchema = new mongoose.Schema(
    {
        // null = platform default; ObjectId = org-specific override
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
        },
        tiers: {
            type: [tierSchema],
            validate: {
                validator: function (tiers) {
                    return tiers.length >= 3 && tiers.length <= 10;
                },
                message: 'Tier config must have between 3 and 10 tiers',
            },
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// One config per org (or one global)
tierConfigSchema.index({ organizationId: 1 }, { unique: true, sparse: true });

/**
 * Default platform tiers seeded on first access.
 * BRONZE (0) → SILVER (200, 1.25x) → GOLD (750, 1.5x) → PLATINUM (2000, 2x)
 */
export const DEFAULT_TIERS = [
    { name: 'BRONZE', minPoints: 0, maxPoints: 199, color: '#92400e', icon: '🥉', multiplier: 1.0, perks: ['Basic access'] },
    { name: 'SILVER', minPoints: 200, maxPoints: 749, color: '#6b7280', icon: '🥈', multiplier: 1.25, perks: ['Priority ride matching'] },
    { name: 'GOLD', minPoints: 750, maxPoints: 1999, color: '#d97706', icon: '🥇', multiplier: 1.5, perks: ['Exclusive rewards', 'Priority matching'] },
    { name: 'PLATINUM', minPoints: 2000, maxPoints: null, color: '#7c3aed', icon: '💎', multiplier: 2.0, perks: ['VIP support', 'Max multiplier', 'All rewards'] },
];

export default mongoose.model('TierConfig', tierConfigSchema);
