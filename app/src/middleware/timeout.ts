/**
 * Request Timeout Middleware
 * Prevents resource exhaustion by timing out long-running requests
 */

import timeout from 'express-timeout-handler';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Default timeout: 30 seconds
const DEFAULT_TIMEOUT = 30000;

export const requestTimeout = timeout.handler({
  timeout: DEFAULT_TIMEOUT,
  onTimeout: (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).id || 'unknown';
    logger.warn('Request timeout', {
      method: req.method,
      path: req.path,
      requestId,
      timeout: DEFAULT_TIMEOUT,
    });

    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request took too long to process',
        requestId,
      });
    }
  },
  disable: ['write', 'setHeaders', 'send', 'json', 'end'],
});

/**
 * Per-route timeout middleware
 * Use this for routes that need custom timeout values
 */
export function withTimeout(ms: number) {
  return timeout.handler({
    timeout: ms,
    onTimeout: (req: Request, res: Response) => {
      const requestId = (req as any).id || 'unknown';
      logger.warn('Request timeout (custom)', {
        method: req.method,
        path: req.path,
        requestId,
        timeout: ms,
      });

      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway Timeout',
          message: `Request exceeded ${ms}ms timeout`,
          requestId,
        });
      }
    },
    disable: ['write', 'setHeaders', 'send', 'json', 'end'],
  });
}

