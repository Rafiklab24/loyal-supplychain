# Security Forensics & Monitoring Guide

## Overview

This guide explains how to monitor security events, detect threats, and investigate incidents using the security audit system.

---

## 📊 Monitoring Schedule

| Frequency | Task | Priority |
|-----------|------|----------|
| **Real-time** | Automated alerts for critical events | 🔴 Critical |
| **Daily** | Review failed login attempts | 🟠 High |
| **Weekly** | Analyze access patterns, suspicious activity | 🟡 Medium |
| **Monthly** | Full security audit, user access review | 🟢 Routine |
| **Quarterly** | Password rotation, permission audit | 🔵 Compliance |

---

## 🔍 Daily Forensics Queries

### 1. Failed Login Attempts (Last 24 Hours)

```sql
-- Who tried to login and failed?
SELECT 
    username,
    ip_address,
    details->>'reason' as failure_reason,
    COUNT(*) as attempts,
    MIN(created_at) as first_attempt,
    MAX(created_at) as last_attempt
FROM security.audit_security_log
WHERE event_type = 'login_failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY username, ip_address, details->>'reason'
ORDER BY attempts DESC;
```

### 2. Successful Logins (Verify Legitimate Access)

```sql
-- Who logged in successfully?
SELECT 
    username,
    ip_address,
    details->>'role' as role,
    created_at as login_time,
    user_agent
FROM security.audit_security_log
WHERE event_type = 'login_success'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### 3. Account Lockouts

```sql
-- Which accounts got locked?
SELECT 
    username,
    ip_address,
    details->>'failed_attempts' as failed_attempts,
    created_at as locked_at
FROM security.audit_security_log
WHERE event_type = 'login_failed'
  AND (details->>'account_locked')::boolean = true
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 🚨 Real-Time Alert Queries

### Suspicious Activity Dashboard

```sql
-- View auto-detected suspicious patterns (run this regularly)
SELECT * FROM security.suspicious_activity;
```

### Active Attack Detection

```sql
-- IPs with multiple failed logins in the last hour (possible brute force)
SELECT 
    ip_address,
    COUNT(*) as failed_attempts,
    COUNT(DISTINCT username) as unique_users_tried,
    ARRAY_AGG(DISTINCT username) as usernames_attempted
FROM security.audit_security_log
WHERE event_type = 'login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) >= 3
ORDER BY failed_attempts DESC;
```

### Token Theft Alerts

```sql
-- Sessions flagged for potential token theft
SELECT 
    username,
    user_id,
    ip_address,
    details->>'ips' as ip_addresses_used,
    details->>'ip_count' as ip_count,
    created_at
FROM security.audit_security_log
WHERE event_type = 'suspicious_activity'
  AND details->>'reason' = 'token_used_from_multiple_ips'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 📈 Weekly Analysis Queries

### Login Patterns by User

```sql
-- User activity summary for the week
SELECT 
    u.username,
    u.role,
    COUNT(*) FILTER (WHERE event_type = 'login_success') as successful_logins,
    COUNT(*) FILTER (WHERE event_type = 'login_failed') as failed_logins,
    COUNT(DISTINCT l.ip_address) as unique_ips,
    ARRAY_AGG(DISTINCT l.ip_address) as ip_addresses
FROM security.users u
LEFT JOIN security.audit_security_log l ON u.username = l.username
WHERE l.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.username, u.role
ORDER BY failed_logins DESC, successful_logins DESC;
```

### Geographic Analysis (IP Patterns)

```sql
-- Unique IPs accessing the system
SELECT 
    ip_address,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE event_type = 'login_success') as successful,
    COUNT(*) FILTER (WHERE event_type = 'login_failed') as failed,
    COUNT(DISTINCT username) as unique_users,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM security.audit_security_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY ip_address
ORDER BY failed DESC, total_events DESC;
```

### Unauthorized Access Attempts

```sql
-- Attempts to access restricted resources
SELECT 
    username,
    user_id,
    endpoint,
    method,
    ip_address,
    details,
    created_at
