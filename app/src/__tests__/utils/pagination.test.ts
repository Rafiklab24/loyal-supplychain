import { describe, it, expect } from '@jest/globals';
import { Request } from 'express';
import { parsePagination, createPaginatedResponse, parsePaginationWithSort } from '../../utils/pagination';

describe('Pagination Utils', () => {
  describe('parsePagination', () => {
    it('should parse default pagination when no query params', () => {
      const req = { query: {} } as Request;
      const result = parsePagination(req);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBeGreaterThan(0);
      expect(result.offset).toBe(0);
    });

    it('should parse page and limit from query params', () => {
      const req = { query: { page: '2', limit: '20' } } as Request;
      const result = parsePagination(req);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(20);
    });

    it('should enforce minimum page of 1', () => {
      const req = { query: { page: '0', limit: '10' } } as Request;
      const result = parsePagination(req);
      
      expect(result.page).toBe(1);
      expect(result.offset).toBe(0);
    });

    it('should enforce minimum limit of 1', () => {
      const req = { query: { page: '1', limit: '0' } } as Request;
      const result = parsePagination(req);
      
      expect(result.limit).toBeGreaterThanOrEqual(1);
    });

    it('should calculate offset correctly', () => {
      const req = { query: { page: '3', limit: '10' } } as Request;
      const result = parsePagination(req);
      
      expect(result.offset).toBe(20); // (3-1) * 10
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create paginated response with correct structure', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const total = 25;
      const params = { page: 2, limit: 10, offset: 10 };
      
      const result = createPaginatedResponse(data, total, params);
      
      expect(result.data).toEqual(data);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3); // Math.ceil(25/10)
    });

    it('should calculate totalPages correctly', () => {
      const data: any[] = [];
      const total = 100;
      const params = { page: 1, limit: 25, offset: 0 };
      
      const result = createPaginatedResponse(data, total, params);
      
      expect(result.pagination.totalPages).toBe(4); // Math.ceil(100/25)
    });
  });

  describe('parsePaginationWithSort', () => {
    it('should parse pagination with sort parameters', () => {
      const req = { query: { page: '1', limit: '10', sortBy: 'name', sortOrder: 'DESC' } } as Request;
      const result = parsePaginationWithSort(req);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.sortBy).toBe('name');
      expect(result.sortOrder).toBe('DESC');
    });

    it('should default to ASC when sortOrder is not DESC', () => {
      const req = { query: { page: '1', limit: '10', sortBy: 'name', sortOrder: 'ASC' } } as Request;
      const result = parsePaginationWithSort(req);
      
      expect(result.sortOrder).toBe('ASC');
    });

    it('should default to ASC when sortOrder is missing', () => {
      const req = { query: { page: '1', limit: '10', sortBy: 'name' } } as Request;
      const result = parsePaginationWithSort(req);
      
      expect(result.sortOrder).toBe('ASC');
    });
  });
});

