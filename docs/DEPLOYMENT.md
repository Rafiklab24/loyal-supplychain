# Deployment Guide

This guide covers deployment procedures for the Loyal Supply Chain API.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Redis (optional, for caching)
- Environment variables configured

## Environment Setup

1. **Copy environment template:**
```bash
cd app
cp .env.example .env
```

2. **Configure environment variables:**
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Secret key for JWT (minimum 32 characters)
   - `PORT` - Server port (default: 3000)
   - `NODE_ENV` - Environment (development/production/test)
   - `OPENAI_API_KEY` - Optional, for document extraction
   - `REDIS_URL` - Optional, for caching

3. **Validate environment:**
```bash
npm run build
```

## Building

```bash
cd app
npm install
npm run build
```

The build output will be in `app/dist/`.

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## Health Checks

The API provides several health check endpoints:

- `GET /api/v1/health` - Detailed health check
- `GET /api/v1/health/live` - Liveness probe (Kubernetes)
- `GET /api/v1/health/ready` - Readiness probe (Kubernetes)

## Monitoring

### Metrics Endpoint

Prometheus metrics are available at:
- `GET /metrics`

### Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

In production, logs are in JSON format for log aggregation systems.

## Graceful Shutdown

The application handles SIGTERM and SIGINT signals gracefully:

1. Stops accepting new requests
2. Waits for in-flight requests to complete (30s timeout)
3. Closes database connection pool
4. Exits cleanly

## API Documentation

Swagger documentation is available at:
- `http://localhost:3000/api-docs`
- `http://localhost:3000/api-docs.json` (JSON format)

## Database Migrations

Run migrations before starting the application:

```bash
npm run db:up
```

## Backup Strategy

See `scripts/backup/README.md` for backup and restore procedures.

## Docker Deployment

### Dockerfile Example

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/db
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=loyal_supplychain
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes Deployment

### Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loyal-supplychain-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: loyal-supplychain-api
  template:
    metadata:
      labels:
        app: loyal-supplychain-api
    spec:
      containers:
      - name: api
        image: loyal-supplychain-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: JWT_SECRET
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

## Performance Tuning

### Database Connection Pool

Configure in `app/src/config/constants.ts`:
- `MAX_CONNECTIONS` - Maximum pool size (default: 20)
- `IDLE_TIMEOUT_MS` - Idle timeout (default: 30000ms)
- `CONNECTION_TIMEOUT_MS` - Connection timeout (default: 2000ms)

### Request Timeouts

Default timeout: 30 seconds
Custom timeouts can be set per route using `withTimeout()` middleware.

### Caching

Enable Redis caching by setting `REDIS_URL`. The application will fall back to in-memory cache if Redis is unavailable.

## Security

1. **Secrets Management** - See `docs/SECRETS.md`
2. **Rate Limiting** - Configured per environment
3. **CORS** - Whitelist origins in production
4. **Helmet** - Security headers enabled
5. **Input Validation** - Zod schemas for all inputs

## Troubleshooting

### Application won't start

1. Check environment variables are set
2. Verify database connection
3. Check logs: `tail -f logs/combined.log`

### High memory usage

1. Check for memory leaks
2. Review database query performance
3. Enable Redis caching
4. Monitor with `/metrics` endpoint

### Database connection issues

1. Verify `DATABASE_URL` is correct
2. Check database is accessible
3. Review connection pool metrics in health check
4. Check database logs

## Rollback Procedure

1. **Stop application:**
```bash
# Kubernetes
kubectl rollout undo deployment/loyal-supplychain-api

# Docker
docker-compose down
```

2. **Restore database** (if needed):
```bash
./scripts/backup/restore-database.sh <backup_file>
```

3. **Restart application**

## Monitoring Checklist

- [ ] Health checks configured
- [ ] Metrics endpoint accessible
- [ ] Logs being collected
- [ ] Alerts configured
- [ ] Database backups scheduled
- [ ] Secrets rotated regularly

## Support

For issues or questions:
1. Check logs: `logs/combined.log`
2. Review health check: `/api/v1/health`
3. Check metrics: `/metrics`
4. Review API documentation: `/api-docs`

