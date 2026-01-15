/**
 * Request ID Middleware
 * Generates a unique ID for each request and adds it to headers and request object
 * Enables request tracing across logs and error responses
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  id: string;
}

/**
 * Middleware to generate and attach a unique request ID to each request
 * Adds the ID to:
 * - req.id (for use in route handlers and error handlers)
 * - X-Request-ID response header (for client correlation)
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = uuidv4();
  (req as RequestWithId).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}



