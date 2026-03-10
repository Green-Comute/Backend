import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/authRoutes.js';
import User from '../../src/models/User.js';
import Organization from '../../src/models/Organization.js';
import { globalLimiter, authLimiter } from '../../src/middlewares/rateLimiter.middleware.js';
import { generateOTP } from '../../src/utils/otp.utils.js';

// Setup app identically to app.js
const app = express();
app.use(express.json());
app.use(globalLimiter);
app.use('/auth', authLimiter, authRoutes);

describe('Auth Integration Tests', () => {
    let org;

    beforeEach(async () => {
        // Create an organization so we can register employees against it
        org = await Organization.create({
            name: 'Test Corp',
            orgCode: 'TESTCORP123',
            allowedDomains: ['test.com'],
            isActive: true
        });
    });

    it('should successfully register a new user with valid inputs', async () => {
        const otp = generateOTP('employee@test.com');
        const payload = {
            email: 'employee@test.com',
            phone: '+1234567890',
            password: 'SecurePassword123!',
            orgCode: 'TESTCORP123',
            name: 'John Doe',
            otp
        };

        const res = await request(app)
            .post('/auth/register')
            .send(payload);

        expect(res.statusCode).toBe(201);
        expect(res.body.message).toMatch(/Registration successful/);

        // Verify the user was actually created in the test DB
        const userInDb = await User.findOne({ email: 'employee@test.com' });
        expect(userInDb).toBeTruthy();
        expect(userInDb.organizationId.toString()).toBe(org._id.toString());
        expect(userInDb.role).toBe('EMPLOYEE');

        // Because domain matched allowedDomains, approval status should be APPROVED
        expect(userInDb.approvalStatus).toBe('APPROVED');
    });

    it('should fail registration with invalid input (e.g., weak password via Joi validation)', async () => {
        const otp = generateOTP('employee2@test.com');
        const payload = {
            email: 'employee2@test.com',
            phone: '+1234567891',
            password: '123', // Too short, Joi requires min 8
            orgCode: 'TESTCORP123',
            name: 'Jane Doe',
            otp
        };

        const res = await request(app)
            .post('/auth/register')
            .send(payload);

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Input validation failed');
        expect(res.body.errors[0]).toMatch(/password/);

        // Ensure user was decidedly NOT created
        const userInDb = await User.findOne({ email: 'employee2@test.com' });
        expect(userInDb).toBeFalsy();
    });

    it('should fail registration if org code is invalid', async () => {
        const otp = generateOTP('employee3@test.com');
        const payload = {
            email: 'employee3@test.com',
            phone: '+1234567892',
            password: 'SecurePassword123!',
            orgCode: 'WRONGCODE',
            name: 'Jim Doe',
            otp
        };

        const res = await request(app)
            .post('/auth/register')
            .send(payload);

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe('Invalid or inactive organization code');
    });
});