FROM security.audit_security_log
WHERE event_type = 'unauthorized_access'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## 🔐 Monthly Security Audit

### User Account Health Check

```sql
-- Users with concerning patterns
SELECT 
    u.id,
    u.username,
    u.role,
    u.is_locked,
    u.failed_login_attempts,
    u.last_login_at,
    u.created_at,
    COALESCE(stats.failed_logins_30d, 0) as failed_logins_last_30_days,
    COALESCE(stats.success_logins_30d, 0) as successful_logins_last_30_days
FROM security.users u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) FILTER (WHERE event_type = 'login_failed') as failed_logins_30d,
        COUNT(*) FILTER (WHERE event_type = 'login_success') as success_logins_30d
    FROM security.audit_security_log
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY user_id
) stats ON u.id = stats.user_id
ORDER BY stats.failed_logins_30d DESC NULLS LAST;
```

### Inactive User Accounts

```sql
-- Users who haven't logged in for 30+ days (potential orphan accounts)
SELECT 
    id,
    username,
    role,
    last_login_at,
    created_at,
    NOW() - last_login_at as days_since_login
FROM security.users
WHERE last_login_at < NOW() - INTERVAL '30 days'
   OR last_login_at IS NULL
ORDER BY last_login_at NULLS FIRST;
```

### Branch Access Review

```sql
-- Review who has access to which branches
SELECT 
    u.username,
    u.role,
    b.name as branch_name,
    ub.access_level,
    ub.created_at as access_granted_at
FROM security.users u
JOIN security.user_branches ub ON u.id = ub.user_id
JOIN master_data.branches b ON ub.branch_id = b.id
ORDER BY u.username, b.name;
```

---

## 🚨 Incident Response Procedures

### Step 1: Detect the Incident

Run the suspicious activity query:

```sql
SELECT * FROM security.suspicious_activity;
```

### Step 2: Investigate Specific IP

```sql
-- Full history of a suspicious IP
SELECT 
    event_type,
    username,
    endpoint,
    method,
    details,
    created_at
FROM security.audit_security_log
WHERE ip_address = '192.168.1.100'::inet  -- Replace with suspicious IP
ORDER BY created_at DESC
LIMIT 100;
```

### Step 3: Investigate Specific User

```sql
-- Full activity log for a user
SELECT 
    event_type,
    ip_address,
    endpoint,
    method,
    details,
    created_at
FROM security.audit_security_log
WHERE username = 'suspicious_user'  -- Replace with username
ORDER BY created_at DESC
LIMIT 100;
```

### Step 4: Lock Compromised Account

```sql
-- Immediately lock a compromised account
UPDATE security.users 
SET is_locked = true, 
    locked_until = NOW() + INTERVAL '24 hours'
WHERE username = 'compromised_user';
```

### Step 5: Invalidate All Sessions

To force a user to re-login (change their password hash timestamp):

```sql
-- Force password reset (user must set new password)
UPDATE security.users 
SET password_hash = NULL
WHERE username = 'compromised_user';
```

### Step 6: Block IP Address

Add to your firewall or update the application to block:

```sql
-- Create IP blocklist table if needed
CREATE TABLE IF NOT EXISTS security.blocked_ips (
    ip_address INET PRIMARY KEY,
    reason TEXT,
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    blocked_by TEXT
);

-- Block an IP
INSERT INTO security.blocked_ips (ip_address, reason, blocked_until, blocked_by)
VALUES ('192.168.1.100'::inet, 'Brute force attack', NOW() + INTERVAL '7 days', 'admin');
```

---

## 📊 Executive Security Dashboard Query

Run this for a quick security overview:

