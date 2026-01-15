/**
 * Application Constants
 * Centralized configuration for magic numbers and strings
 * All constants are documented with their purpose and usage
 */

/**
 * Database Connection Pool Configuration
 */
export const DB_POOL = {
  /** Maximum number of clients in the pool */
  MAX_CONNECTIONS: 20,
  /** How long a client can sit idle in the pool before being closed (milliseconds) */
  IDLE_TIMEOUT_MS: 30000, // 30 seconds
  /** How long to wait when acquiring a connection from the pool (milliseconds) */
  CONNECTION_TIMEOUT_MS: 2000, // 2 seconds
} as const;

/**
 * JWT Token Configuration
 * Note: JWT_SECRET and JWT_EXPIRES_IN are loaded from environment variables
 * These are default values used when env vars are not set
 */
export const JWT = {
  /** Default token expiration time in development */
  DEFAULT_EXPIRATION_DEV: '24h',
  /** Default token expiration time in production */
  DEFAULT_EXPIRATION_PROD: '1h',
} as const;

/**
 * Authentication & Security Configuration
 */
export const AUTH = {
  /** Maximum number of failed login attempts before account lockout */
  MAX_FAILED_ATTEMPTS: 5,
  /** Account lockout duration in milliseconds (30 minutes) */
  LOCKOUT_DURATION_MS: 30 * 60 * 1000,
  /** Number of bcrypt rounds for password hashing (higher = more secure but slower) */
  BCRYPT_ROUNDS: 10,
} as const;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT = {
  /** Rate limit window duration in milliseconds (15 minutes) */
  WINDOW_MS: 15 * 60 * 1000,
  /** Maximum requests per window in production */
  MAX_REQUESTS_PROD: 100,
  /** Maximum requests per window in development */
  MAX_REQUESTS_DEV: 1000,
  /** Maximum authentication attempts per window */
  MAX_AUTH_ATTEMPTS: 10,
  /** Maximum password reset attempts per hour */
  MAX_PASSWORD_RESET_ATTEMPTS: 5,
  /** Password reset window duration in milliseconds (1 hour) */
  PASSWORD_RESET_WINDOW_MS: 60 * 60 * 1000,
  /** Maximum document uploads per window */
  MAX_DOCUMENT_UPLOADS: 20,
} as const;

/**
 * Pagination Configuration
 */
export const PAGINATION = {
  /** Default number of items per page */
  DEFAULT_LIMIT: 20,
  /** Maximum number of items per page (prevents excessive data transfer) */
  MAX_LIMIT: 100,
} as const;

/**
 * Request Body Size Limits
 */
export const REQUEST_LIMITS = {
  /** Maximum JSON body size (10MB) */
  JSON_BODY_LIMIT: '10mb',
  /** Maximum URL-encoded body size (10MB) */
  URL_ENCODED_LIMIT: '10mb',
} as const;

/**
 * Transaction Retry Configuration
 */
export const TRANSACTION = {
  /** Maximum number of retry attempts for deadlock errors */
  MAX_RETRIES: 3,
  /** Initial delay between retries in milliseconds */
  RETRY_DELAY_MS: 100,
} as const;

