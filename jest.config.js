export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  // Raise timeout slightly to accommodate the 500 ms Mongoose buffer flush
  testTimeout: 8000,
  // Short-circuit Mongoose buffering before each test suite runs
  setupFiles: ['./jest.setup.js']
};
