import { describe, it, expect, beforeEach, vi, afterEach } from '@jest/globals';
import cron from 'node-cron';
import { initializeScheduler } from '../../services/scheduler';
import { notificationService } from '../../services/notificationService';
import { pool } from '../../db/client';

// Mock dependencies
vi.mock('node-cron');
vi.mock('../../services/notificationService', () => ({
  notificationService: {
    checkAndGenerateNotifications: vi.fn(),
  },
}));

vi.mock('../../db/client', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('Scheduler Service', () => {
  const mockCron = vi.mocked(cron);
  const mockNotificationService = vi.mocked(notificationService);
  const mockPool = vi.mocked(pool);

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock schedule to return a mock task
    mockCron.schedule.mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeScheduler', () => {
    it('should schedule notification check every 30 minutes', () => {
      initializeScheduler();

      expect(mockCron.schedule).toHaveBeenCalledWith(
        '*/30 * * * *',
        expect.any(Function)
      );
    });

    it('should schedule cafe reminder at 5:30 PM weekdays', () => {
      initializeScheduler();

      const cafeReminderCall = mockCron.schedule.mock.calls.find(
        call => call[0] === '30 17 * * 1-5'
      );

      expect(cafeReminderCall).toBeDefined();
      expect(cafeReminderCall?.[2]).toEqual({ timezone: 'Asia/Riyadh' });
    });

    it('should schedule cafe voting close at 6:00 PM weekdays', () => {
      initializeScheduler();

      const cafeCloseCall = mockCron.schedule.mock.calls.find(
        call => call[0] === '0 18 * * 1-5'
      );

      expect(cafeCloseCall).toBeDefined();
      expect(cafeCloseCall?.[2]).toEqual({ timezone: 'Asia/Riyadh' });
    });

    it('should run notification check on scheduled time', async () => {
      initializeScheduler();

      // Get the callback function
      const notificationCallback = mockCron.schedule.mock.calls[0][1];

      mockNotificationService.checkAndGenerateNotifications.mockResolvedValueOnce(undefined);

      await notificationCallback();

      expect(mockNotificationService.checkAndGenerateNotifications).toHaveBeenCalled();
    });

    it('should handle notification check errors gracefully', async () => {
      initializeScheduler();

      const notificationCallback = mockCron.schedule.mock.calls[0][1];

      mockNotificationService.checkAndGenerateNotifications.mockRejectedValueOnce(
        new Error('Test error')
      );

      // Should not throw
      await expect(notificationCallback()).resolves.not.toThrow();
    });
  });

  describe('cafe voting reminder', () => {
    it('should send reminder to users who have not voted', async () => {
      initializeScheduler();

      const cafeReminderCallback = mockCron.schedule.mock.calls.find(
        call => call[0] === '30 17 * * 1-5'
      )?.[1];

      if (!cafeReminderCallback) {
        throw new Error('Cafe reminder callback not found');
      }

      // Mock database responses
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ count: '2' }], // Menu options exist
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: 'user1', name: 'User 1' },
            { id: 'user2', name: 'User 2' },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // First insert
        .mockResolvedValueOnce({ rows: [] } as any); // Second insert

      await cafeReminderCallback();

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should skip reminder if no menu options', async () => {
      initializeScheduler();

      const cafeReminderCallback = mockCron.schedule.mock.calls.find(
        call => call[0] === '30 17 * * 1-5'
      )?.[1];

      if (!cafeReminderCallback) {
        throw new Error('Cafe reminder callback not found');
      }

      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '0' }], // No menu options
      } as any);

      await cafeReminderCallback();

      // Should only query once for menu options
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('cafe voting close', () => {
    it('should close voting and announce winner', async () => {
      initializeScheduler();

      const cafeCloseCallback = mockCron.schedule.mock.calls.find(
        call => call[0] === '0 18 * * 1-5'
      )?.[1];

      if (!cafeCloseCallback) {
        throw new Error('Cafe close callback not found');
      }

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ count: '2' }], // Menu options exist
        } as any)
        .mockResolvedValueOnce({
          rows: [], // Not finalized yet
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: '1', dish_name: 'Dish 1', dish_name_ar: 'طبق 1', vote_count: 5 },
            { id: '2', dish_name: 'Dish 2', dish_name_ar: 'طبق 2', vote_count: 3 },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'user1' }, { id: 'user2' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // Insert result
        .mockResolvedValueOnce({ rows: [] } as any) // Insert notifications
        .mockResolvedValueOnce({ rows: [] } as any);

      await cafeCloseCallback();

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should handle tie in voting', async () => {
      initializeScheduler();

      const cafeCloseCallback = mockCron.schedule.mock.calls.find(
        call => call[0] === '0 18 * * 1-5'
      )?.[1];

      if (!cafeCloseCallback) {
        throw new Error('Cafe close callback not found');
      }

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: '1', dish_name: 'Dish 1', dish_name_ar: 'طبق 1', vote_count: 5 },
            { id: '2', dish_name: 'Dish 2', dish_name_ar: 'طبق 2', vote_count: 5 }, // Tie
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'cafe1' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await cafeCloseCallback();

      // Should notify cafe users about tie
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should skip if voting already finalized', async () => {
      initializeScheduler();

      const cafeCloseCallback = mockCron.schedule.mock.calls.find(
        call => call[0] === '0 18 * * 1-5'
      )?.[1];

      if (!cafeCloseCallback) {
        throw new Error('Cafe close callback not found');
      }

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: '1' }], // Already finalized
        } as any);

      await cafeCloseCallback();

      // Should only check menu and finalized status
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });
});
