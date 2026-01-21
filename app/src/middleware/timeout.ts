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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0351c484-bc79-48a7-8b30-3870c2e1206d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'timeout.ts:onTimeout',message:'DEFAULT TIMEOUT TRIGGERED (30s)',data:{method:req.method,path:req.path,requestId,timeout:DEFAULT_TIMEOUT},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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

