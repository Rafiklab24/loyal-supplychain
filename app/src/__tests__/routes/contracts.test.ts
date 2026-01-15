import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Contracts API', () => {
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

  describe('GET /api/contracts', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/contracts')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/contracts?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toBeDefined();
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/contracts?status=ACTIVE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support search parameter', async () => {
      const response = await request(app)
        .get('/api/contracts?search=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/contracts/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/contracts/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await request(app)
        .get('/api/contracts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/contracts', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/contracts')
        .send({})
        .expect(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/contracts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contract_no: 'CT-001',
          // Missing buyer_company_id, seller_company_id, etc.
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/contracts/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/contracts/invalid-id')
        .send({})
        .expect(401);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await request(app)
        .put('/api/contracts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contract_no: 'CT-001' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/contracts/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .delete('/api/contracts/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent contract', async () => {
      const response = await request(app)
        .delete('/api/contracts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

