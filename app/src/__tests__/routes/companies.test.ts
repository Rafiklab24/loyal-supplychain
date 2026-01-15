import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Companies API', () => {
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

  describe('GET /api/companies', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/companies')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/companies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/companies?search=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support filtering by type', async () => {
      const response = await request(app)
        .get('/api/companies?type=supplier')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/companies/fuzzy-match', () => {
    it('should return 400 without name parameter', async () => {
      const response = await request(app)
        .get('/api/companies/fuzzy-match')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return matches with name parameter', async () => {
      const response = await request(app)
        .get('/api/companies/fuzzy-match?name=Test Company')
        .expect(200);

      expect(response.body).toHaveProperty('matches');
      expect(Array.isArray(response.body.matches)).toBe(true);
    });
  });

  describe('GET /api/companies/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/companies/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent company', async () => {
      const response = await request(app)
        .get('/api/companies/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/companies', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/companies')
        .send({})
        .expect(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
