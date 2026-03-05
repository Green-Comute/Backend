import express from 'express';
import {
  createPickupZone,
  getAllPickupZones,
  getPickupZoneById,
  getNearbyPickupZones,
  updatePickupZone,
  deletePickupZone,
  acceptSuggestedZone
} from '../controllers/smartPickupZone.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import requirePlatformAdmin from '../middlewares/platform.middleware.js';

const router = express.Router();

/**
 * @fileoverview Smart Pickup Zone Routes
 * @description API routes for managing smart pickup zones
 * @module routes/smartPickupZone.routes
 */

/**
 * Public Routes
 */

// Get all pickup zones (public/org-filtered)
router.get('/', getAllPickupZones);

// Get nearby pickup zones
router.get('/nearby', getNearbyPickupZones);

// Get single pickup zone by ID
router.get('/:id', getPickupZoneById);

/**
 * Protected Routes - Require Authentication
 */

// Accept suggested pickup zone (passenger)
router.post('/accept/:rideRequestId', verifyToken, acceptSuggestedZone);

/**
 * Admin Routes - Platform Admin or Org Admin
 * 
 * Note: Using requirePlatformAdmin for now. In production, you may want to create
 * a combined middleware that allows both platform admins and org admins
 */

// Create new pickup zone
router.post('/', verifyToken, requirePlatformAdmin, createPickupZone);

// Update pickup zone
router.put('/:id', verifyToken, requirePlatformAdmin, updatePickupZone);

// Delete/deactivate pickup zone
router.delete('/:id', verifyToken, requirePlatformAdmin, deletePickupZone);

export default router;
