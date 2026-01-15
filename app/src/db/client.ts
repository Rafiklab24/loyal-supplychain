import { Pool, types } from 'pg';
import { DB_POOL } from '../config/constants';
import logger from '../utils/logger';

// PostgreSQL OID for DATE type is 1082
// Override the default date parser to return raw strings instead of JavaScript Date objects
// This prevents timezone conversion issues
types.setTypeParser(1082, (val: string) => val); // DATE
types.setTypeParser(1114, (val: string) => val); // TIMESTAMP without timezone
types.setTypeParser(1184, (val: string) => val); // TIMESTAMP with timezone

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Configure SSL for managed databases (DigitalOcean, AWS RDS, Supabase, etc.)
// These services use self-signed certificates that require rejectUnauthorized: false
const databaseUrl = process.env.DATABASE_URL.toLowerCase();
const isLocalDatabase = databaseUrl.includes('localhost') || 
                        databaseUrl.includes('127.0.0.1') ||
                        databaseUrl.includes('host.docker.internal');

// Enable SSL for all non-local databases (managed cloud databases)
const sslConfig = !isLocalDatabase 
  ? { rejectUnauthorized: false }  // Accept self-signed certs from managed DBs
  : undefined;  // No SSL for local development

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: DB_POOL.MAX_CONNECTIONS,
  idleTimeoutMillis: DB_POOL.IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_POOL.CONNECTION_TIMEOUT_MS,
  ssl: sslConfig,
});

// Pool event listeners for monitoring
pool.on('error', (err) => {
  logger.error('Unexpected pool error', { error: err.message, stack: err.stack });
});

pool.on('connect', (_client) => {
  logger.debug('New database client connected', {
    total: pool.totalCount,
    idle: pool.idleCount,
  });
});

pool.on('acquire', (_client) => {
  logger.debug('Client acquired from pool', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
});

pool.on('remove', (_client) => {
  logger.debug('Client removed from pool', {
    total: pool.totalCount,
    idle: pool.idleCount,
  });
});

// Pool health check function
export async function checkPoolHealth() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: pool.options.max,
    healthy: pool.totalCount < (pool.options.max || 20) && pool.waitingCount === 0,
  };
}

// Pool metrics function
export function getPoolMetrics() {
  const max = pool.options.max || 20;
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max,
    utilization: (pool.totalCount / max) * 100,
  };
}

export default pool;

