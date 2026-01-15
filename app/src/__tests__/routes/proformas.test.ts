import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Proformas API', () => {
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

  describe('GET /api/proformas', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/proformas')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/proformas')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/proformas?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/proformas/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/proformas/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent proforma', async () => {
      const response = await request(app)
        .get('/api/proformas/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/proformas', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/proformas')
        .send({})
        .expect(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/proformas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
