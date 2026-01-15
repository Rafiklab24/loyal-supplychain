import { pool } from '../../db/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export interface TestUser {
  id: string;
  username: string;
  role: string;
  name: string;
}

/**
 * Create a test user in the database
 * @param role - User role (default: 'user')
 * @param username - Optional custom username (default: auto-generated)
 * @returns User ID
 */
export async function createTestUser(role: string = 'user', username?: string): Promise<string> {
  const testUsername = username || `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);
  
  const result = await pool.query(
    `INSERT INTO security.users (username, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [testUsername, passwordHash, 'Test User', role]
  );
  
  return result.rows[0].id;
}

/**
 * Get authentication token for a user
 * @param userId - User ID
 * @returns JWT token
 */
export async function getAuthToken(userId: string): Promise<string> {
  const userResult = await pool.query(
    'SELECT username, role FROM security.users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length === 0) {
    throw new Error(`User with id ${userId} not found`);
  }
  
  const user = userResult.rows[0];
  // Use test secret that meets validation requirements (min 32 chars, not default)
  const jwtSecret = process.env.JWT_SECRET || 'test-secret-key-minimum-32-characters-long-for-testing-purposes';
  
  return jwt.sign(
    { id: userId, username: user.username, role: user.role },
    jwtSecret,
    { expiresIn: '1h' }
  );
}

/**
 * Create a test user and return both user ID and auth token
 * @param role - User role (default: 'user')
 * @returns Object with userId and token
 */
export async function createTestUserWithToken(role: string = 'user'): Promise<{ userId: string; token: string }> {
  const userId = await createTestUser(role);
  const token = await getAuthToken(userId);
  return { userId, token };
}

/**
 * Delete a test user by ID
 * @param userId - User ID to delete
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await pool.query('DELETE FROM security.users WHERE id = $1', [userId]);
}

/**
 * Delete a test user by username
 * @param username - Username to delete
 */
export async function deleteTestUserByUsername(username: string): Promise<void> {
  await pool.query('DELETE FROM security.users WHERE username = $1', [username]);
}

