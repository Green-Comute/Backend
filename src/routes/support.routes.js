import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { handleTicketUpload } from '../middlewares/ticketUpload.middleware.js';
import {
  createSupportTicket,
  listMyTickets,
  getTicket,
} from '../controllers/support.controller.js';

/**
 * @fileoverview Support Routes
 * @description Routes for in-app support ticket system (5.11).
 * @module routes/support.routes
 */

const router = express.Router();

// 5.11 – Support Tickets
router.post('/tickets', verifyToken, handleTicketUpload, createSupportTicket);
router.get('/tickets', verifyToken, listMyTickets);
router.get('/tickets/:ticketId', verifyToken, getTicket);

export default router;
