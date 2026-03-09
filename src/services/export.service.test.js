/**
 * @fileoverview Unit Tests — export.service.js (Story 3.8)
 * Tests validateExportDateRange (pure function, no DB deps) exhaustively.
 * generateCsvExport integration is covered in the controller integration tests.
 */

import { validateExportDateRange } from '../services/export.service.js';

// ─── validateExportDateRange ─────────────────────────────────────────────────

describe('validateExportDateRange', () => {
  test('does not throw for a valid 1-day range', () => {
    const start = new Date();
    const end   = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(() => validateExportDateRange(start, end)).not.toThrow();
  });

  test('does not throw for a 365-day range (max boundary)', () => {
    const start = new Date('2024-01-01');
    const end   = new Date('2024-12-31');
    expect(() => validateExportDateRange(start, end)).not.toThrow();
  });

  test('throws when range exceeds 365 days', () => {
    const start = new Date('2024-01-01');
    const end   = new Date('2025-01-02'); // 366+ days
    expect(() => validateExportDateRange(start, end)).toThrow(/cannot exceed/);
  });

  test('error message includes max days allowed (365)', () => {
    let caught = null;
    try { validateExportDateRange(new Date('2020-01-01'), new Date('2022-01-01')); }
    catch (err) { caught = err; }
    expect(caught).not.toBeNull();
    expect(caught.message).toContain('365');
  });

  test('error message includes actual days requested', () => {
    let caught = null;
    try { validateExportDateRange('2020-01-01', '2022-01-01'); }
    catch (err) { caught = err; }
    expect(caught).not.toBeNull();
    expect(caught.message).toMatch(/\d+ days/);
  });

  test('throws when startDate is after endDate', () => {
    const start = new Date('2024-06-01');
    const end   = new Date('2024-01-01');
    expect(() => validateExportDateRange(start, end)).toThrow(/before endDate/);
  });

  test('throws when startDate is an invalid date string', () => {
    expect(() => validateExportDateRange('not-a-date', new Date())).toThrow(/invalid/i);
  });

  test('throws when endDate is an invalid date string', () => {
    expect(() => validateExportDateRange(new Date(), 'not-a-date')).toThrow(/invalid/i);
  });

  test('accepts ISO string dates within range', () => {
    expect(() =>
      validateExportDateRange('2024-01-01T00:00:00Z', '2024-03-01T00:00:00Z')
    ).not.toThrow();
  });

  test('same start and end date (0-day range) does not throw', () => {
    const d = new Date('2024-06-15');
    expect(() => validateExportDateRange(d, d)).not.toThrow();
  });
});


// ─── validateExportDateRange ─────────────────────────────────────────────────

describe('validateExportDateRange', () => {
  test('does not throw for a valid 1-day range', () => {
    const start = new Date();
    const end   = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(() => validateExportDateRange(start, end)).not.toThrow();
  });

  test('does not throw for a 365-day range (boundary)', () => {
    const start = new Date('2024-01-01');
    const end   = new Date('2024-12-31');
    expect(() => validateExportDateRange(start, end)).not.toThrow();
  });

  test('throws when range exceeds 365 days', () => {
    const start = new Date('2024-01-01');
    const end   = new Date('2025-01-02'); // 366+ days
    expect(() => validateExportDateRange(start, end)).toThrow(/cannot exceed/);
  });

  test('throws when startDate is after endDate', () => {
    const start = new Date('2024-06-01');
    const end   = new Date('2024-01-01');
    expect(() => validateExportDateRange(start, end)).toThrow(/before endDate/);
  });

  test('throws when startDate is invalid', () => {
    expect(() => validateExportDateRange('not-a-date', new Date())).toThrow(/invalid/i);
  });

  test('throws when endDate is invalid', () => {
    expect(() => validateExportDateRange(new Date(), 'not-a-date')).toThrow(/invalid/i);
  });

  test('throws when error message mentions actual day count', () => {
    const start = '2020-01-01';
    const end   = '2022-01-01'; // ~730 days
    try {
      validateExportDateRange(start, end);
      throw new Error('Expected validateExportDateRange to throw');
    } catch (err) {
      expect(err.message).toMatch(/730|731/);
    }
  });
});
