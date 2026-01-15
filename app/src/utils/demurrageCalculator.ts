/**
 * Demurrage Calculator Utility
 * Calculates demurrage risk status based on customs clearance dates and free time
 */

export interface DemurrageStatus {
  status: 'safe' | 'warning' | 'exceeded' | 'unknown';
  daysRemaining: number | null;
  daysOverdue: number | null;
  deadlineDate: string | null; // ETA + free_time_days
  message: string;
}

/**
 * Calculate demurrage status for a shipment
 * 
 * @param eta - Estimated Time of Arrival (ISO date string)
 * @param freeTimeDays - Number of free storage days at port
 * @param customsClearanceDate - Date when customs cleared goods (ISO date string)
 * @param arrivalStatus - Whether shipment has arrived (status is 'arrived' or later)
 * @returns DemurrageStatus object with risk assessment
 */
export function calculateDemurrageStatus(
  eta: string | null,
  freeTimeDays: number | null,
  customsClearanceDate: string | null,
  arrivalStatus: boolean = false
): DemurrageStatus {
  // If we don't have required data, return unknown status
  if (!eta || freeTimeDays === null || freeTimeDays === undefined) {
    return {
      status: 'unknown',
      daysRemaining: null,
      daysOverdue: null,
      deadlineDate: null,
      message: 'Missing ETA or free time information',
    };
  }

  // Calculate deadline date (ETA + free_time_days)
  const etaDate = new Date(eta);
  const deadlineDate = new Date(etaDate);
  deadlineDate.setDate(deadlineDate.getDate() + freeTimeDays);
  
  const deadlineDateStr = deadlineDate.toISOString().split('T')[0];
  
  // Determine comparison date
  // If clearance date is provided, use it; otherwise use today (for pre-clearance warnings)
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
    // Exceeded deadline
    return {
      status: 'exceeded',
      daysRemaining: null,
      daysOverdue: Math.abs(diffDays),
      deadlineDate: deadlineDateStr,
      message: `Demurrage: ${Math.abs(diffDays)} day(s) overdue`,
    };
  } else if (diffDays <= 2) {
    // Warning: within 2 days of deadline
    return {
      status: 'warning',
      daysRemaining: diffDays,
      daysOverdue: null,
      deadlineDate: deadlineDateStr,
      message: `Warning: ${diffDays} day(s) until demurrage`,
    };
  } else {
    // Safe: more than 2 days remaining
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
 * Check if a shipment needs clearance date entry
 * (for notifications when arrived but no clearance date entered)
 * 
 * @param status - Current shipment status
 * @param customsClearanceDate - Date when customs cleared goods
 * @param eta - Estimated Time of Arrival
 * @param daysAfterArrival - How many days after ETA to trigger alert (default: 3)
 * @returns boolean indicating if clearance date entry is overdue
 */
export function isClearanceEntryOverdue(
  status: string | null,
  customsClearanceDate: string | null,
  eta: string | null,
  daysAfterArrival: number = 3
): boolean {
  // If clearance date is already entered, not overdue
  if (customsClearanceDate) {
    return false;
  }
  
  // Only check for arrived or later statuses
  const arrivedStatuses = ['arrived', 'delivered', 'invoiced'];
  if (!status || !arrivedStatuses.includes(status)) {
    return false;
  }
  
  // If no ETA, can't determine
  if (!eta) {
    return false;
  }
  
  const etaDate = new Date(eta);
  const alertDate = new Date(etaDate);
  alertDate.setDate(alertDate.getDate() + daysAfterArrival);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  alertDate.setHours(0, 0, 0, 0);
  
  // If today is past the alert date, entry is overdue
  return today >= alertDate;
}

/**
 * Get demurrage risk level for batch processing/filtering
 * 
 * @param demurrageStatus - DemurrageStatus object
 * @returns number (0=unknown, 1=safe, 2=warning, 3=exceeded)
 */
export function getDemurrageRiskLevel(demurrageStatus: DemurrageStatus): number {
  const riskMap = {
    unknown: 0,
    safe: 1,
    warning: 2,
    exceeded: 3,
  };
  
  return riskMap[demurrageStatus.status];
}

/**
 * Format demurrage message for display (with localization support)
 * 
 * @param demurrageStatus - DemurrageStatus object
 * @param locale - 'en' or 'ar'
 * @returns Formatted message string
 */
export function formatDemurrageMessage(
  demurrageStatus: DemurrageStatus,
  locale: 'en' | 'ar' = 'en'
): string {
  const { status, daysRemaining, daysOverdue } = demurrageStatus;
  
  if (locale === 'ar') {
    switch (status) {
      case 'safe':
        return `${daysRemaining} يوم متبقي`;
      case 'warning':
        return `تحذير: ${daysRemaining} يوم حتى التأخير`;
      case 'exceeded':
        return `تأخير: ${daysOverdue} يوم تجاوز`;
      case 'unknown':
        return 'معلومات ناقصة';
      default:
        return '';
    }
  }
  
  // English (default)
  switch (status) {
    case 'safe':
      return `${daysRemaining} day(s) remaining`;
    case 'warning':
      return `Warning: ${daysRemaining} day(s) left`;
    case 'exceeded':
      return `Exceeded: ${daysOverdue} day(s) overdue`;
    case 'unknown':
      return 'Incomplete information';
    default:
      return '';
  }
}

