# JWT Authentication Setup Instructions

## Backend Configuration

### 1. Update app/.env file

Add these environment variables to `/Users/rafik/loyal-supplychain/app/.env`:

```bash
# JWT Authentication Configuration
JWT_SECRET=your-strong-random-secret-key-change-in-production
JWT_EXPIRES_IN=24h
```

### 2. Generate a Secure JWT Secret

For production, generate a strong random secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and replace `your-strong-random-secret-key-change-in-production` with it.

### 3. Create Initial Admin User

After starting the backend, create an initial admin user:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "change-this-password",
    "name": "System Administrator",
    "role": "Admin"
  }'
```

**IMPORTANT**: Change the password immediately after setup!

### 4. Available User Roles

- `Exec` - Executive
- `Correspondence` - Correspondence team
- `Logistics` - Logistics team
- `Procurement` - Procurement team
- `Inventory` - Inventory management
- `Clearance` - Customs clearance
- `Accounting` - Accounting team
- `Admin` - System administrators

## What Changed

### Backend

1. **New Authentication Middleware** (`app/src/middleware/auth.ts`)
   - JWT token verification
   - Role-based authorization helpers

2. **New Auth Routes** (`app/src/routes/auth.ts`)
   - `POST /api/auth/login` - User login (returns JWT token)
   - `POST /api/auth/register` - Create new user
   - `GET /api/auth/me` - Get current user info

3. **Protected API Routes**
   All API routes except `/api/health` and `/api/auth/*` now require authentication.
   
   To access protected endpoints, include the JWT token in the Authorization header:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

4. **Security Enhancements**
   - Helmet.js for security headers
   - Express rate limiting (100 requests per 15 minutes)
   - Stricter auth rate limiting (5 login attempts per 15 minutes)
   - Request body size limits (10MB)
   - Password hashing with bcrypt (10 salt rounds)

### Testing the New Auth System

#### 1. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "name": "System Administrator",
    "role": "Admin"
  }
}
```

#### 2. Access Protected Endpoint
```bash
TOKEN="your-jwt-token-here"

curl http://localhost:3000/api/shipments \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Get Current User Info
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## Next Steps

The frontend needs to be updated to:
1. Use real JWT tokens instead of mock authentication
2. Send JWT token in Authorization header for all API requests
3. Handle token expiration and refresh

See the next section for frontend updates.

