# 👥 User Management System

## Overview

The User Management system is an **admin-only** dashboard where administrators can create, view, and manage system users with different roles and permissions.

---

## Access

### Who Can Access?
- **Only users with Admin role** can access the User Management dashboard
- Other users will see an "Access Denied" message if they try to access `/users`

### How to Access?
1. Login as an Admin user
2. Look for **"User Management"** in the sidebar (purple highlighted button at the top)
3. Click to access the users dashboard

---

## Features

### 1. View All Users
- See a complete list of all users in the system
- View user details:
  - Username
  - Full Name
  - Role
  - Contact Info (email/phone)
  - Account creation date

### 2. Create New Users
1. Click the **"Create New User"** button in the top right
2. Fill in the required information:
   - **Username** (required) - Must be unique
   - **Password** (required) - Minimum 6 characters
   - **Full Name** (required)
   - **Role** (required) - Select from available roles
   - **Email** (optional)
   - **Phone** (optional)
3. Click **"Create User"**
4. User will receive their credentials and can login immediately

### 3. User Roles Available

| Role | Description |
|------|-------------|
| **Admin** | Full system access + user management |
| **Exec** | Executive level access |
| **Correspondence** | Correspondence team |
| **Logistics** | Logistics operations |
| **Procurement** | Procurement team |
| **Inventory** | Inventory management |
| **Clearance** | Customs clearance |
| **Accounting** | Financial/accounting team |

---

## User Creation Workflow

### Step 1: Admin Creates User
```bash
# Via UI
Admin → User Management → Create New User → Fill Form → Submit
```

### Step 2: Share Credentials
After creating a user, the admin should securely share:
- Username
- Temporary password
- Login URL: http://localhost:5173/login

### Step 3: User First Login
1. User logs in with provided credentials
2. User can access features based on their role
3. (Future) User should change password on first login

---

## API Endpoints

### List All Users (Admin Only)
```bash
GET /api/auth/users
Authorization: Bearer <admin-token>

Response:
{
  "users": [
    {
      "id": "uuid",
      "username": "john.doe",
      "name": "John Doe",
      "role": "Logistics",
      "email": "john@example.com",
      "phone": "+1234567890",
      "created_at": "2025-11-25T12:00:00Z"
    }
  ],
  "count": 10
}
```

### Create User (Admin Only)
```bash
POST /api/auth/register
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "username": "new.user",
  "password": "SecurePass123!",
  "name": "New User",
  "role": "Logistics",
  "email": "user@example.com",
  "phone": "+1234567890"
}

Response:
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "username": "new.user",
    "name": "New User",
    "role": "Logistics",
    "created_at": "2025-11-25T12:00:00Z"
  }
}
```

---

## Security Features

### Access Control
- ✅ Only Admin role can access user management
- ✅ Non-admin users see "Access Denied" page
- ✅ API endpoints protected with JWT authentication
- ✅ Role verification on every request

### Password Security
- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ Minimum 6 characters required
- ✅ Never displayed or transmitted in responses

### Audit Trail
- ✅ All user creation logged to database
- ✅ Timestamps recorded for accountability
- ✅ Creator information tracked (future feature)

---

## Best Practices

### Creating Users
1. ✅ Use descriptive usernames (e.g., `john.logistics` instead of `user123`)
2. ✅ Assign appropriate roles based on job function
3. ✅ Add email/phone for contact purposes
4. ✅ Use strong temporary passwords
5. ✅ Share credentials securely (not via email)

### Managing Users
1. ✅ Regularly review user list for inactive accounts
2. ✅ Update user roles when responsibilities change
3. ✅ Deactivate users who leave the organization (future feature)
4. ✅ Monitor login activity (future feature)

---

## Future Enhancements

### Planned Features
- [ ] Edit user information
- [ ] Delete/deactivate users
- [ ] Force password reset
- [ ] User activity logs
- [ ] Role permissions matrix
- [ ] Bulk user import (CSV)
- [ ] Password complexity requirements
- [ ] Two-factor authentication (2FA)
- [ ] Session management
- [ ] Login history

---

## Troubleshooting

### "Access Denied" Message
**Problem**: User sees access denied when visiting `/users`  
**Solution**: User must have Admin role. Check user role in database or contact another admin.

### "Failed to Create User"
**Problem**: User creation fails  
**Possible Causes**:
1. Username already exists → Choose different username
2. Invalid role selected → Select from dropdown
3. Password too short → Use at least 6 characters
4. Network error → Check backend is running

### Can't See Users List
**Problem**: Users list is empty  
**Solutions**:
1. Check if backend is running: `http://localhost:3000/api/health`
2. Verify JWT token is valid (try logging out and back in)
3. Check browser console for errors
4. Verify database has users: `SELECT * FROM security.users;`

---

## Examples

### Creating a Logistics User
```
Username: ali.logistics
Password: Logistics123!
Name: Ali Hassan
Role: Logistics
Email: ali@company.com
Phone: +962-7-1234-5678
```

### Creating an Accounting User
```
Username: sara.accounting
Password: Accounts123!
Name: Sara Mohammed
Role: Accounting
Email: sara@company.com
Phone: +962-7-8765-4321
```

---

## Database Schema

Users are stored in the `security.users` table:

```sql
CREATE TABLE security.users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name         TEXT,
  phone        TEXT,
  email        TEXT,
  role         TEXT CHECK (role IN (
    'Exec','Correspondence','Logistics','Procurement',
    'Inventory','Clearance','Accounting','Admin'
  )) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Screenshots

### User Management Dashboard
- Purple highlighted button in sidebar (Admin only)
- Table showing all users with their roles
- Create button in top right corner

### Create User Modal
- Clean form with all required fields
- Role dropdown with all available roles
- Real-time validation
- Success/error messages

---

## Support

For issues with user management:
1. Check this guide first
2. Review `SECURITY_LOCKDOWN_SUMMARY.md` for authentication details
3. Check backend logs for errors
4. Verify database connectivity

**Admin Contact**: System Administrator
**Technical Support**: Backend Team

