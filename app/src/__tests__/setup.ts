import { Pool } from 'pg';
import { pool } from '../db/client';

// Mock environment variables for testing
// Use test secret that meets validation requirements (min 32 chars, not default)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-minimum-32-characters-long-for-testing-purposes';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.NODE_ENV = 'test';
process.env.ALLOWED_ORIGINS = '';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Setup test database connection
let testPool: Pool | null = null;

beforeAll(async () => {
  // Verify database connection
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.warn('Test database connection failed. Some tests may fail.');
    console.warn('Set TEST_DATABASE_URL environment variable to point to test database.');
  }
});

afterAll(async () => {
  // Clean up test database connections
  // Note: We don't close the main pool as it's a singleton
  // Individual tests should clean up their own data
});

// Clean up after each test (optional - can be overridden in individual tests)
afterEach(async () => {
  // Individual tests should clean up their own data
  // This is a placeholder for global cleanup if needed
});

