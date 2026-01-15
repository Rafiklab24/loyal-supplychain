#!/bin/bash
# ===========================================
# Daily Security Check Script
# Run: ./scripts/security-daily-check.sh
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PostgreSQL path
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
DB_NAME="loyal_supplychain"

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🔐 DAILY SECURITY CHECK - $(date '+%Y-%m-%d %H:%M')        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Summary Stats
echo -e "${YELLOW}📊 Last 24 Hours Summary${NC}"
echo "─────────────────────────────────────────"
psql -t $DB_NAME << 'EOF'
SELECT 
    'Successful Logins:  ' || COUNT(*) FILTER (WHERE event_type = 'login_success'),
    'Failed Logins:      ' || COUNT(*) FILTER (WHERE event_type = 'login_failed'),
    'Suspicious Events:  ' || COUNT(*) FILTER (WHERE event_type = 'suspicious_activity'),
    'Unique IPs:         ' || COUNT(DISTINCT ip_address)
FROM security.audit_security_log
WHERE created_at > NOW() - INTERVAL '24 hours';
EOF
echo ""

# 2. Failed Logins
FAILED_COUNT=$(psql -t -c "SELECT COUNT(*) FROM security.audit_security_log WHERE event_type='login_failed' AND created_at > NOW() - INTERVAL '24 hours';" $DB_NAME | tr -d ' ')

if [ "$FAILED_COUNT" -gt 10 ]; then
    echo -e "${RED}🚨 ALERT: $FAILED_COUNT failed login attempts in last 24 hours!${NC}"
elif [ "$FAILED_COUNT" -gt 5 ]; then
    echo -e "${YELLOW}⚠️  WARNING: $FAILED_COUNT failed login attempts in last 24 hours${NC}"
else
    echo -e "${GREEN}✅ Failed logins normal: $FAILED_COUNT attempts${NC}"
fi
echo ""

# 3. Locked Accounts
echo -e "${YELLOW}🔒 Locked Accounts${NC}"
echo "─────────────────────────────────────────"
LOCKED=$(psql -t $DB_NAME << 'EOF'
SELECT username || ' (locked until: ' || COALESCE(to_char(locked_until, 'YYYY-MM-DD HH24:MI'), 'indefinitely') || ')'
FROM security.users
WHERE is_locked = true;
EOF
)

if [ -z "$(echo $LOCKED | tr -d ' ')" ]; then
    echo -e "${GREEN}No locked accounts${NC}"
else
    echo -e "${RED}$LOCKED${NC}"
fi
echo ""

# 4. Suspicious IPs
echo -e "${YELLOW}⚠️  Suspicious Activity${NC}"
echo "─────────────────────────────────────────"
SUSPICIOUS=$(psql -t $DB_NAME << 'EOF'
SELECT ip_address || ' - ' || failed_logins || ' failed, ' || unique_usernames_tried || ' users tried'
FROM security.suspicious_activity;
EOF
)

if [ -z "$(echo $SUSPICIOUS | tr -d ' ')" ]; then
    echo -e "${GREEN}No suspicious activity detected${NC}"
else
    echo -e "${RED}$SUSPICIOUS${NC}"
fi
echo ""

# 5. Recent Failed Login Attempts (by username)
echo -e "${YELLOW}👤 Failed Login Attempts by Username${NC}"
echo "─────────────────────────────────────────"
psql -t $DB_NAME << 'EOF'
SELECT username || ': ' || COUNT(*) || ' attempts'
FROM security.audit_security_log
WHERE event_type = 'login_failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY username
ORDER BY COUNT(*) DESC
LIMIT 5;
EOF
echo ""

# 6. Recent Failed Login Attempts (by IP)
echo -e "${YELLOW}🌐 Failed Login Attempts by IP${NC}"
echo "─────────────────────────────────────────"
psql -t $DB_NAME << 'EOF'
SELECT ip_address || ': ' || COUNT(*) || ' attempts'
FROM security.audit_security_log
WHERE event_type = 'login_failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
ORDER BY COUNT(*) DESC
LIMIT 5;
EOF
echo ""

# 7. Inactive Users (no login in 30 days)
echo -e "${YELLOW}😴 Inactive Users (30+ days)${NC}"
echo "─────────────────────────────────────────"
INACTIVE=$(psql -t $DB_NAME << 'EOF'
SELECT username || ' - last login: ' || COALESCE(to_char(last_login_at, 'YYYY-MM-DD'), 'never')
FROM security.users
WHERE last_login_at < NOW() - INTERVAL '30 days'
   OR last_login_at IS NULL;
EOF
)

if [ -z "$(echo $INACTIVE | tr -d ' ')" ]; then
    echo -e "${GREEN}All users have logged in within 30 days${NC}"
else
    echo -e "${YELLOW}$INACTIVE${NC}"
fi
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Security check complete${NC}"
echo ""
echo "For detailed forensics, see: SECURITY_FORENSICS_GUIDE.md"
echo ""

