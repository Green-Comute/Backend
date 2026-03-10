/**
 * @fileoverview Support Service Tests
 * @description Unit tests for ticket creation, retrieval, and validation.
 * Uses Jest mocks for Mongoose models.
 */

import { jest } from '@jest/globals';

// ─── Mock Models ─────────────────────────────────────────────────────────────

const mockSTCreate = jest.fn();
const mockSTFind = jest.fn();
const mockSTFindOne = jest.fn();

jest.unstable_mockModule('../models/SupportTicket.js', () => ({
  default: {
    create: mockSTCreate,
    find: mockSTFind,
    findOne: mockSTFindOne,
  },
}));

const { createTicket, getMyTickets, getTicketById } = await import(
  '../services/support.service.js'
);

// ─── createTicket ─────────────────────────────────────────────────────────────

describe('createTicket', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 400 for invalid issueType', async () => {
    await expect(
      createTicket('u1', { issueType: 'UNKNOWN', message: 'Some long message here' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 for missing message', async () => {
    await expect(
      createTicket('u1', { issueType: 'BILLING', message: '' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throws 400 when message is too short (< 10 chars)', async () => {
    await expect(
      createTicket('u1', { issueType: 'OTHER', message: 'Short' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('creates ticket successfully with valid input', async () => {
    const ticket = { _id: 'tk1', issueType: 'BILLING', message: 'My billing question' };
    mockSTCreate.mockResolvedValue(ticket);
    const result = await createTicket('u1', {
      issueType: 'BILLING',
      message: 'My billing question',
    });
    expect(result).toMatchObject({ _id: 'tk1' });
    expect(mockSTCreate).toHaveBeenCalledTimes(1);
  });

  test('stores attachmentUrl when provided', async () => {
    mockSTCreate.mockResolvedValue({ attachmentUrl: '/uploads/support-tickets/file.pdf' });
    await createTicket('u1', {
      issueType: 'SAFETY',
      message: 'This is a safety report',
      attachmentUrl: '/uploads/support-tickets/file.pdf',
    });
    expect(mockSTCreate).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentUrl: '/uploads/support-tickets/file.pdf' })
    );
  });

  test('sets attachmentUrl to null when not provided', async () => {
    mockSTCreate.mockResolvedValue({});
    await createTicket('u1', { issueType: 'TECHNICAL', message: 'Technical issue here' });
    expect(mockSTCreate).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentUrl: null })
    );
  });
});

// ─── getMyTickets ─────────────────────────────────────────────────────────────

describe('getMyTickets', () => {
  test('returns tickets sorted newest first', async () => {
    const tickets = [{ _id: 'tk2' }, { _id: 'tk1' }];
    mockSTFind.mockReturnValue({ sort: () => ({ lean: () => tickets }) });
    const result = await getMyTickets('u1');
    expect(result).toEqual(tickets);
  });
});

// ─── getTicketById ────────────────────────────────────────────────────────────

describe('getTicketById', () => {
  beforeEach(() => jest.clearAllMocks());

  test('throws 404 if ticket not found or does not belong to user', async () => {
    mockSTFindOne.mockReturnValue({ lean: () => null });
    await expect(getTicketById('u1', 'badId')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('returns ticket when it belongs to the user', async () => {
    const ticket = { _id: 'tk1', userId: 'u1' };
    mockSTFindOne.mockReturnValue({ lean: () => ticket });
    const result = await getTicketById('u1', 'tk1');
    expect(result).toMatchObject({ _id: 'tk1' });
  });
});
