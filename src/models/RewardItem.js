import mongoose from 'mongoose';

/**
 * @fileoverview Reward Item Model
 * @description Org-specific rewards catalog items managed by ORG_ADMIN (4.11).
 * Images must be <200kb (4.9 constraint — enforced at upload middleware level).
 * Stock=null means unlimited availability.
 * @module models/RewardItem
 */
const rewardItemSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        // Stored URL or upload path. Upload middleware enforces <200kb
        imageUrl: {
            type: String,
            default: null,
        },
        pointCost: {
            type: Number,
            required: true,
            min: 1,
        },
        // null = unlimited stock; otherwise decremented on APPROVED redemption
        stock: {
            type: Number,
            default: null,
            min: 0,
        },
        category: {
            type: String,
            enum: ['VOUCHER', 'MERCHANDISE', 'EXPERIENCE', 'DONATION', 'OTHER'],
            default: 'VOUCHER',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// Catalog query index (4.9)
rewardItemSchema.index({ organizationId: 1, isActive: 1, pointCost: 1 });

export default mongoose.model('RewardItem', rewardItemSchema);
