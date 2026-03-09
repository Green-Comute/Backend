/**
 * @fileoverview Jest global setup
 * @description Runs before all test suites. Configures Mongoose to fail
 *   buffered operations quickly (500 ms) so controller tests that reach the
 *   DB layer get a fast 500 response instead of timing out.
 */
import mongoose from 'mongoose';

// Set JWT_SECRET for tests if not already set (ensures CI compatibility)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret';
}

// Without a live DB, Mongoose buffers queries.  The default bufferTimeoutMS is
// 10 000 ms which exceeds Jest's testTimeout.  Setting it to 500 ms lets the
// controller's try/catch return a 500 within the test window.
mongoose.set('bufferTimeoutMS', 500);
