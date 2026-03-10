import express from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  block,
  unblock,
  listBlocked,
  addContact,
  listContacts,
  removeContact,
  reportIncident,
  womenOnlyFilter,
} from '../controllers/safety.controller.js';

/**
 * @fileoverview Safety Routes
 * @description Routes for user blocking (5.4), emergency contacts (5.5),
 * live trip sharing (5.6), incident reports (5.7), and women-only filter (5.8).
 * @module routes/safety.routes
 */

const router = express.Router();

// 5.4 – User Blocking
router.post('/block', verifyToken, block);
router.delete('/block/:blockedId', verifyToken, unblock);
router.get('/block', verifyToken, listBlocked);

// 5.5 – Emergency Contacts
router.post('/emergency-contacts', verifyToken, addContact);
router.get('/emergency-contacts', verifyToken, listContacts);
router.delete('/emergency-contacts/:contactId', verifyToken, removeContact);

// 5.7 – Safety Incident Reports
router.post('/incidents', verifyToken, reportIncident);

// 5.8 – Women-only ride filter
router.post('/women-only/filter', verifyToken, womenOnlyFilter);

export default router;
