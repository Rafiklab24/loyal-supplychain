# Database Backup Strategy

This directory contains scripts for backing up and restoring the PostgreSQL database.

## Files

- `backup-database.sh` - Creates a compressed backup of the database
- `restore-database.sh` - Restores the database from a backup file
- `README.md` - This file

## Backup Script

### Usage

```bash
./scripts/backup/backup-database.sh
```

### Configuration

The script uses the following environment variables:

- `DATABASE_URL` - PostgreSQL connection string (required)
- `BACKUP_DIR` - Directory to store backups (default: `./scripts/backup/backups`)
- `RETENTION_DAYS` - Number of days to keep backups (default: 30)

### Features

- Creates compressed SQL backups
- Verifies backup integrity
- Automatically cleans up old backups
- Optional S3 upload support (configure `AWS_S3_BUCKET`)

### Automated Backups

To set up automated daily backups, add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line to run backup daily at 2 AM
0 2 * * * cd /path/to/loyal-supplychain && ./scripts/backup/backup-database.sh >> /var/log/db-backup.log 2>&1
```

Or use systemd timer (recommended for production):

Create `/etc/systemd/system/db-backup.service`:
```ini
[Unit]
Description=Database Backup
After=network.target

[Service]
Type=oneshot
User=postgres
WorkingDirectory=/path/to/loyal-supplychain
Environment="DATABASE_URL=postgresql://..."
ExecStart=/path/to/loyal-supplychain/scripts/backup/backup-database.sh
```

Create `/etc/systemd/system/db-backup.timer`:
```ini
[Unit]
Description=Daily Database Backup Timer

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl enable db-backup.timer
sudo systemctl start db-backup.timer
```

## Restore Script

### Usage

```bash
./scripts/backup/restore-database.sh <backup_file>
```

### Example

```bash
./scripts/backup/restore-database.sh ./scripts/backup/backups/backup_20250107_120000.sql.gz
```

### Warning

⚠️ **This will overwrite the current database!** Make sure to:
1. Create a backup of the current database before restoring
2. Verify the backup file is correct
3. Test restore in a development environment first

## Backup Storage

### Local Storage

Backups are stored in `./scripts/backup/backups/` by default.

### Cloud Storage (Recommended for Production)

For production environments, configure S3 upload:

1. Install AWS CLI: `pip install awscli`
2. Configure credentials: `aws configure`
3. Set environment variable: `export AWS_S3_BUCKET=your-backup-bucket`
4. Uncomment S3 upload section in `backup-database.sh`

### Backup Retention

- Default: 30 days
- Configure via `RETENTION_DAYS` environment variable
- Old backups are automatically deleted

## Best Practices

1. **Test backups regularly** - Verify backups can be restored
2. **Store backups off-site** - Use cloud storage for production
3. **Encrypt backups** - Use encryption for sensitive data
4. **Monitor backup size** - Ensure sufficient disk space
5. **Document restore procedures** - Keep this README updated
6. **Automate backups** - Use cron or systemd timers
7. **Verify backups** - Check backup integrity after creation

## Troubleshooting

### Backup fails with "DATABASE_URL not set"

Ensure `.env` file exists and contains `DATABASE_URL`, or export it:
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### Backup file is empty

Check database connection and permissions:
```bash
psql "$DATABASE_URL" -c "SELECT 1"
```

### Restore fails

1. Verify backup file is not corrupted
2. Check database connection
3. Ensure sufficient disk space
4. Check PostgreSQL logs for errors

## Security

- Never commit backup files to git
- Store backups in secure location
- Use encryption for sensitive backups
- Limit access to backup files
- Rotate backup credentials regularly

