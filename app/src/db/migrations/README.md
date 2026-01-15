# Database Migrations

This directory contains SQL migration files for the database schema.

## Migration File Format

Migrations are SQL files named with the pattern: `YYYYMMDD_HHMMSS_description.sql`

Example: `20250107_120000_add_users_table.sql`

## Migration Structure

Each migration file should contain SQL statements that can be safely applied and rolled back.

### Example Migration

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS security.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_users_username ON security.users(username);
```

## Running Migrations

### Apply All Pending Migrations

```bash
cd app
npm run db:up
```

Or directly:

```bash
ts-node src/db/migrate.ts up
```

### Rollback Last Migration

```bash
ts-node src/db/migrate.ts down
```

### Rollback to Specific Migration

```bash
ts-node src/db/migrate.ts down <migration_filename>
```

## Migration Best Practices

1. **Always use transactions** - The migration system wraps each migration in a transaction
2. **Make migrations idempotent** - Use `IF NOT EXISTS` and `IF EXISTS` clauses
3. **Test migrations** - Test both up and down migrations
4. **Never modify applied migrations** - Create a new migration instead
5. **Use descriptive names** - Migration filenames should clearly describe the change
6. **Keep migrations small** - One logical change per migration
7. **Document complex migrations** - Add comments explaining the purpose

## Migration Tracking

Migrations are tracked in the `security.migrations` table:

```sql
SELECT * FROM security.migrations ORDER BY applied_at;
```

## Creating a New Migration

1. Create a new SQL file in this directory
2. Name it with timestamp and description: `YYYYMMDD_HHMMSS_description.sql`
3. Write your SQL statements
4. Test the migration locally
5. Commit the migration file to version control

## Rollback Considerations

While the migration system supports rollback, some migrations cannot be safely rolled back:

- Data migrations (data transformations)
- Dropping columns with data
- Changing column types that may cause data loss

For such migrations, document the rollback limitations in the migration file.

## Troubleshooting

### Migration Fails

If a migration fails:
1. Check the error message
2. Fix the SQL in the migration file
3. Manually rollback if needed: `ROLLBACK;`
4. Fix and re-run the migration

### Migration Already Applied

If you need to modify a migration that's already been applied:
1. Create a new migration to fix the issue
2. Never modify an already-applied migration file

### Database Out of Sync

If your database is out of sync:
1. Check applied migrations: `SELECT * FROM security.migrations;`
2. Compare with migration files in this directory
3. Apply missing migrations or create new ones as needed

