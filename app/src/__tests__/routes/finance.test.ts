import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Finance API', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const result = await createTestUserWithToken('user');
    testUserId = result.userId;
    authToken = result.token;
  });

  afterAll(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId);
    }
  });

  describe('GET /api/finance/transactions', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/finance/transactions')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/finance/transactions?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toBeDefined();
    });

    it('should support filtering by date range', async () => {
      const response = await request(app)
        .get('/api/finance/transactions?dateFrom=2024-01-01&dateTo=2024-12-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support filtering by direction', async () => {
      const response = await request(app)
        .get('/api/finance/transactions?direction=incoming')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('POST /api/finance/transactions', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/finance/transactions')
        .send({})
        .expect(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/finance/transactions/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/finance/transactions/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/finance/transactions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
