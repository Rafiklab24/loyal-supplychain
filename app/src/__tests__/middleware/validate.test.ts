import { describe, it, expect, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateBody, validateQuery, validateParams } from '../../middleware/validate';

describe('Validation Middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  });

  it('should pass validation for valid body data', async () => {
    const req = {
      body: { name: 'Test', age: 25 },
    } as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    const middleware = validateBody(schema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.name).toBe('Test');
    expect(req.body.age).toBe(25);
  });

  it('should reject invalid body data', async () => {
    const req = {
      body: { name: '', age: -1 },
    } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    const middleware = validateBody(schema);
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should validate query parameters', async () => {
    const querySchema = z.object({
      page: z.string().optional(),
    });

    const req = {
      query: { page: '1' },
    } as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    const middleware = validateQuery(querySchema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should validate URL parameters', async () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const req = {
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    } as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    const middleware = validateParams(paramsSchema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

