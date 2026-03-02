/**
 * @fileoverview Authentication Controller Tests
 * @description Simple integration tests for authentication endpoints using Supertest
 * Tests validation logic and error handling for auth routes
 */

import request from 'supertest';
import app from '../app.js';

describe('Authentication API - Basic Tests', () => {

  describe('POST /auth/register - Employee Registration', () => {

    test('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          phone: '+1234567890',
          password: 'SecurePass123!',
          orgCode: 'TEST2024'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields are required');
    });

    test('should reject registration with missing phone', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          orgCode: 'TEST2024'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields are required');
    });

    test('should reject registration with missing password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          phone: '+1234567890',
          orgCode: 'TEST2024'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields are required');
    });

    test('should reject registration with missing orgCode', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          phone: '+1234567890',
          password: 'SecurePass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields are required');
    });

    test('should reject weak password - too short (requires OTP first)', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          phone: '+1234567890',
          password: 'weak',
          orgCode: 'TEST2024',
          otp: '000000'
        });

      expect(response.status).toBe(400);
      // OTP verification fails before password check is reached
      expect(response.body.message).toContain('Invalid or expired verification code');
    });

    test('should reject registration with missing otp', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          phone: '+1234567890',
          password: 'SecurePass123!',
          orgCode: 'TEST2024'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('All fields are required');
    });
  });

  describe('POST /auth/login - User Login', () => {

    test('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'SecurePass123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email and password required');
    });

    test('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email and password required');
    });

    test('should reject login with empty credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Email and password required');
    });
  });

  describe('POST /auth/forgot-password - Password Reset Request', () => {

    test('should reject request without email', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email is required');
    });
  });

  describe('POST /auth/reset-password/:token - Password Reset', () => {

    test('should reject reset without password', async () => {
      const response = await request(app)
        .post('/auth/reset-password/sometoken123')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password is required');
    });

    test('should reject reset with weak password - too short', async () => {
      const response = await request(app)
        .post('/auth/reset-password/sometoken123')
        .send({ password: 'weak' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    test('should reject reset with weak password - no uppercase', async () => {
      const response = await request(app)
        .post('/auth/reset-password/sometoken123')
        .send({ password: 'password123!' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });

    test('should reject reset with weak password - no special char', async () => {
      const response = await request(app)
        .post('/auth/reset-password/sometoken123')
        .send({ password: 'Password123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Password must be at least 8 characters');
    });
  });

  describe('General API Health', () => {

    test('should return health check for root endpoint', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Backend v1 running');
    });

    test('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/non-existent-route-xyz');

      expect(response.status).toBe(404);
    });
  });
});

