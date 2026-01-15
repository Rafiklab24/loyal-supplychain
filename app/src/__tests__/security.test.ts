import request from 'supertest';
import bcrypt from 'bcrypt';
import { pool } from '../db/client';
import app from '../index';

describe('Security Tests', () => {
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create a test user
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const result = await pool.query(
      'INSERT INTO security.users (username, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['securitytest', passwordHash, 'Security Test User', 'Admin']
    );
    testUserId = result.rows[0].id;

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'securitytest',
        password: 'TestPassword123!',
      });
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM security.users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('Protected Routes', () => {
    it('should block access to /api/shipments without token', async () => {
      const response = await request(app).get('/api/shipments');
      expect(response.status).toBe(401);
    });

    it('should allow access to /api/shipments with valid token', async () => {
      const response = await request(app)
        .get('/api/shipments')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    });

    it('should block access with invalid token', async () => {
      const response = await request(app)
        .get('/api/shipments')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(403);
    });

    it('should block access to /api/contracts without token', async () => {
      const response = await request(app).get('/api/contracts');
      expect(response.status).toBe(401);
    });

    it('should block access to /api/finance without token', async () => {
      const response = await request(app).get('/api/finance/transactions');
      expect(response.status).toBe(401);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle malicious input in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: "admin' OR '1'='1",
          password: "password' OR '1'='1",
        });

      expect(response.status).toBe(401);
    });

    it('should handle SQL injection attempt in search', async () => {
      const response = await request(app)
        .get('/api/shipments?search=test\'; DROP TABLE logistics.shipments; --')
        .set('Authorization', `Bearer ${authToken}`);

      // Should not throw an error, should handle gracefully
      expect(response.status).not.toBe(500);
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limiting headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from helmet', async () => {
      const response = await request(app).get('/');

      // Helmet should add these headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});

