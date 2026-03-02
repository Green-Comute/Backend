import express from "express";
import { registerEmployee, loginUser, resetPassword, forgotPassword, sendOtp } from "../controllers/authController.js";
import {
    getRegisterOptions,
    verifyRegister,
    getLoginOptions,
    verifyLogin,
} from "../controllers/passkey.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";


/**
 * @fileoverview Authentication Routes
 * @description Defines public authentication endpoints for user registration, login,
 * password reset, and passkey (WebAuthn) authentication.
 * @module routes/authRoutes
 */

const router = express.Router();

// ─── Email OTP ────────────────────────────────────────────────────────────────

/** POST /auth/send-otp — Send 6-digit verification code to email */
router.post("/send-otp", sendOtp);

// ─── Password Auth ────────────────────────────────────────────────────────────

/** POST /auth/register — Register a new employee */
router.post("/register", registerEmployee);

/** POST /auth/login — Authenticate with email + password */
router.post("/login", loginUser);

/** POST /auth/forgot-password — Send password reset email */
router.post("/forgot-password", forgotPassword);

/** POST /auth/reset-password/:token — Reset password using emailed token */
router.post("/reset-password/:token", resetPassword);

// ─── Passkey (WebAuthn) ───────────────────────────────────────────────────────

/**
 * GET /auth/passkey/register-options
 * Protected: user must be logged in to register a passkey on their account
 */
router.get("/passkey/register-options", verifyToken, getRegisterOptions);

/**
 * POST /auth/passkey/register-verify
 * Protected: verifies the authenticator response and saves the credential
 */
router.post("/passkey/register-verify", verifyToken, verifyRegister);

/**
 * GET /auth/passkey/login-options?email=...
 * Public: returns a challenge and the user's allowed credentials
 */
router.get("/passkey/login-options", getLoginOptions);

/**
 * POST /auth/passkey/login-verify
 * Public: verifies the assertion and returns a JWT
 */
router.post("/passkey/login-verify", verifyLogin);

export default router;