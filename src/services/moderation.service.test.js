/**
 * @fileoverview Moderation Service Tests
 * @description Unit tests for admin incident review and safety guideline management.
 * Uses Jest mocks for Mongoose models.
 */

import { jest } from '@jest/globals';

// ─── Mock Models ─────────────────────────────────────────────────────────────

const mockIRFind = jest.fn();
const mockIRCountDocuments = jest.fn();
const mockIRFindById = jest.fn();

const mockSGFindOne = jest.fn();
const mockSGCreate = jest.fn();
const mockSGUpdateMany = jest.fn();

jest.unstable_mockModule('../models/IncidentReport.js', () => ({
  default: {
    find: mockIRFind,
    countDocuments: mockIRCountDocuments,
    findById: mockIRFindById,
  },
}));

jest.unstable_mockModule('../models/SafetyGuideline.js', () => ({
  default: {
    findOne: mockSGFindOne,
    create: mockSGCreate,
    updateMany: mockSGUpdateMany,
  },
}));

const {
  getIncidentReports,
  reviewIncident,
  publishGuideline,
  getActiveGuideline,
  acceptGuideline,
  checkGuidelineAcceptance,
} = await import('../services/moderation.service.js');

// ─── getIncidentReports ──────────────────────────────────────────────────────

describe('getIncidentReports', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns paginated incident reports', async () => {
    const reports = [{ _id: 'r1' }];
    mockIRFind.mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: () => reports }) }) }),
    });
    mockIRCountDocuments.mockResolvedValue(1);
    const result = await getIncidentReports({});
    expect(result.reports).toEqual(reports);
    expect(result.total).toBe(1);
  });

  test('applies status filter when provided', async () => {
    mockIRFind.mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: () => [] }) }) }),
    });
    mockIRCountDocuments.mockResolvedValue(0);
    await getIncidentReports({ status: 'PENDING' });
    expect(mockIRFind).toHaveBeenCalledWith({ status: 'PENDING' });
  });
});

// ─── reviewIncident ──────────────────────────────────────────────────────────

