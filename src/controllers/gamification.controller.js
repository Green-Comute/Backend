import UserPoints from '../models/UserPoints.js';
import PointLedger from '../models/PointLedger.js';
import TierConfig, { DEFAULT_TIERS } from '../models/TierConfig.js';

/**
 * @fileoverview Gamification Controller
 * @description Handles all user-facing gamification endpoints:
 * balance, history, tier progress, leaderboard, opt-out.
 * @module controllers/gamification.controller
 */

/**
 * GET /api/gamification/balance
 * Returns the authenticated user's current points balance, lifetime total, and tier.
 * Fast read from UserPoints single document (satisfies <2s sync — 4.2).
 */
export const getBalance = async (req, res) => {
    try {
        const up = await UserPoints.findOne({ userId: req.user.userId }).lean();

        if (!up) {
            return res.status(200).json({
                success: true,
                data: {
                    pointsBalance: 0,
                    totalEarned: 0,
                    currentTier: 'BRONZE',
                    optedOut: false,
                },
            });
        }

        res.status(200).json({
            success: true,
            data: {
                pointsBalance: up.pointsBalance,
                totalEarned: up.totalEarned,
                currentTier: up.currentTier,
                optedOut: up.optedOut,
            },
        });
    } catch (err) {
        console.error('getBalance error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
};

/**
 * GET /api/gamification/history?page=1
 * Returns paginated points history for the authenticated user (4.3).
 * 50 per page, sorted newest-first.
 */
export const getHistory = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 50;
        const skip = (page - 1) * limit;

        const [ledger, total] = await Promise.all([
            PointLedger.find({ userId: req.user.userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PointLedger.countDocuments({ userId: req.user.userId }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                ledger,
            },
        });
    } catch (err) {
        console.error('getHistory error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
};

/**
 * GET /api/gamification/tier-progress
 * Returns user's current tier, next tier, and percentage progress (4.5).
 */
export const getTierProgress = async (req, res) => {
    try {
        const up = await UserPoints.findOne({ userId: req.user.userId }).lean();
        const totalEarned = up?.totalEarned ?? 0;
        const currentTierName = up?.currentTier ?? 'BRONZE';

        // Load tier config
        let cfg = await TierConfig.findOne({ organizationId: req.user.organizationId });
        if (!cfg) cfg = await TierConfig.findOne({ organizationId: null });
        const tiers = cfg ? cfg.tiers : DEFAULT_TIERS;
        const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);

        const currentIdx = sorted.findIndex(t => t.name === currentTierName);
        const current = sorted[currentIdx] || sorted[0];
        const next = sorted[currentIdx + 1] || null;

        let progressPct = 100;
        let pointsNeeded = 0;

        if (next) {
            const range = next.minPoints - current.minPoints;
            const earned = totalEarned - current.minPoints;
            progressPct = Math.min(100, Math.round((earned / range) * 100));
            pointsNeeded = Math.max(0, next.minPoints - totalEarned);
        }

        res.status(200).json({
            success: true,
            data: {
                totalEarned,
                currentTier: { ...current },
                nextTier: next ? { ...next } : null,
                progressPct,
                pointsNeeded,
                allTiers: sorted,
            },
        });
    } catch (err) {
        console.error('getTierProgress error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch tier progress' });
    }
};

/**
 * GET /api/gamification/leaderboard
 * Returns org-wide leaderboard, excluding opted-out users (4.7).
 */
export const getLeaderboard = async (req, res) => {
    try {
        const leaders = await UserPoints.find({
            organizationId: req.user.organizationId,
            optedOut: false,
        })
            .sort({ pointsBalance: -1 })
            .limit(50)
            .populate('userId', 'name email')
            .lean();

        const ranked = leaders.map((entry, idx) => ({
            rank: idx + 1,
            userId: entry.userId?._id,
            name: entry.userId?.name || 'Anonymous',
            pointsBalance: entry.pointsBalance,
            currentTier: entry.currentTier,
            department: entry.department || '',
            isMe: entry.userId?._id?.toString() === req.user.userId?.toString(),
        }));

        res.status(200).json({ success: true, data: ranked });
    } catch (err) {
        console.error('getLeaderboard error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
    }
};

/**
 * GET /api/gamification/leaderboard/dept?dept=Engineering
 * Department-filtered leaderboard (4.8). Returns 400 if dept param missing.
 */
export const getDeptLeaderboard = async (req, res) => {
    try {
        const dept = req.query.dept;
        if (!dept) {
            return res.status(400).json({ success: false, message: 'dept query parameter is required' });
        }

        const leaders = await UserPoints.find({
            organizationId: req.user.organizationId,
            department: dept,
            optedOut: false,
        })
            .sort({ pointsBalance: -1 })
            .limit(50)
            .populate('userId', 'name email')
            .lean();

        const ranked = leaders.map((entry, idx) => ({
            rank: idx + 1,
            userId: entry.userId?._id,
            name: entry.userId?.name || 'Anonymous',
            pointsBalance: entry.pointsBalance,
            currentTier: entry.currentTier,
            isMe: entry.userId?._id?.toString() === req.user.userId?.toString(),
        }));

        res.status(200).json({ success: true, data: ranked, dept });
    } catch (err) {
        console.error('getDeptLeaderboard error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch department leaderboard' });
    }
};

/**
 * PUT /api/gamification/opt-out
 * Toggle leaderboard opt-out for the authenticated user (4.13).
 */
export const toggleOptOut = async (req, res) => {
    try {
        let up = await UserPoints.findOne({ userId: req.user.userId });
        if (!up) {
            up = await UserPoints.create({
                userId: req.user.userId,
                organizationId: req.user.organizationId,
                optedOut: true,
            });
        } else {
            up.optedOut = !up.optedOut;
            await up.save();
        }

        res.status(200).json({
            success: true,
            data: { optedOut: up.optedOut },
            message: up.optedOut
                ? 'You are now hidden from leaderboards'
                : 'You are now visible on leaderboards',
        });
    } catch (err) {
        console.error('toggleOptOut error:', err);
        res.status(500).json({ success: false, message: 'Failed to update privacy setting' });
    }
};
