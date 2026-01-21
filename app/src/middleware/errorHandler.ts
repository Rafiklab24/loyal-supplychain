import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { RequestWithId } from './requestId';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errorId = uuidv4();
  const requestId = (req as RequestWithId).id || 'unknown';
  
  logger.error('Request error', {
    errorId,
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Handle PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        // Extract more specific error message based on constraint
        let conflictMessage = 'A record with this value already exists';
        if (err.detail) {
          if (err.detail.includes('contract_no')) {
            conflictMessage = 'A contract with this number already exists. Please use a different contract number or edit the existing contract.';
          } else if (err.detail.includes('username')) {
            conflictMessage = 'This username is already taken.';
          } else if (err.detail.includes('name')) {
            conflictMessage = 'A record with this name already exists.';
          }
        }
        return res.status(409).json({
          error: 'Conflict',
          message: conflictMessage,
          details: err.detail,
        });
      case '23503': // foreign_key_violation
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Referenced record does not exist',
          details: err.detail,
        });
      case '23502': // not_null_violation
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Required field is missing',
          details: err.column,
        });
      default:
        break;
    }
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
    });
  }

  // Never expose stack traces in production (use error IDs)
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Default error response
  res.status(err.statusCode || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    errorId, // For debugging - clients can reference this in support requests
    requestId, // For request correlation
    ...(isDevelopment && { stack: err.stack }),
  });
}

