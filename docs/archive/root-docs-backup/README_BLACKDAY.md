# Emergency Maintenance System

## Overview

The application includes an emergency maintenance mode system for critical situations requiring immediate system shutdown and data preservation.

## Features

- Instant system lockdown capability
- Automatic database backup on activation
- Maintenance mode protection
- Administrative recovery procedures
- Complete audit logging

## Technical Implementation

### API Endpoints

- `POST /api/blackday/trigger` - Activate emergency maintenance mode
- `POST /api/blackday/recover` - Restore system from maintenance mode  
- `GET /api/blackday/status` - Check maintenance mode status

### Database Schema

- `system.maintenance_mode` - Maintenance status tracking
- `system.blackday_shutdowns` - Shutdown event records
- `system.security_events` - Security event audit log

### Middleware

- `checkBlackDayMode` - Blocks requests during maintenance
- `checkAccountLocked` - Prevents locked account access

## Configuration

Environment variables (`.env`):

```bash
BLACK_DAY_USERNAME=<admin_username>
BLACK_DAY_PASSWORD=<secure_password>
BLACKADMIN_USERNAME=<recovery_username>
BLACKADMIN_PASSWORD=<secure_password>
```

## Usage

**Note:** This is an emergency system. Use only in critical situations requiring immediate system shutdown.

### Activation

```bash
curl -X POST http://localhost:3000/api/blackday/trigger \
  -H "Content-Type: application/json" \
  -d '{"username":"<username>","password":"<password>"}'
```

### Recovery

```bash
curl -X POST http://localhost:3000/api/blackday/recover \
  -H "Content-Type: application/json" \
  -d '{"username":"<username>","password":"<password>","shutdown_id":"<id>"}'
```

## Security

- Credentials stored in environment variables
- All events logged with IP and timestamp
- Automatic backup creation before shutdown
- Separate credentials for trigger and recovery
- Failed access attempts logged

## Backups

Backups are stored in: `app/backups/blackday/`

Contains:
- Database dump (`blackday_backup_[timestamp].sql`)
- System snapshot (`snapshots/snapshot_[timestamp].json`)

## Maintenance

- Change credentials regularly
- Test in development environment
- Review security logs periodically
- Verify backup integrity

---

**For detailed documentation, see technical implementation files.**

