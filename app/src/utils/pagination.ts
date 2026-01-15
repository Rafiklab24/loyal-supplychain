/**
 * Pagination Utility
 * Provides standardized pagination parsing and response formatting
 */

import { Request } from 'express';
import { PAGINATION } from '../config/constants';

/**
 * Pagination parameters parsed from request query
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** SQL OFFSET value (calculated from page and limit) */
  offset: number;
}

/**
 * Standardized paginated response format
 */
export interface PaginatedResponse<T> {
  /** Array of data items for the current page */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number (1-indexed) */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Total number of items across all pages */
    total: number;
    /** Total number of pages */
    totalPages: number;
  };
}

/**
 * Parse pagination parameters from request query string
 * Validates and sanitizes page and limit values
 * 
 * @param req - Express request object
 * @returns Pagination parameters with validated page, limit, and calculated offset
 */
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string) || PAGINATION.DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * Create a standardized paginated response
 * 
 * @param data - Array of data items for the current page
 * @param total - Total number of items across all pages
 * @param params - Pagination parameters (page, limit, offset)
 * @returns Formatted paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

/**
 * Parse pagination with optional sorting parameters
 * 
 * @param req - Express request object
 * @returns Pagination parameters and optional sort field/direction
 */
export function parsePaginationWithSort(req: Request): PaginationParams & {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
} {
  const pagination = parsePagination(req);
  const sortBy = req.query.sortBy as string | undefined;
  const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  return {
    ...pagination,
    ...(sortBy && { sortBy }),
    sortOrder,
  };
}



