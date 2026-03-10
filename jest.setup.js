/**
 * @fileoverview Jest global setup
 * @description Runs before all test suites. Mocks Redis to avoid ECONNREFUSED
 *   errors and configures Mongoose to fail buffered operations quickly (500 ms)
 *   so controller tests that reach the DB layer get a fast 500 response.
 */
import { jest } from '@jest/globals';
import Redis from 'ioredis-mock';
import mongoose from 'mongoose';

// Mock Redis so unit tests don't need a live Redis server
jest.unstable_mockModule('./src/config/redis.js', () => ({
  __esModule: true,
  default: new Redis()
}));

// Set JWT_SECRET for tests if not already set (ensures CI compatibility)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret';
}

// Without a live DB, Mongoose buffers queries.  The default bufferTimeoutMS is
// 10 000 ms which exceeds Jest's testTimeout.  Setting it to 500 ms lets the
// controller's try/catch return a 500 within the test window.
mongoose.set('bufferTimeoutMS', 500);
