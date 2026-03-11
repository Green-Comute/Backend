import {
  createTicket,
  getMyTickets,
  getTicketById,
} from '../services/support.service.js';

/**
 * @fileoverview Support Controller
 * @description HTTP handlers for in-app support tickets (5.11).
 * File attachment size enforcement is handled by the ticketUpload middleware.
 * @module controllers/support.controller
 */

/**
 * POST /api/support/tickets
 * Create a new support ticket.
 * Body: { issueType, message }  — attachment via multipart/form-data (optional).
 *
 * @route POST /api/support/tickets
 * @access Private
 */
export const createSupportTicket = async (req, res) => {
  try {
    const { issueType, message } = req.body;

    if (!issueType || !message) {
      return res.status(400).json({
        success: false,
        message: 'issueType and message are required',
      });
    }

    // Attachment URL is set if multer processed a file (ticketUpload middleware)
    const attachmentUrl = req.file ? req.file.path : null;

    const ticket = await createTicket(req.user.userId, { issueType, message, attachmentUrl });
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/support/tickets
 * Get all tickets belonging to the authenticated user.
 *
 * @route GET /api/support/tickets
 * @access Private
 */
export const listMyTickets = async (req, res) => {
  try {
    const tickets = await getMyTickets(req.user.userId);
    res.status(200).json({ success: true, data: tickets });
  } catch (err) {
    console.error('listMyTickets error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
};

/**
 * GET /api/support/tickets/:ticketId
 * Get a single ticket by ID (owns must match).
 *
 * @route GET /api/support/tickets/:ticketId
 * @access Private
 */
export const getTicket = async (req, res) => {
  try {
    const ticket = await getTicketById(req.user.userId, req.params.ticketId);
    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};
