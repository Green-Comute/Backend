import mongoose from 'mongoose';

/**
 * @fileoverview Redemption Model
 * @description Redemption requests with full approval workflow and audit fields.
 * Lifecycle: PENDING → APPROVED (irreversible) | REJECTED (triggers refund).
 * All state changes stored with reviewer identity and timestamp for audit (4.12).
 * @module models/Redemption
 */
const redemptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        rewardItemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'RewardItem',
            required: true,
        },
        // Snapshot of cost at redemption time (item cost may change later)
        pointsSpent: {
            type: Number,
            required: true,
            min: 1,
        },
        // PENDING → admin queue; APPROVED → fulfilled; REJECTED → refunded
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING',
        },
        // Audit: who reviewed (4.12 audited constraint)
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
        rejectionReason: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

// Admin approval queue query (4.12)
redemptionSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
// User's history (4.15)
redemptionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Redemption', redemptionSchema);
