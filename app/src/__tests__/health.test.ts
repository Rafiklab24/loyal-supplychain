import request from 'supertest';
import app from '../index';

describe('Health Check API', () => {
  describe('GET /api/health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('GET /api/health/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app).get('/api/health/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shipments');
      expect(response.body).toHaveProperty('companies');
      expect(response.body).toHaveProperty('contracts');
    });
  });

  describe('GET /', () => {
    it('should return API documentation', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('auth');
      expect(response.body.endpoints).toHaveProperty('shipments');
    });
  });
});

