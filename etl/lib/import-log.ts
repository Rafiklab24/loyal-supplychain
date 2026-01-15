/**
 * Import logging helper for ETL scripts
 * Tracks ETL runs in security.import_log table
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { PoolClient } from 'pg';

/**
 * Compute SHA256 hash of file contents
 */
function computeFileSha256(filePath: string): string {
  try {
    const contents = readFileSync(filePath);
    return createHash('sha256').update(contents).digest('hex');
  } catch (error) {
    console.warn(`⚠️  Could not compute file hash: ${error instanceof Error ? error.message : error}`);
    return '';
  }
}

/**
 * Begin an import run - creates log entry and returns import ID
 */
export async function beginImport(
  client: PoolClient,
  filePath: string
): Promise<number> {
  const fileName = basename(filePath);
  const fileSha256 = computeFileSha256(filePath);
  
  const result = await client.query(
    `INSERT INTO security.import_log (file_name, file_sha256, started_at)
     VALUES ($1, $2, now())
     RETURNING id`,
    [fileName, fileSha256]
  );
  
  return result.rows[0].id;
}

/**
 * Finish an import run - updates log entry with results
 */
export async function finishImport(
  client: PoolClient,
  importId: number,
  stats: {
    rowCount: number;
    okCount: number;
    errCount: number;
    notes?: string;
  }
): Promise<void> {
  await client.query(
    `UPDATE security.import_log
     SET row_count = $1,
         ok_count = $2,
         err_count = $3,
         finished_at = now(),
         notes = $4
     WHERE id = $5`,
    [stats.rowCount, stats.okCount, stats.errCount, stats.notes || null, importId]
  );
}

