import express from "express";
import requireAuth from "../middlewares/auth.middleware.js";
import {
  getDriverRequests,
  approveDriver,
  rejectDriver,
} from "../controllers/adminDriver.controller.js";

/**
 * @fileoverview Driver Approval Routes
 * @description Defines endpoints for organization admins to review and approve driver
 * applications with uploaded documents.
 * @module routes/adminDriver.routes
 */

const router = express.Router();

/**
 * @api {get} /api/org-admin/driver-requests Get Driver Requests
 * @apiDescription Get all pending driver applications with documents
 * @apiPermission org-admin
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiNote Requires ORG_ADMIN role
 */
router.get("/driver-requests", requireAuth, getDriverRequests);

/**
 * @api {post} /api/org-admin/driver-requests/:id/approve Approve Driver
 * @apiDescription Approve driver application and grant driver privileges
 * @apiPermission org-admin
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of user to approve as driver
 * @apiNote Requires ORG_ADMIN role, sets isDriver=true
 */
router.post(
  "/driver-requests/:id/approve",
  requireAuth,
  approveDriver
);

/**
 * @api {post} /api/org-admin/driver-requests/:id/reject Reject Driver
 * @apiDescription Reject driver application with optional reason
 * @apiPermission org-admin
 * @apiHeader {String} Authorization Bearer JWT token
 * @apiParam {String} id MongoDB ObjectId of user to reject
 * @apiBody {String} [reason] Optional rejection reason
 * @apiNote Requires ORG_ADMIN role
 */
router.post(
  "/driver-requests/:id/reject",
  requireAuth,
  rejectDriver
);

export default router;
