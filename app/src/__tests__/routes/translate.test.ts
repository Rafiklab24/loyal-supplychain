import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Translate API', () => {
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

  describe('POST /api/translate', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/translate')
        .send({})
        .expect(401);
    });

    it('should return 400 for missing text', async () => {
      const response = await request(app)
        .post('/api/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should translate text', async () => {
      const response = await request(app)
        .post('/api/translate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Hello World',
          targetLang: 'ar',
        })
        .expect(200);

      expect(response.body).toHaveProperty('translated');
    });
  });
});



