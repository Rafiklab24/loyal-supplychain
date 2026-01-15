#!/bin/bash
# ===========================================
# Log Rotation Script for Loyal Supply Chain
# Rotates logs weekly, keeps 4 weeks of history
# Run: ./scripts/rotate-logs.sh
# ===========================================

LOG_DIR="/Users/rafik/loyal-supplychain/logs"
KEEP_WEEKS=4  # Number of weeks to keep

echo "🔄 Log Rotation - $(date '+%Y-%m-%d %H:%M:%S')"
echo "─────────────────────────────────────────"

# Function to rotate a log file
rotate_log() {
    local log_file="$1"
    local base_name=$(basename "$log_file" .log)
    local timestamp=$(date '+%Y%m%d')
    
    if [ -f "$log_file" ]; then
        # Get file size
        local size=$(du -h "$log_file" | cut -f1)
        
        # Create rotated filename
        local rotated_file="${LOG_DIR}/${base_name}-${timestamp}.log"
        
        # Move current log to dated version
        mv "$log_file" "$rotated_file"
        
        # Compress the rotated file
        gzip -f "$rotated_file"
        
        # Create new empty log file
        touch "$log_file"
        
        echo "✅ Rotated: $log_file ($size) → ${rotated_file}.gz"
    fi
}

# Function to cleanup old logs
cleanup_old_logs() {
    local pattern="$1"
    local keep_days=$((KEEP_WEEKS * 7))
    
    # Find and delete logs older than KEEP_WEEKS
    local deleted=$(find "$LOG_DIR" -name "$pattern" -type f -mtime +$keep_days -delete -print | wc -l | tr -d ' ')
    
    if [ "$deleted" -gt 0 ]; then
        echo "🗑️  Deleted $deleted old log files (>$keep_days days)"
    fi
}

# Rotate main log files
rotate_log "${LOG_DIR}/security-daily.log"
rotate_log "${LOG_DIR}/combined.log"
rotate_log "${LOG_DIR}/error.log"

# Cleanup old compressed logs
cleanup_old_logs "*.log.gz"

echo ""
echo "📁 Current logs directory:"
ls -lh "$LOG_DIR" 2>/dev/null || echo "No logs found"

echo ""
echo "✅ Log rotation complete"

