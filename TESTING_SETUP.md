# Testing Infrastructure Setup

This document describes the testing infrastructure setup for the Loyal Supply Chain system.

## Overview

The testing infrastructure includes:
- **Backend Tests**: Jest with TypeScript for unit and integration tests
- **Frontend Tests**: Vitest with React Testing Library for component tests
- **E2E Tests**: Playwright for end-to-end testing
- **Load Tests**: k6 for performance testing

## Backend Testing (Jest)

### Configuration

- **Config File**: `app/jest.config.js`
- **Setup File**: `app/src/__tests__/setup.ts`
- **Test Helpers**: `app/src/__tests__/helpers/auth.ts`

### Features

- Coverage thresholds: 80% for branches, functions, lines, statements
- Test timeout: 10 seconds
- Module name mapping: `@/` → `src/`
- Automatic test database setup

### Running Tests

```bash
cd app

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Helpers

The `helpers/auth.ts` module provides:
- `createTestUser(role?, username?)` - Create a test user
- `getAuthToken(userId)` - Get JWT token for a user
- `createTestUserWithToken(role?)` - Create user and get token
- `deleteTestUser(userId)` - Delete test user
- `deleteTestUserByUsername(username)` - Delete test user by username

## Frontend Testing (Vitest)

### Configuration

- **Config File**: `vibe/vitest.config.ts`
- **Setup File**: `vibe/src/setupTests.ts`

### Features

- jsdom environment for React components
- Coverage thresholds: 80% for branches, functions, lines, statements
- Path aliases: `@/` → `src/`
- Mocked browser APIs (matchMedia, IntersectionObserver, ResizeObserver)

### Running Tests

```bash
cd vibe

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Dependencies

Required packages (already added to `package.json`):
- `vitest` - Test runner
- `@vitest/ui` - Test UI
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - DOM matchers
- `@testing-library/user-event` - User interaction simulation
- `jsdom` - DOM environment

## E2E Testing (Playwright)

### Configuration

- **Config File**: `e2e/playwright.config.ts`
- **Test Directory**: `e2e/`

### Features

- Chromium browser by default
- Automatic server startup
- Screenshots on failure
- Trace on first retry
- HTML reporter

### Running Tests

```bash
cd e2e

# Install dependencies first
npm install

# Run all E2E tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Run tests in headed mode (see browser)
npm run test:headed

# View test report
npm run test:report
```

### Dependencies

Required packages (in `e2e/package.json`):
- `@playwright/test` - Playwright testing framework

## Load Testing (k6)

### Configuration

- **Test Directory**: `tests/load/k6-scripts/`
- **Documentation**: `tests/load/README.md`

### Installation

```bash
# macOS
brew install k6

# Linux - See https://grafana.com/docs/k6/latest/set-up/install-k6/
# Windows - Download from https://github.com/grafana/k6/releases
```

### Running Load Tests

```bash
# Run auth load test
k6 run tests/load/k6-scripts/auth-load.js

# Run shipments load test
k6 run tests/load/k6-scripts/shipments-load.js

# Run contracts load test
k6 run tests/load/k6-scripts/contracts-load.js

# Run mixed load test
k6 run tests/load/k6-scripts/mixed-load.js
```

### Performance Baselines

- Response time: < 500ms (p95)
- Error rate: < 1%
- Throughput: > 100 req/s
- Database connections: < pool max

## Coverage Requirements

All tests must achieve:
- **80%+ coverage** for:
  - Branches
  - Functions
  - Lines
  - Statements

Coverage reports are generated automatically:
- Backend: `app/coverage/`
- Frontend: `vibe/coverage/`

## Test Structure

### Backend Tests

```
app/src/__tests__/
├── setup.ts                    # Test environment setup
├── helpers/
│   └── auth.ts                 # Authentication test helpers
├── services/                   # Unit tests for services
│   ├── openai.test.ts
│   ├── translation.test.ts
│   └── ...
├── routes/                     # Integration tests for routes
│   ├── shipments.test.ts
│   ├── contracts.test.ts
│   └── ...
└── README.md                   # Testing guide
```

### Frontend Tests

```
vibe/src/__tests__/
├── components/                 # Component tests
│   ├── common/
│   │   ├── ErrorBoundary.test.tsx
│   │   └── ...
│   └── ...
├── pages/                      # Page tests
│   ├── LoginPage.test.tsx
│   └── ...
├── hooks/                      # Hook tests
│   └── useLoadingState.test.ts
└── contexts/                   # Context tests
    └── AuthContext.test.tsx
```

### E2E Tests

```
e2e/
├── auth.spec.ts                # Authentication flow
├── shipments.spec.ts            # Shipments flow
├── contracts.spec.ts           # Contracts flow
├── documents.spec.ts            # Documents flow
└── finance.spec.ts              # Finance flow
```

### Load Tests

```
tests/load/
├── k6-scripts/
│   ├── auth-load.js
│   ├── shipments-load.js
│   ├── contracts-load.js
│   └── mixed-load.js
└── README.md
```

## Environment Variables

### Backend Tests

Set these in your test environment:

```bash
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/test_db
JWT_SECRET=test-secret-key-minimum-32-characters-long
NODE_ENV=test
```

### Frontend Tests

No special environment variables needed.

### E2E Tests

```bash
E2E_BASE_URL=http://localhost:5173  # Optional, defaults to localhost:5173
```

## Best Practices

1. **Test Independence**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `afterAll` hooks
3. **Mocking**: Mock external dependencies (APIs, file system, etc.)
4. **Coverage**: Aim for 80%+ coverage, but focus on critical paths
5. **Naming**: Use descriptive test names that explain what is being tested
6. **Speed**: Keep tests fast - unit tests should be < 100ms, integration tests < 1s
7. **Error Cases**: Test both success and error cases
8. **Edge Cases**: Test boundary conditions and edge cases

## CI/CD Integration

Tests should run automatically in CI/CD:

```yaml
# Example GitHub Actions
- name: Run backend tests
  run: |
    cd app
    npm test
    npm run test:coverage

- name: Run frontend tests
  run: |
    cd vibe
    npm test
    npm run test:coverage

- name: Run E2E tests
  run: |
    cd e2e
    npm install
    npm test
```

## Next Steps

1. ✅ Task 4.1: Testing infrastructure setup (COMPLETE)
2. ⏳ Task 4.2: Write unit tests for services
3. ⏳ Task 4.3: Write integration tests for routes
4. ⏳ Task 4.4: Write frontend component tests
5. ⏳ Task 4.5: Write E2E tests
6. ⏳ Task 4.6: Add load testing scripts

