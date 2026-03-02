import UserPoints from '../models/UserPoints.js';
import PointLedger from '../models/PointLedger.js';
import PointRuleConfig from '../models/PointRuleConfig.js';
import TierConfig, { DEFAULT_TIERS } from '../models/TierConfig.js';
import { getIO } from '../config/socket.js';

/**
 * @fileoverview Points Service
 * @description Core points engine for Epic 4 - Gamification & Rewards.
 * Handles point calculation, daily cap enforcement, tier evaluation,
 * and tier-upgrade notifications via Socket.io.
 * @module services/points.service
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Load point rules for org, falling back to platform global (null org).
 */
async function loadRules(organizationId) {
    let cfg = await PointRuleConfig.findOne({ organizationId });
    if (!cfg) cfg = await PointRuleConfig.findOne({ organizationId: null });
    if (!cfg) {
        // Seed global default on first access
        cfg = await PointRuleConfig.create({ organizationId: null });
    }
    return cfg.rules;
}

/**
 * Load tier config for org, falling back to platform global (null org).
 * Seeds DEFAULT_TIERS if no config exists.
 */
async function loadTiers(organizationId) {
    let cfg = await TierConfig.findOne({ organizationId });
    if (!cfg) cfg = await TierConfig.findOne({ organizationId: null });
    if (!cfg) {
        cfg = await TierConfig.create({ organizationId: null, tiers: DEFAULT_TIERS });
    }
    return cfg.tiers;
}

/**
 * Get or create a UserPoints document for a user.
 */
async function getOrCreate(userId, organizationId) {
    let up = await UserPoints.findOne({ userId });
    if (!up) {
        up = await UserPoints.create({ userId, organizationId });
    }
    return up;
}

/**
 * Reset daily earned counter if the date has rolled over since last reset.
 * Uses UTC date comparison.
 */
function needsDailyReset(userPoints) {
    const lastReset = new Date(userPoints.dailyReset);
    const today = new Date();
    return (
        lastReset.getUTCFullYear() !== today.getUTCFullYear() ||
        lastReset.getUTCMonth() !== today.getUTCMonth() ||
        lastReset.getUTCDate() !== today.getUTCDate()
    );
}

/**
 * Return the highest tier the user qualifies for based on totalEarned.
 * Tiers assumed to be sorted ascending by minPoints.
 */
function evaluateTier(totalEarned, tiers) {
    const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
    let current = sorted[0].name;
    for (const tier of sorted) {
        if (totalEarned >= tier.minPoints) {
            current = tier.name;
        }
    }
    return current;
}

/**
 * True if the given Date falls inside any of the peak-hour windows.
 * @param {Date} dt
 * @param {Array<{start: string, end: string}>} peakHours
 */
function isPeakHour(dt, peakHours) {
    const hhmm = dt.getHours() * 60 + dt.getMinutes(); // minutes since midnight
    return peakHours.some(({ start, end }) => {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        return hhmm >= sh * 60 + sm && hhmm <= eh * 60 + em;
    });
}

// ─── Core award function ─────────────────────────────────────────────────────

/**
 * Award points to a single user (passenger or driver).
 * Handles daily cap, tier multiplier, ledger insert, and tier-up notification.
 *
 * @param {object} params
 * @param {ObjectId} params.userId
 * @param {ObjectId} params.organizationId
 * @param {number}   params.basePoints     — points before multiplier
 * @param {string}   params.reason         — PointLedger reason enum
 * @param {ObjectId} params.refId          — causative document id
 * @param {string}   params.refModel       — 'RideRequest' | 'Trip' | 'Redemption'
 * @param {Array}    params.tiers
 * @param {object}   params.rules
 */
