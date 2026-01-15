import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('BlackDay API', () => {
  let authToken: string;
  let testUserId: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    const userResult = await createTestUserWithToken('user');
    testUserId = userResult.userId;
    authToken = userResult.token;

    const adminResult = await createTestUserWithToken('Admin');
    adminUserId = adminResult.userId;
    adminToken = adminResult.token;
  });

  afterAll(async () => {
    if (testUserId) await deleteTestUser(testUserId);
    if (adminUserId) await deleteTestUser(adminUserId);
  });

  describe('GET /api/blackday/status', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/blackday/status')
        .expect(401);
    });

    it('should return status with authentication', async () => {
      const response = await request(app)
        .get('/api/blackday/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isActive');
    });
  });

  describe('POST /api/blackday/activate', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/blackday/activate')
        .expect(401);
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/blackday/activate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });
});