```sql
SELECT 
    '🔐 Security Dashboard' as report,
    NOW() as generated_at;

SELECT 
    'Last 24 Hours' as period,
    COUNT(*) FILTER (WHERE event_type = 'login_success') as "✅ Successful Logins",
    COUNT(*) FILTER (WHERE event_type = 'login_failed') as "❌ Failed Logins",
    COUNT(*) FILTER (WHERE event_type = 'suspicious_activity') as "⚠️ Suspicious Events",
    COUNT(*) FILTER (WHERE event_type = 'unauthorized_access') as "🚫 Unauthorized Attempts",
    COUNT(DISTINCT ip_address) as "🌐 Unique IPs",
    COUNT(DISTINCT username) as "👤 Unique Users"
FROM security.audit_security_log
WHERE created_at > NOW() - INTERVAL '24 hours';

SELECT 
    'Currently Locked Accounts' as status,
    COUNT(*) as count
FROM security.users
WHERE is_locked = true;

SELECT 
    'Suspicious IPs (Last Hour)' as alert,
    COUNT(*) as count
FROM security.suspicious_activity;
```

---

## 🔔 Setting Up Automated Alerts

### Option 1: Cron Job Alert Script

Create `/Users/rafik/loyal-supplychain/scripts/security-check.sh`:

```bash
#!/bin/bash
# Run daily via cron: 0 8 * * * /path/to/security-check.sh

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

ALERT_THRESHOLD=5
FAILED_LOGINS=$(psql -t -c "SELECT COUNT(*) FROM security.audit_security_log WHERE event_type='login_failed' AND created_at > NOW() - INTERVAL '24 hours';" loyal_supplychain)

if [ "$FAILED_LOGINS" -gt "$ALERT_THRESHOLD" ]; then
    echo "⚠️ SECURITY ALERT: $FAILED_LOGINS failed login attempts in last 24 hours"
    # Add email/slack notification here
fi
```

### Option 2: PostgreSQL Trigger Alert

```sql
-- Create a function to alert on suspicious patterns
CREATE OR REPLACE FUNCTION security.check_and_alert()
RETURNS TRIGGER AS $$
BEGIN
    -- Alert if same IP has 5+ failed logins in 15 minutes
    IF NEW.event_type = 'login_failed' THEN
        IF (
            SELECT COUNT(*) 
            FROM security.audit_security_log 
            WHERE ip_address = NEW.ip_address 
              AND event_type = 'login_failed'
              AND created_at > NOW() - INTERVAL '15 minutes'
        ) >= 5 THEN
            -- Log to a separate alerts table or send notification
            RAISE WARNING 'SECURITY ALERT: Possible brute force from IP %', NEW.ip_address;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to audit log
DROP TRIGGER IF EXISTS tr_security_alert ON security.audit_security_log;
CREATE TRIGGER tr_security_alert
    AFTER INSERT ON security.audit_security_log
    FOR EACH ROW
    EXECUTE FUNCTION security.check_and_alert();
```

---

## 📋 Quick Reference Commands

```bash
# Daily check (run every morning)
psql loyal_supplychain -c "SELECT * FROM security.suspicious_activity;"

# Quick failed login count
psql loyal_supplychain -c "SELECT COUNT(*) FROM security.audit_security_log WHERE event_type='login_failed' AND created_at > NOW() - INTERVAL '24 hours';"

# Check locked accounts
psql loyal_supplychain -c "SELECT username, role, locked_until FROM security.users WHERE is_locked = true;"

# Recent security events
psql loyal_supplychain -c "SELECT event_type, username, ip_address, created_at FROM security.audit_security_log ORDER BY created_at DESC LIMIT 20;"
```

---

## Summary

| When | What to Check | Action if Issues Found |
|------|---------------|------------------------|
| **Daily** | Failed logins > 10 | Investigate IPs, consider blocking |
| **Daily** | Locked accounts | Verify legitimate, unlock if needed |
| **Weekly** | Login patterns | Look for anomalies in times/locations |
| **Weekly** | Suspicious activity view | Investigate flagged IPs |
| **Monthly** | Inactive users | Disable or remove old accounts |
| **Monthly** | Branch access | Verify appropriate permissions |
| **Quarterly** | Full audit | Password resets, permission review |

**Remember:** Security monitoring is not a one-time task. Regular reviews catch issues before they become breaches!

