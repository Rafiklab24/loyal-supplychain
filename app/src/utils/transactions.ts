/**
 * Transaction Utility
 * Provides safe transaction handling with automatic rollback and connection management
 */

import { PoolClient } from 'pg';
import { pool } from '../db/client';
import logger from './logger';

/**
 * Execute a callback within a database transaction
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and connection release
 * 
 * @param callback - Function that receives a PoolClient and returns a Promise
 * @returns The result of the callback
 * @throws The error that occurred (after rollback)
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a callback within a database transaction with retry logic for deadlocks
 * Useful for operations that might encounter deadlock errors (40001)
 * 
 * @param callback - Function that receives a PoolClient and returns a Promise
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelayMs - Delay between retries in milliseconds (default: 100)
 * @returns The result of the callback
 * @throws The error that occurred after all retries exhausted
 */
export async function withTransactionRetry<T>(
  callback: (client: PoolClient) => Promise<T>,
  maxRetries: number = 3,
  retryDelayMs: number = 100
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error: any) {
      await client.query('ROLLBACK');
      client.release();
      
      // Check if it's a deadlock error (PostgreSQL error code 40001)
      const isDeadlock = error?.code === '40001' || 
                        error?.message?.toLowerCase().includes('deadlock');
      
      if (isDeadlock && attempt < maxRetries) {
        lastError = error;
        const delay = retryDelayMs * attempt; // Exponential backoff
        logger.warn(`Transaction deadlock detected, retrying (attempt ${attempt}/${maxRetries})`, {
          attempt,
          maxRetries,
          delayMs: delay,
          error: error instanceof Error ? error.message : String(error),
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Not a deadlock or retries exhausted
      logger.error('Transaction failed', {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        isDeadlock,
      });
      throw error;
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Transaction failed after all retries');
}



