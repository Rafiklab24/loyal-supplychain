/**
 * Demurrage Utilities - Frontend
 * Helper functions for calculating and displaying demurrage risk status
 */

export interface DemurrageStatus {
  status: 'safe' | 'warning' | 'exceeded' | 'unknown';
  daysRemaining: number | null;
  daysOverdue: number | null;
  deadlineDate: string | null;
  message: string;
}

/**
 * Calculate demurrage status for a shipment
 */
export function calculateDemurrageStatus(
  eta: string | null,
  freeTimeDays: number | string | null,
  customsClearanceDate: string | null
): DemurrageStatus {
  // Convert freeTimeDays to number if it's a string
  const freeTimeDaysNum = typeof freeTimeDays === 'string' 
    ? parseInt(freeTimeDays, 10) 
    : freeTimeDays;

  // If we don't have required data, return unknown status
  if (!eta || !freeTimeDaysNum || isNaN(freeTimeDaysNum)) {
    return {
      status: 'unknown',
      daysRemaining: null,
      daysOverdue: null,
      deadlineDate: null,
      message: 'Missing ETA or free time',
    };
  }

  // Calculate deadline date (ETA + free_time_days)
  const etaDate = new Date(eta);
  const deadlineDate = new Date(etaDate);
  deadlineDate.setDate(deadlineDate.getDate() + freeTimeDaysNum);
  
  const deadlineDateStr = deadlineDate.toISOString().split('T')[0];
  
  // Determine comparison date
  const comparisonDate = customsClearanceDate 
    ? new Date(customsClearanceDate)
    : new Date();
  
  // Reset time to midnight for accurate day calculation
  comparisonDate.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  
  // Calculate days difference
  const diffMs = deadlineDate.getTime() - comparisonDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Determine status based on days remaining
  if (diffDays < 0) {
    return {
      status: 'exceeded',
      daysRemaining: null,
      daysOverdue: Math.abs(diffDays),
      deadlineDate: deadlineDateStr,
      message: `${Math.abs(diffDays)} day(s) overdue`,
    };
  } else if (diffDays <= 2) {
    return {
      status: 'warning',
      daysRemaining: diffDays,
      daysOverdue: null,
      deadlineDate: deadlineDateStr,
      message: `${diffDays} day(s) left`,
    };
  } else {
    return {
      status: 'safe',
      daysRemaining: diffDays,
      daysOverdue: null,
      deadlineDate: deadlineDateStr,
      message: `${diffDays} day(s) remaining`,
    };
  }
}

/**
 * Get color class for demurrage status badge
 */
export function getDemurrageColorClass(status: 'safe' | 'warning' | 'exceeded' | 'unknown'): string {
  const colorMap = {
    safe: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    exceeded: 'bg-red-100 text-red-800 border-red-200',
    unknown: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  
  return colorMap[status];
}

/**
 * Get icon for demurrage status
 */
export function getDemurrageIcon(status: 'safe' | 'warning' | 'exceeded' | 'unknown'): string {
  const iconMap = {
    safe: '✓',
    warning: '⚠️',
    exceeded: '⛔',
    unknown: '•',
  };
  
  return iconMap[status];
}

/**
 * Format date for display (YYYY-MM-DD to readable format)
 */
export function formatDisplayDate(dateStr: string | null, locale: 'en' | 'ar' = 'en'): string {
  if (!dateStr) return '—';
  
  try {
    const date = new Date(dateStr);
    if (locale === 'ar') {
      return date.toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}

