import IncidentReport from '../models/IncidentReport.js';
import SafetyGuideline from '../models/SafetyGuideline.js';

/**
 * @fileoverview Moderation Service
 * @description Admin-level operations: incident review (5.14) and
 * safety guideline publishing / acceptance (5.13).
 * @module services/moderation.service
 */

const VALID_ACTIONS = ['WARN', 'INVESTIGATE', 'SUSPEND'];

// ─── Incident Review (5.14) ──────────────────────────────────────────────────

/**
 * Get incident reports with optional status filter.
 *
 * @param {{ status?: string, page?: number }} filters
 * @returns {Promise<{ reports: IncidentReport[], total: number }>}
 */
export async function getIncidentReports({ status, page = 1 } = {}) {
  const query = {};
  if (status) query.status = status;

  const limit = 20;
  const skip = (Math.max(1, page) - 1) * limit;

  const [reports, total] = await Promise.all([
    IncidentReport.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    IncidentReport.countDocuments(query),
  ]);

  return { reports, total };
}

/**
 * Record an admin action on an incident report (5.14).
 * All actions are logged; automatic bans are never issued.
 *
 * @param {string} adminId - The admin performing the action.
 * @param {string} incidentId
 * @param {'WARN'|'INVESTIGATE'|'SUSPEND'} action
 * @param {string} note - Required narrative note.
 * @returns {Promise<IncidentReport>} Updated incident document.
 * @throws {Error} statusCode 400 for invalid action or missing note.
 * @throws {Error} statusCode 404 if incident not found.
 */
export async function reviewIncident(adminId, incidentId, action, note) {
  if (!VALID_ACTIONS.includes(action)) {
    const err = new Error(`action must be one of: ${VALID_ACTIONS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  if (!note || note.trim().length < 5) {
    const err = new Error('A note of at least 5 characters is required');
    err.statusCode = 400;
    throw err;
  }

  const report = await IncidentReport.findById(incidentId);
  if (!report) {
    const err = new Error('Incident report not found');
    err.statusCode = 404;
    throw err;
  }

  report.adminNotes.push({ adminId, action, note: note.trim() });

  // Update status automatically based on action
  if (action === 'INVESTIGATE') report.status = 'UNDER_REVIEW';
  if (action === 'SUSPEND' || action === 'WARN') report.status = 'RESOLVED';

  await report.save();
  return report;
}

// ─── Safety Guidelines (5.13) ───────────────────────────────────────────────

/**
 * Publish a new safety guideline version.
 * Previous active guideline is deactivated.
 *
 * @param {string} adminId
 * @param {{ title: string, content: string }} data
 * @returns {Promise<SafetyGuideline>}
 */
export async function publishGuideline(adminId, { title, content }) {
  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    const err = new Error('title must be at least 3 characters');
    err.statusCode = 400;
    throw err;
  }

  if (!content || typeof content !== 'string' || content.trim().length < 10) {
    const err = new Error('content must be at least 10 characters');
    err.statusCode = 400;
    throw err;
  }

  // Determine next version number
  const latest = await SafetyGuideline.findOne().sort({ version: -1 }).lean();
  const nextVersion = latest ? latest.version + 1 : 1;

  // Deactivate all current guidelines
  await SafetyGuideline.updateMany({ isActive: true }, { $set: { isActive: false } });

  const guideline = await SafetyGuideline.create({
    title: title.trim(),
    content: content.trim(),
    version: nextVersion,
    publishedBy: adminId,
    isActive: true,
  });

  return guideline;
}

/**
 * Get the currently active safety guideline.
 *
 * @returns {Promise<SafetyGuideline|null>}
 */
export async function getActiveGuideline() {
  return SafetyGuideline.findOne({ isActive: true }).lean();
}

/**
 * Record a user's acceptance of the current guideline version.
 *
 * @param {string} userId
 * @param {string} guidelineId
 * @returns {Promise<{ accepted: boolean }>}
 * @throws {Error} statusCode 404 if guideline not found or not active.
 * @throws {Error} statusCode 409 if user already accepted this version.
 */
export async function acceptGuideline(userId, guidelineId) {
  const guideline = await SafetyGuideline.findById(guidelineId);
  if (!guideline || !guideline.isActive) {
    const err = new Error('Guideline not found or no longer active');
    err.statusCode = 404;
    throw err;
  }

  const alreadyAccepted = guideline.acceptances.some(
    a => a.userId.toString() === userId.toString()
  );
  if (alreadyAccepted) {
    const err = new Error('You have already accepted this version');
    err.statusCode = 409;
    throw err;
  }

  guideline.acceptances.push({ userId });
  await guideline.save();

  return { accepted: true };
}

/**
 * Check whether a user has accepted the latest guideline version.
 *
 * @param {string} userId
 * @returns {Promise<{ required: boolean, guidelineId: string|null, version: number|null }>}
 */
export async function checkGuidelineAcceptance(userId) {
  const guideline = await SafetyGuideline.findOne({ isActive: true }).lean();
  if (!guideline) return { required: false, guidelineId: null, version: null };

  const accepted = guideline.acceptances.some(
    a => a.userId.toString() === userId.toString()
  );

  return {
    required: !accepted,
    guidelineId: String(guideline._id),
    version: guideline.version,
  };
}
