/**
 * Cache Service
 * Provides caching layer with Redis support and in-memory fallback
 */

import Redis from 'ioredis';
import { env } from '../config/env';
import logger from '../utils/logger';

let redis: Redis | null = null;
const memoryCache = new Map<string, { value: any; expires: number }>();

// Initialize Redis or use memory cache
if (env.REDIS_URL) {
  try {
    redis = new Redis(env.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redis.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('ready', () => {
      logger.info('Redis ready');
    });
  } catch (error: any) {
    logger.error('Failed to initialize Redis', { error: error.message });
    redis = null;
  }
} else {
  logger.warn('Redis not configured, using in-memory cache');
}

/**
 * Cache Service Class
 */
export class CacheService {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (redis) {
      try {
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error: any) {
        logger.error('Redis get error', { key, error: error.message });
        return null;
      }
    } else {
      const cached = memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }
      memoryCache.delete(key);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (default: 1 hour)
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    if (redis) {
      try {
        await redis.setex(key, ttl, JSON.stringify(value));
      } catch (error: any) {
        logger.error('Redis set error', { key, error: error.message });
      }
    } else {
      memoryCache.set(key, {
        value,
        expires: Date.now() + ttl * 1000,
      });
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    if (redis) {
      try {
        await redis.del(key);
      } catch (error: any) {
        logger.error('Redis del error', { key, error: error.message });
      }
    } else {
      memoryCache.delete(key);
    }
  }

  /**
   * Invalidate keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (redis) {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (error: any) {
        logger.error('Redis invalidatePattern error', { pattern, error: error.message });
      }
    } else {
      for (const key of memoryCache.keys()) {
        if (this.matchPattern(key, pattern)) {
          memoryCache.delete(key);
        }
      }
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (redis) {
      try {
        const result = await redis.exists(key);
        return result === 1;
      } catch (error: any) {
        logger.error('Redis exists error', { key, error: error.message });
        return false;
      }
    } else {
      const cached = memoryCache.get(key);
      return cached ? cached.expires > Date.now() : false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (redis) {
      try {
        const info = await redis.info('stats');
        return {
          type: 'redis',
          connected: redis.status === 'ready',
          info,
        };
      } catch (error: any) {
        return {
          type: 'redis',
          connected: false,
          error: error.message,
        };
      }
    } else {
      return {
        type: 'memory',
        size: memoryCache.size,
        keys: Array.from(memoryCache.keys()),
      };
    }
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<void> {
    if (redis) {
      try {
        await redis.flushdb();
      } catch (error: any) {
        logger.error('Redis flush error', { error: error.message });
      }
    } else {
      memoryCache.clear();
    }
  }

  /**
   * Simple pattern matching for in-memory cache
   */
  private matchPattern(key: string, pattern: string): boolean {
    // Convert Redis pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }
}

export const cache = new CacheService();

/**
 * Cache middleware for Express routes
 * Only caches GET requests
 */
import { Request, Response, NextFunction } from 'express';

export function cacheMiddleware(ttl: number = 3600) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `route:${req.path}:${JSON.stringify(req.query)}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      logger.debug('Cache hit', { key: cacheKey });
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      cache.set(cacheKey, body, ttl).catch((error) => {
        logger.error('Cache set error', { key: cacheKey, error: error.message });
      });
      return originalJson(body);
    };

    next();
  };
}

