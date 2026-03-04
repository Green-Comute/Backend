import express from 'express';
import { getMockTrip } from '../controllers/mockTrip.controller.js';

const router = express.Router();

// GET /api/mock/trip - Get mock trip with passengers for testing
router.get('/trip', getMockTrip);

export default router;
