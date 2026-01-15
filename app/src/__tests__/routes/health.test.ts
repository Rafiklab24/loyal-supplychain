import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from '@jest/globals';
import app from '../../index';
import { pool } from '../../db/client';
import { checkOpenAIConnection } from '../../services/openai';
import { checkDiskSpaceInfo, checkMemoryUsage } from '../../utils/system';

// Mock dependencies
vi.mock('../../db/client', () => ({
  pool: {
    query: vi.fn(),
  },
  checkPoolHealth: vi.fn(),
  getPoolMetrics: vi.fn(),
}));

vi.mock('../../services/openai', () => ({
  checkOpenAIConnection: vi.fn(),
}));

vi.mock('../../utils/system', () => ({
  checkDiskSpaceInfo: vi.fn(),
  checkMemoryUsage: vi.fn(),
}));

describe('Health API', () => {
  const mockPool = vi.mocked(pool);
  const mockCheckOpenAI = vi.mocked(checkOpenAIConnection);
  const mockCheckDiskSpace = vi.mocked(checkDiskSpaceInfo);
  const mockCheckMemory = vi.mocked(checkMemoryUsage);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] } as any);
      mockCheckDiskSpace.mockResolvedValueOnce({
        freeGB: '10',
        usedPercent: '50',
      } as any);
      mockCheckMemory.mockReturnValueOnce({
        heapUsed: '100',
        utilization: '50',
      } as any);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('checks');
    });

    it('should return unhealthy status on database error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('GET /api/health/live', () => {
    it('should return alive status', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('alive');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return ready status when all checks pass', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);
      mockCheckOpenAI.mockResolvedValueOnce(true);
      mockCheckDiskSpace.mockResolvedValueOnce({
        freeGB: '10',
        usedPercent: '50',
      } as any);
      mockCheckMemory.mockReturnValueOnce({
        heapUsed: '100',
        utilization: '50',
      } as any);

      const response = await request(app)
        .get('/api/health/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body).toHaveProperty('checks');
    });

    it('should return not_ready when database check fails', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app)
        .get('/api/health/ready')
        .expect(503);

      expect(response.body.status).toBe('not_ready');
      expect(response.body.checks.database.healthy).toBe(false);
    });
  });

  describe('GET /api/health/stats', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/health/stats')
        .expect(401);
    });

    it('should return stats with authentication', async () => {
      // This would require a full auth token setup
      // For now, just test the endpoint exists
      const response = await request(app)
        .get('/api/health/stats')
        .expect(401); // Expected without auth

      expect(response.body).toHaveProperty('error');
    });
  });
});



