import PointRuleConfig from '../models/PointRuleConfig.js';

/**
 * @fileoverview Platform Admin — Point Rules Controller
 * @description PLATFORM_ADMIN only. Get and update the global point rules (4.14).
 * Rule changes are future-only — existing ledger rows are unaffected.
 * @module controllers/pointRules.controller
 */

/**
 * GET /platform/point-rules
 * Returns the global default point rules (organizationId = null).
 */
export const getPointRules = async (req, res) => {
    try {
        let cfg = await PointRuleConfig.findOne({ organizationId: null });
        if (!cfg) {
            cfg = await PointRuleConfig.create({ organizationId: null });
        }
        res.status(200).json({ success: true, data: cfg.rules });
    } catch (err) {
        console.error('getPointRules error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch point rules' });
    }
};

/**
 * PUT /platform/point-rules
 * Update global point rules. Only non-null fields in req.body.rules are applied.
 * Change is future-only (constraint 4.14).
 * Body: { rules: { passengerPerRide?, driverPerPassenger?, bonusEarlyBooking?, ... } }
 */
export const updatePointRules = async (req, res) => {
    try {
        const { rules } = req.body;
        if (!rules || typeof rules !== 'object') {
            return res.status(400).json({ success: false, message: 'rules object is required' });
        }

        // Build $set update — only update provided fields
        const update = {};
        const allowed = [
            'passengerPerRide', 'driverPerPassenger',
            'bonusEarlyBooking', 'bonusPeakHour',
            'dailyCap', 'peakHours',
        ];
        for (const key of allowed) {
            if (rules[key] !== undefined) {
                update[`rules.${key}`] = rules[key];
            }
        }
        update.updatedBy = req.user.userId;

        const cfg = await PointRuleConfig.findOneAndUpdate(
            { organizationId: null },
            { $set: update },
            { new: true, upsert: true }
        );

        res.status(200).json({
            success: true,
            data: cfg.rules,
            message: 'Global point rules updated — applies to future events only',
        });
    } catch (err) {
        console.error('updatePointRules error:', err);
        res.status(500).json({ success: false, message: 'Failed to update point rules' });
    }
};
