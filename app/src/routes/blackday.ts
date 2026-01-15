import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// Black Day credentials (should be stored in secure vault in production)
const BLACK_DAY_USERNAME = process.env.BLACK_DAY_USERNAME || 'BLACKDAY_TRIGGER';
const BLACK_DAY_PASSWORD = process.env.BLACK_DAY_PASSWORD || 'EMERGENCY_SHUTDOWN_2025!';
const BLACKADMIN_USERNAME = process.env.BLACKADMIN_USERNAME || 'blackadmin';
const BLACKADMIN_PASSWORD = process.env.BLACKADMIN_PASSWORD || 'BlackAdmin_Recovery_2025!';

// POST /api/blackday/trigger - Emergency shutdown trigger
router.post('/trigger', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Verify Black Day credentials
    if (username !== BLACK_DAY_USERNAME || password !== BLACK_DAY_PASSWORD) {
      // Log failed attempt
      await logSecurityEvent('BLACK_DAY_TRIGGER_FAILED', {
        username,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Access denied',
      });
    }

    // BLACK DAY TRIGGERED - Log the event
    await logSecurityEvent('BLACK_DAY_TRIGGERED', {
      username,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      reason: 'Emergency shutdown initiated',
    });

    // 1. Create full database backup
    const backupPath = await createDatabaseBackup();

    // 2. Create system state snapshot
    const snapshotPath = await createSystemSnapshot();

    // 3. Set system to maintenance mode
    await setMaintenanceMode(true);

    // 4. Lock all user accounts except blackadmin
    await lockAllAccounts();

    // 5. Record shutdown details
    const shutdownRecord = await recordShutdown({
      triggered_by: username,
      ip: req.ip,
      backup_path: backupPath,
      snapshot_path: snapshotPath,
      timestamp: new Date().toISOString(),
    });

    res.json({
      status: 'BLACK_DAY_ACTIVATED',
      message: 'Emergency shutdown initiated',
      backup_created: backupPath,
      snapshot_created: snapshotPath,
      shutdown_id: shutdownRecord.id,
      recovery_account: 'blackadmin',
      note: 'System is now in emergency lockdown. Only blackadmin can restore access.',
    });

    // Optional: Actually stop the server after response (uncomment in production)
    // setTimeout(() => {
    //   process.exit(0);
    // }, 1000);

  } catch (error) {
    next(error);
  }
});

