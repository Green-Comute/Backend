import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import User from "../models/User.js";
import { generateToken } from "../services/token.service.js";

// ─── Config ──────────────────────────────────────────────────────────────────
// rpID must match the domain serving the app (localhost for dev)
const RP_ID = process.env.RP_ID || "localhost";
const RP_NAME = process.env.RP_NAME || "GreenCommute";
const ORIGIN = process.env.FRONTEND_URL || "http://localhost:5173";

// Temporary in-memory challenge store keyed by userId (string)
// For production, store in DB or Redis with a short TTL
const challengeStore = new Map();

// ─── Register: Step 1 ────────────────────────────────────────────────────────
/**
 * GET /auth/passkey/register-options
 * Protected — requires JWT (user must be logged in)
 * Generates a WebAuthn registration challenge for the authenticated user.
 */
export const getRegisterOptions = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Build list of already-registered credential IDs to avoid re-registering same device
        const excludeCredentials = (user.passkeys || []).map((pk) => ({
            id: pk.credentialID,
            type: "public-key",
            transports: pk.transports || [],
        }));

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userName: user.email,
            userDisplayName: user.name || user.email,
            attestationType: "none",           // no vendor attestation needed
            excludeCredentials,
            authenticatorSelection: {
                residentKey: "preferred",         // enables passkey (discoverable)
                userVerification: "preferred",    // Touch ID / Face ID / PIN
            },
        });

        // Store challenge temporarily, keyed by userId
        challengeStore.set(user._id.toString(), options.challenge);

        return res.json(options);
    } catch (err) {
        console.error("getRegisterOptions error:", err);
        return res.status(500).json({ message: "Failed to generate registration options" });
    }
};

// ─── Register: Step 2 ────────────────────────────────────────────────────────
/**
 * POST /auth/passkey/register-verify
 * Protected — requires JWT
 * Verifies the authenticator response and saves the new passkey credential.
 */
export const verifyRegister = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const expectedChallenge = challengeStore.get(user._id.toString());
        if (!expectedChallenge) {
            return res.status(400).json({ message: "No pending challenge. Request registration options first." });
        }

        let verification;
        try {
            verification = await verifyRegistrationResponse({
                response: req.body,
                expectedChallenge,
                expectedOrigin: ORIGIN,
                expectedRPID: RP_ID,
            });
        } catch (err) {
            console.error("verifyRegistrationResponse failed:", err);
            return res.status(400).json({ message: err.message });
        }

        // Clean up challenge
        challengeStore.delete(user._id.toString());

        if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({ message: "Registration verification failed" });
        }

        const { credential } = verification.registrationInfo;

        // Save the new passkey to the user document
        user.passkeys.push({
            credentialID: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString("base64url"),
            counter: credential.counter,
            transports: req.body.response?.transports || [],
        });

        await user.save();

        return res.json({ verified: true, message: "Passkey registered successfully" });
    } catch (err) {
        console.error("verifyRegister error:", err);
        return res.status(500).json({ message: "Registration verification failed" });
    }
};

// ─── Login: Step 1 ───────────────────────────────────────────────────────────
/**
 * GET /auth/passkey/login-options?email=...
 * Public — no JWT needed
 * Generates a WebAuthn authentication challenge for a user identified by email.
 */
export const getLoginOptions = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !user.passkeys || user.passkeys.length === 0) {
            return res.status(404).json({ message: "No passkeys registered for this account" });
        }

        // Approval gate — same as password login
        if (user.approvalStatus !== "APPROVED") {
            return res.status(403).json({
                message: "Your account is awaiting organization admin approval.",
                approvalStatus: user.approvalStatus,
            });
        }

        const allowCredentials = user.passkeys.map((pk) => ({
            id: pk.credentialID,
            type: "public-key",
            transports: pk.transports || [],
        }));

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: "preferred",
            allowCredentials,
        });

        // Store challenge keyed by userId
        challengeStore.set(user._id.toString(), options.challenge);

        // Also embed the userId in response so the client sends it back
        return res.json({ ...options, userId: user._id.toString() });
    } catch (err) {
        console.error("getLoginOptions error:", err);
        return res.status(500).json({ message: "Failed to generate authentication options" });
    }
};

// ─── Login: Step 2 ───────────────────────────────────────────────────────────
/**
 * POST /auth/passkey/login-verify
 * Public — no JWT needed
 * Verifies the authenticator assertion and returns a JWT on success.
 */
export const verifyLogin = async (req, res) => {
    try {
        const { userId, ...assertionResponse } = req.body;

        if (!userId) return res.status(400).json({ message: "userId is required" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const expectedChallenge = challengeStore.get(userId);
        if (!expectedChallenge) {
            return res.status(400).json({ message: "No pending challenge. Request login options first." });
        }

        // Find the matching passkey by credentialID
        const credentialID = assertionResponse.id;
        const storedPasskey = user.passkeys.find((pk) => pk.credentialID === credentialID);

        if (!storedPasskey) {
            return res.status(400).json({ message: "Passkey not recognised" });
        }

        let verification;
        try {
            verification = await verifyAuthenticationResponse({
                response: assertionResponse,
                expectedChallenge,
                expectedOrigin: ORIGIN,
                expectedRPID: RP_ID,
                credential: {
                    id: storedPasskey.credentialID,
                    publicKey: Buffer.from(storedPasskey.publicKey, "base64url"),
                    counter: storedPasskey.counter,
                    transports: storedPasskey.transports,
                },
            });
        } catch (err) {
            console.error("verifyAuthenticationResponse failed:", err);
            return res.status(400).json({ message: err.message });
        }

        // Clean up challenge
        challengeStore.delete(userId);

        if (!verification.verified) {
            return res.status(401).json({ message: "Authentication failed" });
        }

        // Update counter to prevent replay attacks
        storedPasskey.counter = verification.authenticationInfo.newCounter;
        await user.save();

        // Issue JWT exactly like password login
        const token = generateToken({
            userId: user._id,
            role: user.role,
            organizationId: user.organizationId || null,
            isDriver: user.isDriver || false,
        });

        return res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                approvalStatus: user.approvalStatus,
                profileCompleted: user.profileCompleted,
                isDriver: user.isDriver || false,
            },
        });
    } catch (err) {
        console.error("verifyLogin error:", err);
        return res.status(500).json({ message: "Login verification failed" });
    }
};
