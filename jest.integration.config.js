/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    transform: {},
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testMatch: ['**/tests/integration/**/*.test.js'],
    testTimeout: 30000, // Integration tests, specially MongoDB Memory Server startup, can take a few seconds
};
