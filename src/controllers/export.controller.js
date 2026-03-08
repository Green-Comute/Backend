/**
 * @fileoverview Export Controller — Epic 3.8 (ESG Export Reports)
 * @description Generates downloadable CSV / PDF ESG reports for a date range.
 * @module controllers/export.controller
 */

import { generateCsvExport, generatePdfExport, validateExportDateRange } from '../services/export.service.js';

// ─── GET /export/esg/csv ──────────────────────────────────────────────────────

/**
 * Story 3.8 — CSV ESG Export
 * Query params: startDate, endDate (ISO strings), driverId (optional, platform admin only)
 *
 * @route GET /export/esg/csv
 * @access ORG_ADMIN or PLATFORM_ADMIN
 */
export const exportEsgCsv = async (req, res) => {
  try {
    const { startDate, endDate, driverId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    // Fail-fast date validation before DB query
    validateExportDateRange(startDate, endDate);

    const { role, organizationId } = req.user;
    const scopedOrgId = role === 'PLATFORM_ADMIN' ? null : organizationId;

    const { csv, recordCount } = await generateCsvExport({
      organizationId: scopedOrgId,
      startDate,
      endDate,
      driverId: driverId || null,
    });

    const filename = `esg-report-${startDate}-to-${endDate}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Record-Count', recordCount);
    return res.status(200).send(csv);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('[export.controller] exportEsgCsv error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /export/esg/pdf ──────────────────────────────────────────────────────

/**
 * Story 3.8 — PDF/Text ESG Export
 * Returns a structured plain-text report as a .txt download.
 *
 * @route GET /export/esg/pdf
 * @access ORG_ADMIN or PLATFORM_ADMIN
 */
export const exportEsgPdf = async (req, res) => {
  try {
    const { startDate, endDate, driverId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    validateExportDateRange(startDate, endDate);

    const { role, organizationId } = req.user;
    const scopedOrgId = role === 'PLATFORM_ADMIN' ? null : organizationId;

    const { content, recordCount } = await generatePdfExport({
      organizationId: scopedOrgId,
      startDate,
      endDate,
      driverId: driverId || null,
    });

    const filename = `esg-report-${startDate}-to-${endDate}.txt`;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Record-Count', recordCount);
    return res.status(200).send(content);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('[export.controller] exportEsgPdf error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
