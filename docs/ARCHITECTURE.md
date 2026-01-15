# System Architecture

This document describes the architecture of the Loyal Supply Chain Management System.

## Overview

The system is a full-stack supply chain management application with:
- **Backend**: Node.js/Express REST API
- **Frontend**: React/Vite SPA
- **Database**: PostgreSQL
- **Cache**: Redis (optional)
- **Containerization**: Docker

## System Components

### Backend API (`app/`)

**Technology Stack:**
- Node.js 20
- TypeScript
- Express.js
- PostgreSQL (via pg)
- Redis (via ioredis, optional)
- Winston (logging)
- Zod (validation)
- Swagger (API documentation)

**Key Features:**
- RESTful API with versioning (`/api/v1/*`)
- JWT authentication
- Role-based access control
- Database connection pooling
- Request timeouts
- Graceful shutdown
- Health checks
- Prometheus metrics
- Structured logging

**Architecture Layers:**
1. **Routes** (`app/src/routes/`) - HTTP endpoints
2. **Middleware** (`app/src/middleware/`) - Auth, validation, logging
3. **Services** (`app/src/services/`) - Business logic
4. **Database** (`app/src/db/`) - Database client and migrations
5. **Utils** (`app/src/utils/`) - Helper functions

### Frontend (`vibe/`)

**Technology Stack:**
- React 19
- TypeScript
- Vite
- React Router
- TanStack Query (data fetching)
- Tailwind CSS
- i18next (internationalization)

**Key Features:**
- Single Page Application (SPA)
- Responsive design
- Arabic/English support
- Real-time updates
- Form validation
- Error handling

**Architecture:**
- **Pages** (`src/pages/`) - Route components
- **Components** (`src/components/`) - Reusable UI components
- **Services** (`src/services/`) - API clients
- **Hooks** (`src/hooks/`) - Custom React hooks
- **Contexts** (`src/contexts/`) - React contexts (Auth, Permissions)

### Database Schema

**Schemas:**
- `logistics` - Shipments, contracts, proformas
- `master_data` - Companies, ports, products
- `finance` - Transfers, payment schedules
- `security` - Users, roles, audits
- `archive` - Documents

**Key Tables:**
- `logistics.shipments` - Shipment records
- `logistics.contracts` - Sales/purchase contracts
- `logistics.proforma_invoices` - Proforma invoices
- `master_data.companies` - Companies (suppliers, buyers, shipping lines)
- `master_data.ports` - Ports
- `security.users` - User accounts
- `security.audits` - Audit log

## Data Flow

### Request Flow

1. **Client Request** → Frontend (React)
2. **API Call** → Backend API (Express)
3. **Authentication** → JWT validation
4. **Authorization** → Role/permission check
5. **Validation** → Zod schema validation
6. **Business Logic** → Service layer
7. **Database** → PostgreSQL query
8. **Response** → JSON response to client

### Authentication Flow

1. User submits credentials
2. Backend validates credentials
3. Backend generates JWT token
4. Token stored in frontend (localStorage/cookie)
5. Token included in subsequent requests
6. Backend validates token on each request

## Security Architecture

### Authentication
- JWT-based authentication
- Token expiration
- Token theft detection
- Password hashing (bcrypt)

### Authorization
- Role-based access control (RBAC)
- Permission-based access control
- Branch-based data filtering

### Security Features
- Helmet.js security headers
- CORS configuration
- Rate limiting
- Input sanitization
- SQL injection prevention (parameterized queries)
- XSS protection
- CSRF protection

## Deployment Architecture

### Development
- Local PostgreSQL database
- Docker Compose for services
- Hot reload for development

### Production
- Containerized with Docker
- Multi-stage builds
- Health checks
- Graceful shutdown
- Log aggregation
- Metrics collection

## Scalability

### Horizontal Scaling
- Stateless API design
- Database connection pooling
- Redis for session/cache sharing
- Load balancer ready

### Performance Optimization
- Database indexing
- Query optimization
- Caching strategy (Redis)
- Code splitting (frontend)
- Lazy loading

## Monitoring & Observability

### Health Checks
- `/api/v1/health/live` - Liveness probe
- `/api/v1/health/ready` - Readiness probe
- `/api/v1/health` - Detailed health check

### Metrics
- Prometheus metrics at `/metrics`
- Request duration
- Error rates
- Database query times
- Connection pool stats

### Logging
- Structured JSON logging (production)
- File-based logging
- Log levels (error, warn, info, debug)
- Request ID tracking

## Backup & Recovery

### Database Backups
- Automated daily backups
- Compressed SQL dumps
- Retention policy (30 days default)
- Optional S3 upload

### Recovery Procedures
- Point-in-time recovery
- Migration rollback support
- Data restoration scripts

## API Versioning

- Current version: `v1` (`/api/v1/*`)
- Legacy endpoints: `/api/*` (deprecated)
- Version negotiation via headers
- Backward compatibility maintained

## Future Architecture Considerations

- Microservices migration (if needed)
- Event-driven architecture
- GraphQL API (optional)
- Real-time updates (WebSockets)
- Message queue integration
- Service mesh (for microservices)

## Diagrams

### Component Diagram

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP/HTTPS
       │
┌──────▼──────────────────┐
│   Frontend (React)       │
│   - Pages               │
│   - Components          │
│   - Services            │
└──────┬──────────────────┘
       │
       │ REST API
       │
┌──────▼──────────────────┐
│   Backend (Express)     │
│   - Routes              │
│   - Middleware          │
│   - Services            │
└──────┬──────────────────┘
       │
       ├──────────┬──────────┐
       │          │          │
┌──────▼──┐  ┌───▼───┐  ┌───▼───┐
│PostgreSQL│  │ Redis │  │ OpenAI│
│          │  │       │  │  API  │
└──────────┘  └───────┘  └───────┘
```

### Database Schema Overview

```
security
├── users
├── roles
├── permissions
└── audits

logistics
├── shipments
├── contracts
├── contract_lines
├── proforma_invoices
└── shipment_lines

master_data
├── companies
├── ports
└── products

finance
├── transfers
└── payment_schedules
```

## Technology Decisions

### Why TypeScript?
- Type safety
- Better IDE support
- Easier refactoring
- Self-documenting code

### Why Express?
- Mature ecosystem
- Middleware support
- Flexible routing
- Large community

### Why PostgreSQL?
- ACID compliance
- Advanced features (JSONB, arrays)
- Excellent performance
- Open source

### Why React?
- Component-based architecture
- Large ecosystem
- Strong community
- Performance optimizations

### Why Docker?
- Consistent environments
- Easy deployment
- Isolation
- Scalability

## References

- [System Design Document](SYSTEM_DESIGN.md)
- [API Documentation](../README.md#api-endpoints)
- [Deployment Guide](DEPLOYMENT.md)
- [Security Guide](SECURITY.md)

