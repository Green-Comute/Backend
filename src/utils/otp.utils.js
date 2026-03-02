/**
 * @fileoverview OTP Utility
 * @description In-memory OTP generation and verification.
 * OTPs expire after 5 minutes. For production, use Redis or a database.
 * @module utils/otp.utils
 */

// Map<email, { code: string, expiresAt: number }>
const otpStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a 6-digit OTP for the given email.
 * Overwrites any existing OTP for that email.
 *
 * @param {string} email
 * @returns {string} The 6-digit code
 */
export const generateOTP = (email) => {
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
    otpStore.set(email.toLowerCase(), {
        code,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
    });
    return code;
};

/**
 * Verify an OTP for the given email.
 * On success the OTP is consumed (deleted).
 *
 * @param {string} email
 * @param {string} code
 * @returns {boolean} true if valid
 */
export const verifyOTP = (email, code) => {
    const entry = otpStore.get(email.toLowerCase());
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
        otpStore.delete(email.toLowerCase());
        return false;
    }
    if (entry.code !== code) return false;

    otpStore.delete(email.toLowerCase()); // one-time use
    return true;
};
