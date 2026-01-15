import { describe, it, expect, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware, RequestWithId } from '../../middleware/requestId';

describe('Request ID Middleware', () => {
  it('should generate and attach request ID', () => {
    const req = {} as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect((req as RequestWithId).id).toBeDefined();
    expect((req as RequestWithId).id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', (req as RequestWithId).id);
    expect(next).toHaveBeenCalled();
  });

  it('should generate unique IDs for each request', () => {
    const req1 = {} as Request;
    const req2 = {} as Request;
    const res1 = { setHeader: jest.fn() } as unknown as Response;
    const res2 = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req1, res1, next);
    requestIdMiddleware(req2, res2, next);

    expect((req1 as RequestWithId).id).not.toBe((req2 as RequestWithId).id);
  });
});

