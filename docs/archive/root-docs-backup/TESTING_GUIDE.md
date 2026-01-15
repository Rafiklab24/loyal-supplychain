# Testing Guide

## Backend API Tests

### Setup

The backend uses Jest and Supertest for API testing.

```bash
cd app
npm test
```

### Test Suites

1. **Authentication Tests** (`src/__tests__/auth.test.ts`)
   - Login with valid/invalid credentials
   - User registration
   - Token validation
   - Protected route access

2. **Health Check Tests** (`src/__tests__/health.test.ts`)
   - Health endpoint availability
   - Dashboard statistics
   - API documentation endpoint

3. **Security Tests** (`src/__tests__/security.test.ts`)
   - Protected routes require authentication
   - SQL injection prevention
   - Rate limiting verification
   - Security headers validation

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Database

**IMPORTANT**: Tests run against your configured `DATABASE_URL`. Make sure you're using a test database, not production!

For testing, consider setting up a separate test database:

```bash
# In app/.env.test
DATABASE_URL=postgresql://user:password@localhost:5432/loyal_supplychain_test
```

### Writing New Tests

1. Create test files in `app/src/__tests__/`
2. Name files with `.test.ts` extension
3. Use describe blocks for grouping related tests
4. Clean up test data in `afterEach` or `afterAll` hooks

Example:

```typescript
import request from 'supertest';
import app from '../index';

describe('My Feature API', () => {
  it('should do something', async () => {
    const response = await request(app)
      .get('/api/my-endpoint')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
  });
});
```

## Frontend Tests (TODO)

Frontend testing with Vitest is planned but not yet implemented.

## Manual Testing

### Prerequisites

1. Backend running on port 3000
2. Frontend running on port 5173
3. PostgreSQL database configured
4. Test user created in database

### Manual Test Checklist

#### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Logout functionality
- [ ] Token persists on page refresh
- [ ] Expired token redirects to login

#### Shipments Module
- [ ] List shipments with pagination
- [ ] Filter shipments by status, port, product
- [ ] Search shipments
- [ ] Create new shipment
- [ ] Edit shipment
- [ ] Delete shipment
- [ ] View shipment details

#### Contracts Module
- [ ] List contracts
- [ ] Create new contract
- [ ] Add contract lines (products)
- [ ] Add payment schedules
- [ ] Link contract to shipment
- [ ] View contract details
- [ ] Edit contract
- [ ] Contract status transitions

#### Finance Module
- [ ] List transactions
- [ ] Filter by date, direction, fund
- [ ] Create new transaction
- [ ] Link transaction to shipment
- [ ] View balance calculations
- [ ] Fund management
- [ ] Party management

#### Companies Module
- [ ] List companies
- [ ] Filter by role (supplier, customer, etc.)
- [ ] Create new company
- [ ] Edit company
- [ ] View company details

#### Documents
- [ ] Upload documents
- [ ] View uploaded documents
- [ ] Download documents
- [ ] AI extraction from proforma invoices
- [ ] Link documents to shipments/contracts

#### General
- [ ] Language switching (Arabic/English)
- [ ] RTL layout in Arabic
- [ ] Mobile responsiveness
- [ ] Error handling displays correctly
- [ ] Loading states show spinners
- [ ] Navigation works correctly

## Security Testing

### SQL Injection Tests

Try these malicious inputs in search fields and filters:

```
' OR '1'='1
'; DROP TABLE logistics.shipments; --
admin'--
' UNION SELECT * FROM security.users--
```

All should be handled safely without errors or data leaks.

### Authentication Bypass Attempts

1. Try accessing protected API endpoints without token
2. Try using invalid/expired tokens
3. Try manipulating JWT token payload
4. Try accessing endpoints with different user roles

### Rate Limiting Tests

Make rapid requests to:
- `/api/auth/login` (should be limited to 5 per 15 min)
- Any API endpoint (should be limited to 100 per 15 min)

### File Upload Tests

Try uploading:
- Very large files (>10MB)
- Invalid file types (exe, php, etc.)
- Files with malicious names (`../../etc/passwd`)

## Performance Testing

### Load Testing

Use tools like Apache Bench or Artillery:

```bash
# Test health endpoint
ab -n 1000 -c 10 http://localhost:3000/api/health

# Test authenticated endpoint
ab -n 100 -c 5 -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/shipments
```

### Database Query Performance

Check slow queries:

```sql
-- Enable query timing
\timing

-- Test complex queries
EXPLAIN ANALYZE SELECT * FROM logistics.shipments 
WHERE status = 'arrived' 
ORDER BY eta DESC 
LIMIT 20;
```

## Continuous Integration

For CI/CD pipelines, add this to your workflow:

```yaml
- name: Run Backend Tests
  run: |
    cd app
    npm test
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: test-secret
```

## Test Coverage Goals

- **Critical paths**: 100% (auth, payments, security)
- **API routes**: >80%
- **Utilities**: >70%
- **Overall**: >75%

## Reporting Issues

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Error messages/logs
5. Browser/environment details

