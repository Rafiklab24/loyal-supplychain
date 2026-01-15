import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';
import { pool } from '../../db/client';

describe('Shipments API', () => {
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

  describe('GET /api/shipments', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/shipments')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/shipments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/shipments?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/shipments?status=sailed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support filtering by POL', async () => {
      const response = await request(app)
        .get('/api/shipments?pol=India')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support search parameter', async () => {
      const response = await request(app)
        .get('/api/shipments?search=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support sorting', async () => {
      const response = await request(app)
        .get('/api/shipments?sortBy=eta&sortDir=desc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/shipments/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/shipments/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent shipment', async () => {
      const response = await request(app)
        .get('/api/shipments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/shipments', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/shipments')
        .send({})
        .expect(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/shipments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/shipments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sn: 'TEST-SN-001',
          // Missing other required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/shipments/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/shipments/invalid-id')
        .send({})
        .expect(401);
    });

    it('should return 404 for non-existent shipment', async () => {
      const response = await request(app)
        .put('/api/shipments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sn: 'TEST-SN' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/shipments/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .delete('/api/shipments/invalid-id')
        .expect(401);
    });

    it('should return 404 for non-existent shipment', async () => {
      const response = await request(app)
        .delete('/api/shipments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

