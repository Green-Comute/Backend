import express from "express";
import requireAuth from "../middlewares/auth.middleware.js";
import requirePlatformAdmin from "../middlewares/platform.middleware.js";
import {
  createOrganization,
  createOrgAdmin,
  listOrganizations,
} from "../controllers/platform.controller.js";

/**
 * @fileoverview Platform Administration Routes
 * @description Defines super-admin level endpoints for platform management including
 * organization and organization admin creation. Highest privilege level.
 * @module routes/platform.routes
 */

const router = express.Router();

/**
 * @api {get} /platform/organizations List All Organizations
 * @apiPermission platform-admin
 */
router.get(
  "/organizations",
  requireAuth,
  requirePlatformAdmin,
  listOrganizations
);

/**
 * @api {post} /platform/organizations Create Organization
 * @apiPermission platform-admin
 */
router.post(
  "/organizations",
  requireAuth,
  requirePlatformAdmin,
  createOrganization
);

/**
 * @api {post} /api/platform/org-admins Create Organization Admin
 * @apiDescription Create an organization admin user
 * @apiPermission platform-admin
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiBody {String} email Admin email address
 * @apiBody {String} phone Admin phone number
 * @apiBody {String} password Admin password
 * @apiBody {String} orgCode Organization code to associate admin with
 * @apiNote Requires PLATFORM_ADMIN role - super admin only
 */
router.post(
  "/org-admins",
  requireAuth,
  requirePlatformAdmin,
  createOrgAdmin
);

export default router;