async function awardPoints({ userId, organizationId, basePoints, reason, refId, refModel, tiers, rules }) {
    if (basePoints <= 0) return;

    // 1. Load current UserPoints
    let up = await getOrCreate(userId, organizationId);

    // 2. Reset daily counter if needed
    if (needsDailyReset(up)) {
        up.dailyEarned = 0;
        up.dailyReset = new Date();
        await up.save();
    }

    // 3. Apply tier multiplier
    const currentTier = tiers.find(t => t.name === up.currentTier) || tiers[0];
    const multiplier = currentTier?.multiplier ?? 1.0;
    const computed = Math.round(basePoints * multiplier);

    // 4. Enforce daily cap
    const remaining = Math.max(0, rules.dailyCap - up.dailyEarned);
    const toAward = Math.min(computed, remaining);
    if (toAward <= 0) return; // already hit cap today

    // 5. Atomically update UserPoints
    const updated = await UserPoints.findOneAndUpdate(
        { userId },
        {
            $inc: {
                pointsBalance: toAward,
                totalEarned: toAward,
                dailyEarned: toAward,
            },
        },
        { new: true }
    );
    if (!updated) return;

    // 6. Insert ledger row
    await PointLedger.create({
        userId,
        organizationId,
        type: 'EARN',
        reason,
        points: toAward,
        refId,
        refModel,
    });

    // 7. Evaluate tier upgrade
    const newTier = evaluateTier(updated.totalEarned, tiers);
    if (newTier !== up.currentTier) {
        await UserPoints.updateOne({ userId }, { currentTier: newTier, tierUpdatedAt: new Date() });

        // 8. Emit real-time tier-upgrade notification (4.6 — instant trigger)
        try {
            const io = getIO();
            io.to(`user-${userId}`).emit('tier-upgrade', {
                previousTier: up.currentTier,
                newTier,
                pointsBalance: updated.pointsBalance + toAward,
                message: `🎉 Congratulations! You've reached ${newTier} tier!`,
                timestamp: new Date(),
            });
        } catch (e) {
            console.error('tier-upgrade socket emit failed:', e.message);
        }
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Credit points for a completed ride — called from rideController.markAsDroppedOff.
 *
 * Awards:
 *  - Passenger: passengerPerRide + earlyBookingBonus + peakHourBonus
 *  - Driver:    driverPerPassenger (no bonuses — keeps separation clean)
 *
 * @param {object} params
 * @param {ObjectId} params.passengerId
 * @param {ObjectId} params.driverId
 * @param {ObjectId} params.tripId
 * @param {ObjectId} params.rideRequestId
 * @param {ObjectId} params.organizationId
 * @param {Date}     params.scheduledTime   — trip's scheduled departure
 * @param {Date}     params.requestedAt     — when ride request was created
 */
export async function creditRidePoints({
    passengerId,
    driverId,
    tripId,
    rideRequestId,
    organizationId,
    scheduledTime,
    requestedAt,
}) {
    if (!organizationId) {
        console.warn('creditRidePoints: no organizationId — skipping points');
        return;
    }

    const [rules, tiers] = await Promise.all([
        loadRules(organizationId),
        loadTiers(organizationId),
    ]);

    const tripDate = new Date(scheduledTime);
    const reqDate = new Date(requestedAt);

    // ── Passenger earn ──────────────────────────────────────────────────────
    let passengerBase = rules.passengerPerRide;

    // Early booking bonus: requested > 24h before scheduledTime
    const hoursBeforeTrip = (tripDate - reqDate) / (1000 * 60 * 60);
    if (hoursBeforeTrip > 24) {
        passengerBase += rules.bonusEarlyBooking;
    }

    // Peak-hour bonus: trip within peak window
    if (isPeakHour(tripDate, rules.peakHours)) {
        passengerBase += rules.bonusPeakHour;
    }

    await awardPoints({
        userId: passengerId,
        organizationId,
        basePoints: passengerBase,
        reason: 'RIDE_AS_PASSENGER',
        refId: rideRequestId,
        refModel: 'RideRequest',
        tiers,
        rules,
    });

    // ── Driver earn ─────────────────────────────────────────────────────────
    await awardPoints({
        userId: driverId,
        organizationId,
        basePoints: rules.driverPerPassenger,
        reason: 'DRIVE_TRIP',
        refId: tripId,
        refModel: 'Trip',
        tiers,
        rules,
    });
}
