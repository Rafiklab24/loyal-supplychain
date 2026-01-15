import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('Notifications API', () => {
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

  describe('GET /api/notifications', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/notifications')
        .expect(401);
    });

    it('should return 200 with authentication', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support filtering by isRead', async () => {
      const response = await request(app)
        .get('/api/notifications?isRead=false')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should support filtering by type', async () => {
      const response = await request(app)
        .get('/api/notifications?type=shipping_deadline_approaching')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should return unread count', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('unreadCount');
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/notifications/invalid-id/read')
        .expect(401);
    });

    it('should return 404 for non-existent notification', async () => {
      const response = await request(app)
        .put('/api/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/notifications/:id/complete', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/notifications/invalid-id/complete')
        .expect(401);
    });
  });
});
