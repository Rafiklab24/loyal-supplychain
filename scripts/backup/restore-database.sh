#!/bin/bash
# Database Restore Script
# Restores a PostgreSQL database from a backup file

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if backup file is provided
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  echo ""
  echo "Example:"
  echo "  $0 ./scripts/backup/backups/backup_20250107_120000.sql.gz"
  echo ""
  echo "Available backups:"
  ls -lh ./scripts/backup/backups/backup_*.sql.gz 2>/dev/null | tail -5 || echo "  No backups found"
  exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Confirm restore
echo "WARNING: This will restore the database from backup!"
echo "  Backup file: $BACKUP_FILE"
echo "  Database: $DATABASE_URL"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo ""
echo "Restoring database from backup: $BACKUP_FILE"

# Check if backup is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "Decompressing and restoring..."
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
else
  echo "Restoring..."
  psql "$DATABASE_URL" < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Database restore completed successfully!"
else
  echo ""
  echo "ERROR: Database restore failed!"
  exit 1
fi

