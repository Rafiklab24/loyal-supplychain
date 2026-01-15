/**
 * Validation Middleware
 * Uses Zod schemas to validate request payloads and return standardized errors
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger';

/**
 * Generic validation middleware factory
 * @param schema - Zod schema to validate against
 * @param source - Which part of request to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Get the data to validate based on source
    const dataToValidate = req[source];
    
    try {
      // Parse and validate
      const validated = await schema.parseAsync(dataToValidate);
      
      // Replace the original data with validated/transformed data
      req[source] = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a user-friendly structure
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        logger.error('Validation failed', {
          errors: formattedErrors,
          data: dataToValidate,
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          details: formattedErrors,
          timestamp: new Date().toISOString(),
        });
      }
      
      // If it's not a Zod error, pass it to the error handler
      next(error);
    }
  };
}

/**
 * Validate request body
 */
export function validateBody(schema: ZodSchema) {
  return validate(schema, 'body');
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return validate(schema, 'query');
}

/**
 * Validate URL parameters
 */
export function validateParams(schema: ZodSchema) {
  return validate(schema, 'params');
}

/**
 * UUID validation helper for route params
 */
export const validateUuidParam = (paramName: string = 'id') => {
  return validateParams(
    require('zod').z.object({
      [paramName]: require('zod').z.string().uuid(`Invalid ${paramName} format`),
    })
  );
};

/**
 * Manual validation helper (for use in route handlers)
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated data or throws ZodError
 */
export async function validateData<T>(schema: ZodSchema<T>, data: unknown): Promise<T> {
  return await schema.parseAsync(data);
}

/**
 * Safe validation helper (doesn't throw)
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with success flag and data or errors
 */
export async function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<
  | { success: true; data: T; errors: null }
  | { success: false; data: null; errors: Array<{ field: string; message: string }> }
> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return { success: false, data: null, errors: formattedErrors };
    }
    
    // Unexpected error
    return {
      success: false,
      data: null,
      errors: [{ field: 'unknown', message: 'Validation failed unexpectedly' }],
    };
  }
}

