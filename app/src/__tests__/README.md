# Backend Testing Guide

## Setup

Tests use Jest with TypeScript. The test setup file (`setup.ts`) configures the test environment.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

- `__tests__/` - Test files
- `__tests__/setup.ts` - Test environment setup
- `__tests__/helpers/` - Test helper functions
  - `auth.ts` - Authentication helpers (createTestUser, getAuthToken, etc.)

## Writing Tests

### Example: Integration Test

```typescript
import request from 'supertest';
import app from '../../index';
import { createTestUserWithToken, deleteTestUser } from '../helpers/auth';

describe('My Route', () => {
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const result = await createTestUserWithToken('Admin');
    userId = result.userId;
    token = result.token;
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/api/my-route')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

### Example: Unit Test

```typescript
import { myServiceFunction } from '../../services/myService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    // Mock dependencies
    vi.spyOn(someModule, 'someFunction').mockResolvedValue('mocked');

    const result = await myServiceFunction('input');

    expect(result).toBe('expected');
  });
});
```

## Test Helpers

### Authentication Helpers

- `createTestUser(role?, username?)` - Create a test user
- `getAuthToken(userId)` - Get JWT token for a user
- `createTestUserWithToken(role?)` - Create user and get token
- `deleteTestUser(userId)` - Delete test user
- `deleteTestUserByUsername(username)` - Delete test user by username

## Coverage Requirements

- Minimum 80% coverage for:
  - Branches
  - Functions
  - Lines
  - Statements

## Best Practices

1. Clean up test data in `afterAll` hooks
2. Use unique usernames (helpers auto-generate unique names)
3. Mock external dependencies (APIs, file system, etc.)
4. Test both success and error cases
5. Keep tests independent (no shared state between tests)

