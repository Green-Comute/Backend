import express from "express";
import requireAuth from "../middlewares/auth.middleware.js";
import {
  getMyProfile,
  completeProfile,
  requestDriverAccess,
} from "../controllers/user.controller.js";

/**
 * @fileoverview User Profile Routes
 * @description Defines authenticated user profile management endpoints including
 * profile retrieval, profile completion, and driver access requests.
 * @module routes/user.routes
 */

const router = express.Router();

/**
 * @api {get} /api/users/me Get User Profile
 * @apiDescription Retrieve authenticated user's complete profile
 * @apiPermission authenticated
 * @apiHeader {String} Authorization Bearer JWT token
 */
router.get("/me", requireAuth, getMyProfile);

/**
 * @api {put} /api/users/complete-profile Complete Profile
 * @apiDescription Complete user profile with personal details (first-time only)
 * @apiPermission authenticated
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiBody {String} name Full name
 * @apiBody {String} dob Date of birth
 * @apiBody {String} gender Gender
 * @apiBody {String} homeAddress Home address
 * @apiBody {String} workAddress Work address
 * @apiBody {String} [emergencyContactName] Emergency contact name (optional)
 * @apiBody {String} [emergencyContactPhone] Emergency contact phone (optional)
 */
router.put("/complete-profile", requireAuth, completeProfile);

/**
 * @api {post} /api/users/driver-intent Request Driver Access
 * @apiDescription Employee requests to become a driver
 * @apiPermission authenticated
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiNote Requires completed profile. Must upload documents after request.
 */
router.post("/driver-intent", requireAuth, requestDriverAccess);

export default router;
