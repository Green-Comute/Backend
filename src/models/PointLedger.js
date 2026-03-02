import mongoose from 'mongoose';

/**
 * @fileoverview Point Ledger Model
 * @description Immutable audit log — one document per earn/spend event.
 * Total balance = Σ EARN - Σ SPEND over all rows for a user.
 * Never update or delete rows; insert counter-entries for corrections/refunds.
 * @module models/PointLedger
 */
const pointLedgerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        // EARN = points awarded, SPEND = points deducted
        type: {
            type: String,
            enum: ['EARN', 'SPEND'],
            required: true,
        },
        // Human-readable reason for the event
        reason: {
            type: String,
            required: true,
            enum: [
                'RIDE_AS_PASSENGER',    // 4.1 passenger earns from completed ride
                'DRIVE_TRIP',           // 4.1 driver earns per passenger dropped off
                'BONUS_EARLY_BOOKING',  // 4.1 booked >24h before trip
                'BONUS_PEAK_HOUR',      // 4.1 trip in peak hours
                'REDEMPTION_SPEND',     // 4.10 user redeems reward
                'REDEMPTION_REFUND',    // 4.12 refund when admin rejects redemption
            ],
        },
        // Always positive — sign determined by `type`
        points: {
            type: Number,
            required: true,
            min: 1,
        },
        // Reference to causative document
        refId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        refModel: {
            type: String,
            enum: ['RideRequest', 'Trip', 'Redemption'],
        },
        note: {
            type: String,
        },
    },
    { timestamps: true }
);

// Index for user history page (4.3)
pointLedgerSchema.index({ userId: 1, createdAt: -1 });
// Index for org-wide analytics
pointLedgerSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model('PointLedger', pointLedgerSchema);