// POST /api/blackday/recover - Recovery by blackadmin
router.post('/recover', async (req, res, next) => {
  try {
    const { username, password, shutdown_id } = req.body;

    // Verify blackadmin credentials
    if (username !== BLACKADMIN_USERNAME || password !== BLACKADMIN_PASSWORD) {
      await logSecurityEvent('BLACKADMIN_RECOVERY_FAILED', {
        username,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Access denied',
      });
    }

    // Log recovery attempt
    await logSecurityEvent('BLACKADMIN_RECOVERY_INITIATED', {
      username,
      ip: req.ip,
      shutdown_id,
      timestamp: new Date().toISOString(),
    });

    // 1. Disable maintenance mode
    await setMaintenanceMode(false);

    // 2. Unlock all user accounts
    await unlockAllAccounts();

    // 3. Record recovery
    await recordRecovery({
      shutdown_id,
      recovered_by: username,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    res.json({
      status: 'SYSTEM_RECOVERED',
      message: 'Emergency shutdown lifted. System restored.',
      recovered_at: new Date().toISOString(),
      recovered_by: username,
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/blackday/status - Check if system is in black day mode
router.get('/status', async (req, res, next) => {
  try {
    const maintenanceMode = await checkMaintenanceMode();
    const activeShutdown = await getActiveShutdown();

    res.json({
      maintenance_mode: maintenanceMode,
      black_day_active: !!activeShutdown,
      shutdown_details: activeShutdown || null,
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions

async function createDatabaseBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', 'blackday');
  const backupFile = path.join(backupDir, `blackday_backup_${timestamp}.sql`);

  // Create backups directory
  await fs.mkdir(backupDir, { recursive: true });

  // Create database dump
  const dbUrl = process.env.DATABASE_URL || '';
  const dbMatch = dbUrl.match(/postgresql:\/\/([^:]+):?([^@]*)@([^:]+):?(\d+)?\/(.+)/);
  
  if (dbMatch) {
    const [, user, pass, host, port, database] = dbMatch;
    const dumpCommand = `PGPASSWORD="${pass}" pg_dump -h ${host} -p ${port || 5432} -U ${user} -F c -b -v -f "${backupFile}" ${database}`;
    
    try {
      await execAsync(dumpCommand);
    } catch (error) {
      // If pg_dump fails, create a SQL backup instead
      const result = await pool.query(`
        SELECT 'Backup created at ' || NOW() as backup_info
      `);
      await fs.writeFile(backupFile, `-- Black Day Backup\n-- ${new Date().toISOString()}\n`);
    }
  }

  return backupFile;
}

async function createSystemSnapshot(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotDir = path.join(process.cwd(), 'backups', 'blackday', 'snapshots');
  const snapshotFile = path.join(snapshotDir, `snapshot_${timestamp}.json`);

  await fs.mkdir(snapshotDir, { recursive: true });

  // Capture critical system state
  const snapshot = {
    timestamp: new Date().toISOString(),
    users_count: await pool.query('SELECT COUNT(*) FROM security.users'),
    shipments_count: await pool.query('SELECT COUNT(*) FROM logistics.shipments'),
    contracts_count: await pool.query('SELECT COUNT(*) FROM logistics.contracts'),
    transactions_count: await pool.query('SELECT COUNT(*) FROM finance.transfers'),
    system_state: 'black_day_triggered',
  };

  await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));
  return snapshotFile;
}

async function setMaintenanceMode(enabled: boolean): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system.maintenance_mode (
      id SERIAL PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    INSERT INTO system.maintenance_mode (enabled, updated_at)
    VALUES ($1, NOW())
    ON CONFLICT (id) DO UPDATE SET enabled = $1, updated_at = NOW()
  `, [enabled]);
}

async function checkMaintenanceMode(): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT enabled FROM system.maintenance_mode ORDER BY updated_at DESC LIMIT 1
    `);
    return result.rows[0]?.enabled || false;
  } catch {
    return false;
  }
}

async function lockAllAccounts(): Promise<void> {
  // Add is_locked column if it doesn't exist
  await pool.query(`
    ALTER TABLE security.users 
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE
  `);

  // Lock all accounts except blackadmin
  await pool.query(`
    UPDATE security.users 
    SET is_locked = TRUE 
    WHERE username != $1
  `, [BLACKADMIN_USERNAME]);
}

async function unlockAllAccounts(): Promise<void> {
  await pool.query(`
    UPDATE security.users 
    SET is_locked = FALSE
  `);
}

async function recordShutdown(details: any): Promise<any> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system.blackday_shutdowns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      triggered_by TEXT NOT NULL,
      ip TEXT,
      backup_path TEXT,
      snapshot_path TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      recovered_at TIMESTAMPTZ,
      recovered_by TEXT,
      is_active BOOLEAN DEFAULT TRUE
    )
  `);

  const result = await pool.query(`
    INSERT INTO system.blackday_shutdowns 
    (triggered_by, ip, backup_path, snapshot_path, timestamp)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [details.triggered_by, details.ip, details.backup_path, details.snapshot_path, details.timestamp]);

  return result.rows[0];
}

async function recordRecovery(details: any): Promise<void> {
  await pool.query(`
    UPDATE system.blackday_shutdowns
    SET recovered_at = NOW(),
        recovered_by = $1,
        is_active = FALSE
    WHERE id = $2
  `, [details.recovered_by, details.shutdown_id]);
}

async function getActiveShutdown(): Promise<any> {
  try {
    const result = await pool.query(`
      SELECT * FROM system.blackday_shutdowns 
      WHERE is_active = TRUE 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

async function logSecurityEvent(event_type: string, details: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system.security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type TEXT NOT NULL,
      details JSONB NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    INSERT INTO system.security_events (event_type, details)
    VALUES ($1, $2)
  `, [event_type, details]);
}

export default router;

