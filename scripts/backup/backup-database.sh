#!/bin/bash
# Database Backup Script
# Creates a compressed backup of the PostgreSQL database

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./scripts/backup/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."
echo "Backup directory: $BACKUP_DIR"
echo "Timestamp: $TIMESTAMP"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Create backup
echo "Creating backup..."
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# Check if backup was created successfully
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file was not created!"
  exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Verify compressed backup
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Compressed backup file was not created!"
  exit 1
fi

# Get compressed size
COMPRESSED_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup compressed: $BACKUP_FILE ($COMPRESSED_SIZE)"

# Verify backup integrity (basic check)
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  echo "✓ Backup verified: $BACKUP_FILE"
else
  echo "ERROR: Backup file is empty or missing!"
  exit 1
fi

# Optional: Upload to S3 or other storage
# Uncomment and configure if needed
# if [ -n "$AWS_S3_BUCKET" ]; then
#   echo "Uploading to S3..."
#   aws s3 cp "$BACKUP_FILE" "s3://$AWS_S3_BUCKET/backups/$BACKUP_FILE"
#   echo "✓ Uploaded to S3"
# fi

# Clean up old backups (keep last N days)
echo "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "✓ Cleanup completed"

echo ""
echo "✓ Backup completed successfully!"
echo "  File: $BACKUP_FILE"
echo "  Size: $COMPRESSED_SIZE"
echo "  Timestamp: $TIMESTAMP"

