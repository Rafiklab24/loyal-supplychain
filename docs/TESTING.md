# Testing Guide

This guide covers testing strategies, tools, and best practices for the Loyal Supply Chain system.

## Testing Strategy

### Testing Pyramid

```
        /\
       /  \  E2E Tests (few)
      /____\
     /      \  Integration Tests (some)
    /________\
   /          \  Unit Tests (many)
  /____________\
```

### Test Types

1. **Unit Tests** - Test individual functions/components
2. **Integration Tests** - Test API endpoints with database
3. **E2E Tests** - Test full user workflows (Playwright)

## Backend Testing

### Setup

```bash
cd app
npm install
```

### Test Configuration

Tests use Jest with TypeScript support:
- Configuration: `jest.config.js`
- Test files: `**/__tests__/**/*.ts`
- Coverage: `coverage/` directory

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Tests

**Example Unit Test:**
```typescript
// app/src/__tests__/utils/format.test.ts
import { formatCurrency } from '../../utils/format';

describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    expect(formatCurrency(1000, 'USD')).toBe('$1,000.00');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });
});
```

**Example Integration Test:**
```typescript
// app/src/__tests__/routes/shipments.test.ts
import request from 'supertest';
import app from '../../index';

describe('GET /api/v1/shipments', () => {
  it('should return shipments', async () => {
    const response = await request(app)
      .get('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toBeInstanceOf(Array);
  });
});
```

### Test Database

Tests use a separate test database:
- Environment: `NODE_ENV=test`
- Database: Configured via `DATABASE_URL`
- Cleanup: Database reset between test suites

### Mocking

**Mock external services:**
```typescript
jest.mock('../services/openai', () => ({
  extractFromProformaInvoice: jest.fn(),
}));
```

**Mock database:**
```typescript
jest.mock('../db/client', () => ({
  pool: {
    query: jest.fn(),
  },
}));
```

## Frontend Testing

### Setup

```bash
cd vibe
npm install
```

### Test Configuration

Tests use Vitest with React Testing Library:
- Configuration: `vitest.config.ts`
- Test files: `**/__tests__/**/*.tsx`
- Coverage: `coverage/` directory

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

### Writing Tests

**Example Component Test:**
```typescript
// vibe/src/__tests__/components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('should render button text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    screen.getByText('Click me').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Example Hook Test:**
```typescript
// vibe/src/__tests__/hooks/useShipments.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useShipments } from '../hooks/useShipments';

describe('useShipments', () => {
  it('should fetch shipments', async () => {
    const { result } = renderHook(() => useShipments());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });
});
```

### Mocking API Calls

```typescript
import { vi } from 'vitest';
import * as api from '../services/api';

vi.spyOn(api, 'getShipments').mockResolvedValue({
  data: [{ id: '1', name: 'Test' }],
});
```

## E2E Testing

### Setup

E2E tests use Playwright:
- Configuration: `e2e/playwright.config.ts`
- Tests: `e2e/**/*.spec.ts`

### Running E2E Tests

```bash
# Install Playwright
npx playwright install

# Run tests
npx playwright test

# Run in UI mode
npx playwright test --ui
```

### Writing E2E Tests

```typescript
// e2e/shipments.spec.ts
import { test, expect } from '@playwright/test';

test('should create a shipment', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Login
  await page.fill('[name="username"]', 'admin');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to shipments
  await page.click('text=Shipments');
  
  // Create shipment
  await page.click('text=New Shipment');
  await page.fill('[name="contract_no"]', 'SN-2025-001');
  await page.click('button:has-text("Create")');

  // Verify
  await expect(page.locator('text=SN-2025-001')).toBeVisible();
});
```

## Test Coverage

### Coverage Goals

- **Unit tests**: >80% coverage
- **Integration tests**: Critical paths covered
- **E2E tests**: Main user workflows

### Coverage Reports

```bash
# Backend
cd app && npm run test:coverage
# Open: app/coverage/index.html

# Frontend
cd vibe && npm run test:coverage
# Open: vibe/coverage/index.html
```

## CI/CD Testing

### GitHub Actions

Tests run automatically on:
- Every pull request
- Every push to main/develop
- Manual workflow dispatch

### Test Pipeline

1. **Lint** - Code quality checks
2. **Unit Tests** - Fast feedback
3. **Integration Tests** - API tests
4. **E2E Tests** - Full workflow tests
5. **Coverage** - Upload to Codecov

## Testing Best Practices

### Do's

✅ Write tests before fixing bugs (TDD)
✅ Test edge cases and error conditions
✅ Use descriptive test names
✅ Keep tests independent
✅ Mock external dependencies
✅ Test user-facing behavior
✅ Maintain high coverage

### Don'ts

❌ Test implementation details
❌ Write flaky tests
❌ Skip error cases
❌ Test third-party libraries
❌ Write slow tests unnecessarily
❌ Ignore test failures

## Debugging Tests

### Backend

```bash
# Run single test file
npm test -- shipments.test.ts

# Run with debugging
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Frontend

```bash
# Run single test
npm test -- Button.test.tsx

# Debug in browser
npm run test:ui
```

## Performance Testing

### Load Testing

Use tools like:
- **k6** - Load testing tool
- **Artillery** - Node.js load testing
- **Apache Bench** - Simple HTTP benchmarking

### Example k6 Test

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('http://localhost:3000/api/v1/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

## Test Data Management

### Fixtures

Create reusable test data:
```typescript
// app/src/__tests__/fixtures/shipments.ts
export const mockShipment = {
  id: 'test-id',
  contract_no: 'SN-2025-001',
  // ...
};
```

### Database Seeding

Seed test database with known data:
```typescript
// app/src/__tests__/helpers/seed.ts
export async function seedTestData() {
  await pool.query('INSERT INTO ...');
}
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

