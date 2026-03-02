import RewardItem from '../models/RewardItem.js';
import Redemption from '../models/Redemption.js';
import UserPoints from '../models/UserPoints.js';
import PointLedger from '../models/PointLedger.js';
import TierConfig, { DEFAULT_TIERS } from '../models/TierConfig.js';
import { getIO } from '../config/socket.js';

/**
 * @fileoverview Rewards Admin Controller
 * @description ORG_ADMIN Only. Manages reward catalog, tier config, and redemption approvals.
 * @module controllers/rewardsAdmin.controller
 */

// ─── Reward Items CRUD ─────────────────────────────────────────────────────

/** GET /org-admin/rewards/items */
export const listRewardItems = async (req, res) => {
    try {
        const items = await RewardItem.find({ organizationId: req.user.organizationId })
            .sort({ isActive: -1, pointCost: 1 })
            .lean();
        res.status(200).json({ success: true, data: items });
    } catch (err) {
        console.error('listRewardItems error:', err);
        res.status(500).json({ success: false, message: 'Failed to list reward items' });
    }
};

/** POST /org-admin/rewards/items */
export const createRewardItem = async (req, res) => {
    try {
        const { name, description, imageUrl, pointCost, stock, category } = req.body;
        if (!name || !pointCost) {
            return res.status(400).json({ success: false, message: 'name and pointCost are required' });
        }

        const item = await RewardItem.create({
            organizationId: req.user.organizationId,
            name, description, imageUrl, pointCost, stock, category,
            createdBy: req.user.userId,
        });

        res.status(201).json({ success: true, data: item, message: 'Reward item created' });
    } catch (err) {
        console.error('createRewardItem error:', err);
        res.status(500).json({ success: false, message: 'Failed to create reward item' });
    }
};

/** PUT /org-admin/rewards/items/:id */
export const updateRewardItem = async (req, res) => {
    try {
        const item = await RewardItem.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId },
            req.body,
            { new: true, runValidators: true }
        );
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

        res.status(200).json({ success: true, data: item, message: 'Reward item updated' });
    } catch (err) {
        console.error('updateRewardItem error:', err);
        res.status(500).json({ success: false, message: 'Failed to update reward item' });
    }
};

/** DELETE /org-admin/rewards/items/:id — soft delete (isActive = false) */
export const deactivateRewardItem = async (req, res) => {
    try {
        const item = await RewardItem.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId },
            { isActive: false },
            { new: true }
        );
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

        res.status(200).json({ success: true, message: 'Reward item deactivated' });
    } catch (err) {
        console.error('deactivateRewardItem error:', err);
        res.status(500).json({ success: false, message: 'Failed to deactivate item' });
    }
};

// ─── Redemption Queue ──────────────────────────────────────────────────────

/** GET /org-admin/rewards/redemptions?status=PENDING */
export const listRedemptions = async (req, res) => {
    try {
        const filter = { organizationId: req.user.organizationId };
        if (req.query.status) filter.status = req.query.status;

        const redemptions = await Redemption.find(filter)
            .sort({ createdAt: -1 })
            .populate('userId', 'name email')
            .populate('rewardItemId', 'name pointCost imageUrl')
            .populate('reviewedBy', 'name email')
            .lean();

        res.status(200).json({ success: true, data: redemptions });
    } catch (err) {
        console.error('listRedemptions error:', err);
        res.status(500).json({ success: false, message: 'Failed to list redemptions' });
    }
};

/** POST /org-admin/rewards/redemptions/:id/approve */
export const approveRedemption = async (req, res) => {
    try {
        const redemption = await Redemption.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            status: 'PENDING',
        }).populate('userId', 'name');

        if (!redemption) {
            return res.status(404).json({ success: false, message: 'Redemption not found or already reviewed' });
        }

        redemption.status = 'APPROVED';
        redemption.reviewedBy = req.user.userId;
        redemption.reviewedAt = new Date();
        await redemption.save();

        // Notify passenger
        try {
            getIO().to(`user-${redemption.userId._id}`).emit('redemption-approved', {
                redemptionId: redemption._id,
                message: '🎉 Your redemption has been approved!',
                timestamp: new Date(),
            });
        } catch (e) {
            console.error('Socket emit error:', e.message);
        }

        res.status(200).json({ success: true, data: redemption, message: 'Redemption approved' });
    } catch (err) {
        console.error('approveRedemption error:', err);
        res.status(500).json({ success: false, message: 'Failed to approve redemption' });
    }
};

