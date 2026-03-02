import RewardItem from '../models/RewardItem.js';
import Redemption from '../models/Redemption.js';
import UserPoints from '../models/UserPoints.js';
import PointLedger from '../models/PointLedger.js';
import { getIO } from '../config/socket.js';

/**
 * @fileoverview Rewards Controller (user-facing)
 * @description Handles catalog browsing, reward redemption, and redemption history.
 * @module controllers/rewards.controller
 */

/**
 * GET /api/rewards/catalog
 * Returns active reward items for the user's org, sorted by point cost (4.9).
 */
export const getCatalog = async (req, res) => {
    try {
        const items = await RewardItem.find({
            organizationId: req.user.organizationId,
            isActive: true,
        })
            .sort({ pointCost: 1 })
            .lean();

        res.status(200).json({ success: true, data: items });
    } catch (err) {
        console.error('getCatalog error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch rewards catalog' });
    }
};

/**
 * POST /api/rewards/redeem
 * Atomic redemption — deducts points only if balance >= cost (4.10).
 * Irreversible once submitted.
 * Body: { rewardId }
 */
export const redeemReward = async (req, res) => {
    try {
        const { rewardId } = req.body;
        if (!rewardId) {
            return res.status(400).json({ success: false, message: 'rewardId is required' });
        }

        // 1. Validate reward
        const reward = await RewardItem.findOne({
            _id: rewardId,
            organizationId: req.user.organizationId,
            isActive: true,
        });
        if (!reward) {
            return res.status(404).json({ success: false, message: 'Reward not found or inactive' });
        }

        // 2. Check stock
        if (reward.stock !== null && reward.stock <= 0) {
            return res.status(409).json({ success: false, message: 'This reward is currently out of stock' });
        }

        // 3. Atomic balance deduction — only succeeds if balance >= pointCost (no negative balance — 4.10)
        const updated = await UserPoints.findOneAndUpdate(
            {
                userId: req.user.userId,
                pointsBalance: { $gte: reward.pointCost },
            },
            { $inc: { pointsBalance: -reward.pointCost } },
            { new: true }
        );

        if (!updated) {
            return res.status(409).json({
                success: false,
                message: 'Insufficient points balance',
            });
        }

        // 4. Decrement stock if finite
        if (reward.stock !== null) {
            await RewardItem.updateOne({ _id: rewardId }, { $inc: { stock: -1 } });
        }

        // 5. Create redemption (starts as PENDING for admin approval — 4.12)
        const redemption = await Redemption.create({
            userId: req.user.userId,
            organizationId: req.user.organizationId,
            rewardItemId: rewardId,
            pointsSpent: reward.pointCost,
            status: 'PENDING',
        });

        // 6. Insert SPEND ledger row
        await PointLedger.create({
            userId: req.user.userId,
            organizationId: req.user.organizationId,
            type: 'SPEND',
            reason: 'REDEMPTION_SPEND',
            points: reward.pointCost,
            refId: redemption._id,
            refModel: 'Redemption',
        });

        // 7. Notify admin via socket
        try {
            const io = getIO();
            io.emit('redemption-submitted', {
                organizationId: req.user.organizationId,
                redemptionId: redemption._id,
                message: 'New redemption request submitted',
                timestamp: new Date(),
            });
        } catch (e) {
            console.error('Socket emit error (non-critical):', e.message);
        }

        res.status(201).json({
            success: true,
            data: redemption,
            message: 'Redemption submitted successfully — awaiting admin approval',
        });
    } catch (err) {
        console.error('redeemReward error:', err);
        res.status(500).json({ success: false, message: 'Failed to process redemption' });
    }
};

/**
 * GET /api/rewards/my-redemptions
 * Returns the authenticated user's redemption history (4.15 — read-only view).
 */
export const getMyRedemptions = async (req, res) => {
    try {
        const redemptions = await Redemption.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .populate('rewardItemId', 'name imageUrl pointCost category')
            .lean();

        res.status(200).json({ success: true, data: redemptions });
    } catch (err) {
        console.error('getMyRedemptions error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch redemptions' });
    }
};
