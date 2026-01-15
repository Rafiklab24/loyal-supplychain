import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Documents API', () => {
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

  describe('GET /api/documents', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/documents')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support filtering by shipment_id', async () => {
      const response = await request(app)
        .get('/api/documents?shipment_id=test-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support filtering by doc_type', async () => {
      const response = await request(app)
        .get('/api/documents?doc_type=BL_FINAL')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('POST /api/documents', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/documents')
        .expect(401);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/documents/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .delete('/api/documents/invalid-id')
        .expect(401);
    });
  });
});
