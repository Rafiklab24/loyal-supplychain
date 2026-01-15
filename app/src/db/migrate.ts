import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Load environment variables before importing pool
config();

import { pool } from './client';
import logger from '../utils/logger';

// Always use src/db/migrations directory (SQL files don't get compiled to dist)
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'src', 'db', 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS security;
    CREATE TABLE IF NOT EXISTS security.migrations (
      id           SERIAL PRIMARY KEY,
      filename     TEXT UNIQUE NOT NULL,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM security.migrations ORDER BY applied_at'
  );
  return new Set(result.rows.map(r => r.filename));
}

async function applyMigration(filename: string): Promise<void> {
  const filePath = join(MIGRATIONS_DIR, filename);
  const sql = readFileSync(filePath, 'utf-8');

  logger.info(`Applying migration: ${filename}`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO security.migrations (filename) VALUES ($1)',
      [filename]
    );
    await client.query('COMMIT');
    logger.info(`✓ Applied: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`✗ Failed to apply ${filename}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function migrateUp(): Promise<void> {
  logger.info('Starting migrations...\n');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pendingMigrations = migrationFiles.filter(f => !applied.has(f));

  if (pendingMigrations.length === 0) {
    logger.info('✓ No pending migrations. Database is up to date.');
    return;
  }

  logger.info(`Found ${pendingMigrations.length} pending migration(s):\n`);
  
  for (const file of pendingMigrations) {
    await applyMigration(file);
  }

  logger.info(`\n✓ All migrations applied successfully!`);
}

async function migrateDown(filename?: string): Promise<void> {
  logger.info('Rolling back migrations...\n');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  if (applied.size === 0) {
    logger.info('✓ No migrations to rollback.');
    return;
  }

  let migrationsToRollback: string[];

  if (filename) {
    // Rollback to specific migration
    const appliedArray = Array.from(applied);
    const index = appliedArray.indexOf(filename);
    if (index === -1) {
      logger.error(`✗ Migration ${filename} not found in applied migrations.`);
      process.exit(1);
    }
    migrationsToRollback = appliedArray.slice(index);
  } else {
    // Rollback last migration only
    const appliedArray = Array.from(applied);
    migrationsToRollback = [appliedArray[appliedArray.length - 1]];
  }

  logger.info(`Rolling back ${migrationsToRollback.length} migration(s):\n`);

  // Note: Rollback requires migration files to have DOWN section
  // For now, we'll just remove the migration record
  // In a full implementation, you'd parse the DOWN section from the SQL file
  for (const file of migrationsToRollback.reverse()) {
    const filePath = join(MIGRATIONS_DIR, file);
    try {
      const sql = readFileSync(filePath, 'utf-8');
      
      // Check if migration has DOWN section
      if (sql.includes('-- DOWN') || sql.includes('--DOWN')) {
        const downSection = sql.split(/--\s*DOWN/i)[1]?.trim();
        if (downSection) {
          logger.info(`Rolling back: ${file}`);
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(downSection);
            await client.query(
              'DELETE FROM security.migrations WHERE filename = $1',
              [file]
            );
            await client.query('COMMIT');
            logger.info(`✓ Rolled back: ${file}`);
          } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`✗ Failed to rollback ${file}:`, error);
            throw error;
          } finally {
            client.release();
          }
        } else {
          console.warn(`⚠ Migration ${file} has no DOWN section. Removing record only.`);
          await pool.query(
            'DELETE FROM security.migrations WHERE filename = $1',
            [file]
          );
        }
      } else {
        console.warn(`⚠ Migration ${file} has no DOWN section. Removing record only.`);
        await pool.query(
          'DELETE FROM security.migrations WHERE filename = $1',
          [file]
        );
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`⚠ Migration file ${file} not found. Removing record only.`);
        await pool.query(
          'DELETE FROM security.migrations WHERE filename = $1',
          [file]
        );
      } else {
        throw error;
      }
    }
  }

  logger.info(`\n✓ Rollback completed!`);
}

async function main() {
  const command = process.argv[2];
  const argument = process.argv[3];

  try {
    if (command === 'up') {
      await migrateUp();
    } else if (command === 'down') {
      await migrateDown(argument);
    } else {
      logger.error('Usage:');
      logger.error('  ts-node migrate.ts up              - Apply all pending migrations');
      logger.error('  ts-node migrate.ts down            - Rollback last migration');
      logger.error('  ts-node migrate.ts down <filename> - Rollback to specific migration');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

