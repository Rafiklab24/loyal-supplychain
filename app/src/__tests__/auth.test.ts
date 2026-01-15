import request from 'supertest';
import bcrypt from 'bcrypt';
import { pool } from '../db/client';
import app from '../index';

describe('Authentication API', () => {
  let testUserId: string;
  const testUser = {
    username: 'testuser',
    password: 'TestPassword123!',
    name: 'Test User',
    role: 'Admin',
  };

  beforeAll(async () => {
    // Create a test user
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    const result = await pool.query(
      'INSERT INTO security.users (username, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [testUser.username, passwordHash, testUser.name, testUser.role]
    );
    testUserId = result.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test user
    await pool.query('DELETE FROM security.users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(testUser.username);
      expect(response.body.user.role).toBe(testUser.role);
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should fail with non-existent username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password',
        });

      expect(response.status).toBe(401);
    });

    it('should fail with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });
      authToken = loginResponse.body.token;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe(testUser.username);
      expect(response.body.role).toBe(testUser.role);
    });

    it('should fail without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/auth/register', () => {
    const newUser = {
      username: 'newuser',
      password: 'NewPassword123!',
      name: 'New User',
      role: 'Logistics',
    };

    afterEach(async () => {
      // Clean up created user
      await pool.query('DELETE FROM security.users WHERE username = $1', [newUser.username]);
    });

    it('should create a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe(newUser.username);
      expect(response.body.user.role).toBe(newUser.role);
    });

    it('should fail with duplicate username', async () => {
      await request(app).post('/api/auth/register').send(newUser);
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser);

      expect(response.status).toBe(409);
    });

    it('should fail with invalid role', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...newUser,
          role: 'InvalidRole',
        });

      expect(response.status).toBe(400);
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test',
        });

      expect(response.status).toBe(400);
    });
  });
});