describe('reviewIncident', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 400 for invalid action', async () => {
    await expect(
      reviewIncident('admin1', 'inc1', 'BAN', 'some note')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for missing or too-short note', async () => {
    await expect(
      reviewIncident('admin1', 'inc1', 'WARN', 'hi')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 404 if incident not found', async () => {
    mockIRFindById.mockResolvedValue(null);
    await expect(
      reviewIncident('admin1', 'inc1', 'WARN', 'Valid note here')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('appends admin action and saves', async () => {
    const report = {
      _id: 'r1',
      status: 'PENDING',
      adminNotes: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockIRFindById.mockResolvedValue(report);
    await reviewIncident('admin1', 'r1', 'INVESTIGATE', 'Looking into this');
    expect(report.adminNotes).toHaveLength(1);
    expect(report.adminNotes[0]).toMatchObject({ action: 'INVESTIGATE' });
    expect(report.status).toBe('UNDER_REVIEW');
    expect(report.save).toHaveBeenCalled();
  });

  test('sets status to RESOLVED on WARN action', async () => {
    const report = {
      status: 'PENDING',
      adminNotes: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockIRFindById.mockResolvedValue(report);
    await reviewIncident('admin1', 'r1', 'WARN', 'Warning issued here');
    expect(report.status).toBe('RESOLVED');
  });

  test('does NOT allow automatic bans (SUSPEND sets RESOLVED not BANNED)', async () => {
    const report = {
      status: 'PENDING',
      adminNotes: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockIRFindById.mockResolvedValue(report);
    await reviewIncident('admin1', 'r1', 'SUSPEND', 'Suspended pending review');
    expect(report.status).toBe('RESOLVED');
    expect(report.status).not.toBe('BANNED');
  });
});

// ─── publishGuideline ────────────────────────────────────────────────────────

describe('publishGuideline', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 400 for too-short title', async () => {
    await expect(
      publishGuideline('admin1', { title: 'Ab', content: 'Some valid content here' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for too-short content', async () => {
    await expect(
      publishGuideline('admin1', { title: 'Valid Title', content: 'Short' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('publishes first guideline with version 1', async () => {
    mockSGFindOne.mockReturnValue({ sort: () => ({ lean: () => null }) });
    mockSGUpdateMany.mockResolvedValue({});
    const guideline = { _id: 'g1', version: 1 };
    mockSGCreate.mockResolvedValue(guideline);
    const result = await publishGuideline('admin1', {
      title: 'Safety Rules',
      content: 'Always wear a seatbelt and follow traffic rules.',
    });
    expect(result.version).toBe(1);
  });

  test('increments version for subsequent guidelines', async () => {
    mockSGFindOne.mockReturnValue({ sort: () => ({ lean: () => ({ version: 3 }) }) });
    mockSGUpdateMany.mockResolvedValue({});
    mockSGCreate.mockResolvedValue({ version: 4 });
    const result = await publishGuideline('admin1', {
      title: 'Updated Safety Rules',
      content: 'Always follow updated safety guidelines for your protection.',
    });
    expect(result.version).toBe(4);
  });

  test('deactivates previous guidelines before publishing', async () => {
    mockSGFindOne.mockReturnValue({ sort: () => ({ lean: () => ({ version: 1 }) }) });
    mockSGUpdateMany.mockResolvedValue({});
    mockSGCreate.mockResolvedValue({ version: 2 });
    await publishGuideline('admin1', {
      title: 'New Rules v2',
      content: 'Please follow these new rules carefully and completely.',
    });
    expect(mockSGUpdateMany).toHaveBeenCalledWith(
      { isActive: true },
      { $set: { isActive: false } }
    );
  });
});

// ─── acceptGuideline ────────────────────────────────────────────────────────

describe('acceptGuideline', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 if guideline not found or not active', async () => {
    mockSGFindOne.mockResolvedValue(null);
    // findById is used here - we need to add it
    jest.unstable_mockModule('../models/SafetyGuideline.js', () => ({
      default: {
        findById: jest.fn().mockResolvedValue(null),
        findOne: mockSGFindOne,
        create: mockSGCreate,
        updateMany: mockSGUpdateMany,
      },
    }));
    // Re-import after mock update isn't feasible in this setup,
    // so test that the service throws when guideline is null/inactive:
    const SafetyGuideline = (await import('../models/SafetyGuideline.js')).default;
    const origFindById = SafetyGuideline.findById;
    SafetyGuideline.findById = jest.fn().mockResolvedValue(null);
    await expect(acceptGuideline('u1', 'g1')).rejects.toMatchObject({ statusCode: 404 });
    SafetyGuideline.findById = origFindById;
  });

  test('records user acceptance', async () => {
    const guideline = {
      _id: 'g1',
      isActive: true,
      acceptances: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const SafetyGuideline = (await import('../models/SafetyGuideline.js')).default;
    SafetyGuideline.findById = jest.fn().mockResolvedValue(guideline);
    const result = await acceptGuideline('u1', 'g1');
    expect(result).toEqual({ accepted: true });
    expect(guideline.acceptances).toHaveLength(1);
  });
});

// ─── checkGuidelineAcceptance ────────────────────────────────────────────────

describe('checkGuidelineAcceptance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns required=false when no active guideline exists', async () => {
    mockSGFindOne.mockReturnValue({ lean: () => null });
    const result = await checkGuidelineAcceptance('u1');
    expect(result.required).toBe(false);
  });

  test('returns required=true when user has not accepted', async () => {
    mockSGFindOne.mockReturnValue({
      lean: () => ({ _id: 'g1', version: 1, acceptances: [] }),
    });
    const result = await checkGuidelineAcceptance('u1');
    expect(result.required).toBe(true);
  });

  test('returns required=false when user has accepted', async () => {
    mockSGFindOne.mockReturnValue({
      lean: () => ({
        _id: 'g1',
        version: 1,
        acceptances: [{ userId: 'u1' }],
      }),
    });
    const result = await checkGuidelineAcceptance('u1');
    expect(result.required).toBe(false);
  });
});

// ─── getActiveGuideline ──────────────────────────────────────────────────────

describe('getActiveGuideline', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the active guideline', async () => {
    const guideline = { _id: 'g1', title: 'Safety Rules', isActive: true };
    mockSGFindOne.mockReturnValue({ lean: () => guideline });
    const result = await getActiveGuideline();
    expect(result).toMatchObject({ _id: 'g1', isActive: true });
    expect(mockSGFindOne).toHaveBeenCalledWith({ isActive: true });
  });

  test('returns null when no active guideline exists', async () => {
    mockSGFindOne.mockReturnValue({ lean: () => null });
    const result = await getActiveGuideline();
    expect(result).toBeNull();
  });
});
