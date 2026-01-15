import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Cafe API', () => {
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

  describe('GET /api/cafe/menu', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/cafe/menu')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/cafe/menu')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /api/cafe/vote', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/cafe/vote')
        .send({})
        .expect(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/cafe/vote')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});



