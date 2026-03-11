import SupportTicket from '../models/SupportTicket.js';

/**
 * @fileoverview Support Service
 * @description Handles in-app support ticket creation and retrieval (5.11).
 * Attachment size validation is enforced by the upload middleware (≤ 5 MB).
 * @module services/support.service
 */

const VALID_ISSUE_TYPES = ['BILLING', 'SAFETY', 'DRIVER', 'TECHNICAL', 'OTHER'];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a new support ticket.
 *
 * @param {string} userId
 * @param {{ issueType: string, message: string, attachmentUrl?: string }} data
 * @returns {Promise<SupportTicket>}
 * @throws {Error} statusCode 400 for invalid input.
 */
export async function createTicket(userId, { issueType, message, attachmentUrl }) {
  if (!issueType || !VALID_ISSUE_TYPES.includes(issueType)) {
    const err = new Error(`issueType must be one of: ${VALID_ISSUE_TYPES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    const err = new Error('message must be at least 10 characters');
    err.statusCode = 400;
    throw err;
  }

  return SupportTicket.create({
    userId,
    issueType,
    message: message.trim(),
    attachmentUrl: attachmentUrl || null,
  });
}

/**
 * Get all tickets for the authenticated user (newest first).
 *
 * @param {string} userId
 * @returns {Promise<SupportTicket[]>}
 */
export async function getMyTickets(userId) {
  return SupportTicket.find({ userId }).sort({ createdAt: -1 }).lean();
}

/**
 * Get a single ticket by ID. Only the owning user may retrieve it.
 *
 * @param {string} userId - Requesting user.
 * @param {string} ticketId
 * @returns {Promise<SupportTicket>}
 * @throws {Error} statusCode 404 if ticket not found or does not belong to user.
 */
export async function getTicketById(userId, ticketId) {
  const ticket = await SupportTicket.findOne({ _id: ticketId, userId }).lean();
  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  return ticket;
}
