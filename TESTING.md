# Unit Testing Guide — Backend

## Testing Stack

### Tools Used:
1. **Jest** - JavaScript testing framework
2. **Supertest** - HTTP assertions for API testing
3. **Sinon** - Test spies, stubs, and mocks

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Files

- **`src/utils/passwordValidator.test.js`** - Unit tests for password validation logic
  - Tests all password strength requirements
  - Edge cases (empty, null, undefined)
  - Multiple valid/invalid password formats

- **`src/services/token.service.test.js`** - Unit tests for JWT token generation
  - Token creation with correct payload
  - JWT secret validation
  - Token expiration verification
  - Uses **Sinon** for mocking jwt.sign

- **`src/controllers/authController.test.js`** - Integration tests for authentication API
  - Uses **Supertest** for HTTP testing
  - Tests registration endpoint validation
  - Tests login endpoint
  - Mocks database models with **Sinon**

## Coverage Reports

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/`

---

## What's Being Tested

✅ Password validation logic
✅ JWT token generation and verification
✅ Authentication API endpoints
✅ Database model interactions (mocked)
✅ Error handling and validation

---

## Next Steps

- Add tests for remaining controllers (ride, trip, user)
- Test middleware (auth, platform, orgAdmin)
- Test socket.io events (rideSocket, trackingSocket)
- Add database integration tests with test database

---

## Best Practices

1. **Write tests first** (TDD approach) or alongside features
2. **Test user behavior**, not implementation details
3. **Mock external dependencies** (APIs, databases, third-party libraries)
4. **Aim for 80%+ code coverage**
5. **Keep tests isolated** - each test should be independent
6. **Use descriptive test names** - describe what's being tested and expected outcome

---

## Troubleshooting

```bash
# If Jest fails with ES modules
set NODE_OPTIONS=--experimental-vm-modules

# Clear Jest cache
npx jest --clearCache
```

---

## 📚 Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Sinon Documentation](https://sinonjs.org/)