/** POST /org-admin/rewards/redemptions/:id/reject */
export const rejectRedemption = async (req, res) => {
    try {
        const { reason } = req.body;

        const redemption = await Redemption.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            status: 'PENDING',
        });

        if (!redemption) {
            return res.status(404).json({ success: false, message: 'Redemption not found or already reviewed' });
        }

        redemption.status = 'REJECTED';
        redemption.reviewedBy = req.user.userId;
        redemption.reviewedAt = new Date();
        redemption.rejectionReason = reason || 'No reason provided';
        await redemption.save();

        // Refund points — atomic increment (4.12 refund on reject)
        await UserPoints.updateOne(
            { userId: redemption.userId },
            { $inc: { pointsBalance: redemption.pointsSpent } }
        );

        // Insert EARN refund ledger row
        await PointLedger.create({
            userId: redemption.userId,
            organizationId: req.user.organizationId,
            type: 'EARN',
            reason: 'REDEMPTION_REFUND',
            points: redemption.pointsSpent,
            refId: redemption._id,
            refModel: 'Redemption',
            note: `Refund: ${reason || 'Redemption rejected by admin'}`,
        });

        // Notify passenger
        try {
            getIO().to(`user-${redemption.userId}`).emit('redemption-rejected', {
                redemptionId: redemption._id,
                pointsRefunded: redemption.pointsSpent,
                reason: redemption.rejectionReason,
                message: `Your redemption was rejected. ${redemption.pointsSpent} pts refunded.`,
                timestamp: new Date(),
            });
        } catch (e) {
            console.error('Socket emit error:', e.message);
        }

        res.status(200).json({ success: true, data: redemption, message: 'Redemption rejected and points refunded' });
    } catch (err) {
        console.error('rejectRedemption error:', err);
        res.status(500).json({ success: false, message: 'Failed to reject redemption' });
    }
};

// ─── Tier Config ───────────────────────────────────────────────────────────

/** GET /org-admin/rewards/tiers */
export const getOrgTiers = async (req, res) => {
    try {
        let cfg = await TierConfig.findOne({ organizationId: req.user.organizationId });
        if (!cfg) cfg = await TierConfig.findOne({ organizationId: null });
        const tiers = cfg ? cfg.tiers : DEFAULT_TIERS;

        res.status(200).json({ success: true, data: tiers.sort((a, b) => a.minPoints - b.minPoints) });
    } catch (err) {
        console.error('getOrgTiers error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch tier config' });
    }
};

/** PUT /org-admin/rewards/tiers — validates no overlap, 3-10 tiers */
export const updateOrgTiers = async (req, res) => {
    try {
        const { tiers } = req.body;
        if (!Array.isArray(tiers)) {
            return res.status(400).json({ success: false, message: 'tiers must be an array' });
        }
        if (tiers.length < 3 || tiers.length > 10) {
            return res.status(400).json({ success: false, message: 'Must have between 3 and 10 tiers' });
        }

        // Sort and check for overlaps
        const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].minPoints <= sorted[i - 1].minPoints) {
                return res.status(400).json({ success: false, message: 'Tier minPoints must be strictly increasing (no overlap)' });
            }
        }

        const cfg = await TierConfig.findOneAndUpdate(
            { organizationId: req.user.organizationId },
            { tiers: sorted, updatedBy: req.user.userId, organizationId: req.user.organizationId },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: cfg.tiers, message: 'Tier configuration updated' });
    } catch (err) {
        console.error('updateOrgTiers error:', err);
        res.status(500).json({ success: false, message: 'Failed to update tier config' });
    }
};
