import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Ports API', () => {
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

  describe('GET /api/ports', () => {
    it('should return 200 without authentication (public endpoint)', async () => {
      const response = await request(app)
        .get('/api/ports')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/ports?page=1&limit=10')
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/ports?search=mumbai')
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/ports/:id', () => {
    it('should return 404 for non-existent port', async () => {
      const response = await request(app)
        .get('/api/ports/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
