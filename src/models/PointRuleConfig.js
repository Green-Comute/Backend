import mongoose from 'mongoose';

/**
 * @fileoverview Point Rule Configuration Model
 * @description Global (organizationId=null) and per-org point earning rules.
 * Org-level config overrides platform default. Only PLATFORM_ADMIN edits global (4.14).
 * Rule changes are future-only (4.14 constraint) — existing ledger rows are untouched.
 * @module models/PointRuleConfig
 */
const peakHourSchema = new mongoose.Schema(
    {
        start: { type: String, default: '08:00' }, // HH:MM 24h
        end: { type: String, default: '10:00' }, // HH:MM 24h
    },
    { _id: false }
);

const pointRuleConfigSchema = new mongoose.Schema(
    {
        // null = platform global default; ObjectId = org-specific rules
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
        },
        rules: {
            // Base points per completed ride as passenger
            passengerPerRide: { type: Number, default: 10, min: 0 },
            // Points per passenger the driver drops off
            driverPerPassenger: { type: Number, default: 5, min: 0 },
            // Bonus if ride was requested > 24h before scheduledTime
            bonusEarlyBooking: { type: Number, default: 3, min: 0 },
            // Bonus if the trip's scheduledTime falls inside a peak-hour window
            bonusPeakHour: { type: Number, default: 5, min: 0 },
            // Maximum points a user can earn per calendar day (UTC)
            dailyCap: { type: Number, default: 50, min: 1 },
            // Array of peak-hour windows (typically morning + evening commute)
            peakHours: {
                type: [peakHourSchema],
                default: [
                    { start: '08:00', end: '10:00' },
                    { start: '17:00', end: '19:00' },
                ],
            },
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// One config per org (or one global null entry)
pointRuleConfigSchema.index({ organizationId: 1 }, { unique: true, sparse: true });

export default mongoose.model('PointRuleConfig', pointRuleConfigSchema);
