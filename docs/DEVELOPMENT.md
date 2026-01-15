# Development Guide

This guide covers development setup, code style, git workflow, and debugging for the Loyal Supply Chain system.

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for caching)
- Git

### Initial Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd loyal-supplychain
```

2. **Install dependencies:**
```bash
# Root dependencies (for ETL scripts)
npm install

# Backend dependencies
cd app
npm install

# Frontend dependencies
cd ../vibe
npm install
```

3. **Set up environment variables:**
```bash
# Backend
cd app
cp .env.example .env
# Edit .env with your configuration

# Frontend (if needed)
cd ../vibe
cp .env.example .env.local
```

4. **Set up database:**
```bash
cd app
npm run db:up  # Run migrations
```

5. **Start development servers:**
```bash
# Terminal 1: Backend
cd app
npm run dev

# Terminal 2: Frontend
cd vibe
npm run dev
```

### Docker Development

For a fully containerized development environment:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Run migrations
docker-compose exec backend npm run db:up

# Access services
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

## Code Style

### TypeScript

- Use TypeScript strict mode (enabled in `tsconfig.json`)
- Avoid `any` types - use proper types or `unknown`
- Use interfaces for object shapes
- Use enums for constants
- Prefer `const` over `let`, avoid `var`

### ESLint

The project uses ESLint for code quality:

```bash
# Backend
cd app
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues

# Frontend
cd vibe
npm run lint
```

### Prettier

Code formatting is handled by Prettier:

```bash
# Format all code
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks

Husky runs lint-staged on every commit:
- Automatically fixes ESLint issues
- Formats code with Prettier
- Prevents commits with linting errors

## Git Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches
- `hotfix/*` - Critical production fixes

### Commit Messages

Follow conventional commits:

```
feat: add user authentication
fix: resolve database connection issue
docs: update API documentation
refactor: simplify shipment validation
test: add unit tests for contracts API
chore: update dependencies
```

### Pull Request Process

1. Create a feature branch from `develop`
2. Make changes and commit
3. Push to remote
4. Create a pull request
5. Ensure CI passes
6. Get code review approval
7. Merge to `develop`

## Testing

### Running Tests

```bash
# Backend tests
cd app
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Frontend tests
cd vibe
npm test
npm run test:watch
npm run test:coverage
```

### Writing Tests

- Use Jest for backend tests
- Use Vitest for frontend tests
- Write unit tests for utilities
- Write integration tests for API endpoints
- Aim for >80% code coverage

### Test Structure

```typescript
// Example test
describe('ShipmentService', () => {
  it('should create a shipment', async () => {
    // Arrange
    const shipmentData = { ... };
    
    // Act
    const result = await createShipment(shipmentData);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
  });
});
```

## Debugging

### Backend Debugging

1. **Use VS Code debugger:**
   - Set breakpoints in TypeScript files
   - Use "Node.js: Attach" configuration
   - Or use "Node.js: Current File" to debug scripts

2. **Console logging:**
   ```typescript
   import logger from './utils/logger';
   
   logger.debug('Debug message', { data });
   logger.info('Info message');
   logger.error('Error message', { error });
   ```

3. **Database queries:**
   - Enable query logging in development
   - Use `EXPLAIN ANALYZE` for slow queries
   - Check connection pool metrics

### Frontend Debugging

1. **Browser DevTools:**
   - Use React DevTools extension
   - Check Network tab for API calls
   - Use Console for debugging

2. **VS Code debugging:**
   - Use Chrome debugger configuration
   - Set breakpoints in TypeScript/TSX files

3. **Error boundaries:**
   - React error boundaries catch component errors
   - Check error logs in browser console

## Database Development

### Running Migrations

```bash
cd app
npm run db:up    # Apply all pending migrations
npm run db:down  # Rollback last migration
```

### Creating Migrations

1. Create SQL file in `app/src/db/migrations/`
2. Name it: `YYYYMMDD_HHMMSS_description.sql`
3. Write idempotent SQL (use `IF NOT EXISTS`)
4. Test locally before committing

See [app/src/db/migrations/README.md](../app/src/db/migrations/README.md) for details.

### Database Queries

```bash
# Connect to database
psql $DATABASE_URL

# Or use Docker
docker-compose exec postgres psql -U postgres -d loyal_supplychain
```

## API Development

### Adding New Endpoints

1. Create route file in `app/src/routes/`
2. Add route to `app/src/index.ts`
3. Add validation with Zod
4. Add error handling
5. Document with Swagger JSDoc
6. Write tests

### API Versioning

All new endpoints should use `/api/v1/*`:
- Legacy endpoints at `/api/*` are deprecated
- New features go in v1
- Breaking changes require new version

### Swagger Documentation

Document endpoints with JSDoc:

```typescript
/**
 * @swagger
 * /api/v1/shipments:
 *   get:
 *     summary: Get all shipments
 *     tags: [Shipments]
 *     responses:
 *       200:
 *         description: List of shipments
 */
router.get('/', async (req, res) => {
  // ...
});
```

View documentation at `/api-docs` when server is running.

## Performance

### Backend Performance

- Use database indexes for frequently queried fields
- Implement caching for lookup tables
- Use connection pooling (configured in `app/src/db/client.ts`)
- Monitor with Prometheus metrics (`/metrics`)

### Frontend Performance

- Use React.memo for expensive components
- Implement code splitting
- Lazy load routes
- Optimize bundle size

## Troubleshooting

### Common Issues

1. **Database connection fails:**
   - Check `DATABASE_URL` in `.env`
   - Verify PostgreSQL is running
   - Check connection pool limits

2. **Migrations fail:**
   - Check migration file syntax
   - Verify database permissions
   - Check for conflicting migrations

3. **Tests fail:**
   - Ensure test database is set up
   - Check environment variables
   - Verify test data is correct

4. **Build fails:**
   - Clear `node_modules` and reinstall
   - Check TypeScript errors
   - Verify all dependencies installed

### Getting Help

1. Check logs: `app/logs/combined.log`
2. Review health check: `GET /api/v1/health`
3. Check metrics: `GET /metrics`
4. Review API docs: `/api-docs`
5. Check GitHub Issues

## Code Review Checklist

Before submitting a PR:

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Code is properly typed
- [ ] No console.log statements (use logger)
- [ ] Error handling is implemented
- [ ] API endpoints are documented
- [ ] Migrations are idempotent
- [ ] No sensitive data in code
- [ ] Environment variables documented

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

