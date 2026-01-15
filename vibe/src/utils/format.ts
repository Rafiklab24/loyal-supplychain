import { format as formatDate } from 'date-fns';

// Standard date format constants
export const DATE_FORMAT = 'dd/MM/yyyy';
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

// Format number with comma separators
export const formatNumber = (num: string | number | null | undefined, decimals?: number): string => {
  if (num === null || num === undefined || num === '') return '0';
  const parsed = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(parsed)) return '0';
  if (decimals !== undefined) {
    return parsed.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return parsed.toLocaleString('en-US');
};

// Format currency (USD)
export const formatCurrency = (num: string | number | null | undefined): string => {
  if (num === null || num === undefined || num === '') return '$0';
  const parsed = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(parsed)) return '$0';
  return `$${parsed.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// Format weight with "ton" suffix
export const formatWeight = (num: string | number | null | undefined): string => {
  const formatted = formatNumber(num);
  return `${formatted} طن`;
};

// Format date with Western numerals (DD/MM/YYYY format)
export const formatDateString = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    // Always use Western numerals, regardless of language
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

// Format date with Western numerals using locale-aware formatting (DD/MM/YYYY)
export const formatDateLocale = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    // Use en-GB for DD/MM/YYYY format with Western numerals
    return date.toLocaleDateString('en-GB', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      calendar: 'gregory'
    });
  } catch {
    return '—';
  }
};

// Format date with time (always uses Western numerals)
export const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    // Always use standard format without locale-specific numerals
    return formatDate(date, 'dd/MM/yyyy HH:mm');
  } catch {
    return '—';
  }
};

// Convert status to Arabic
/**
 * Convert shipment status to Arabic
 * Status values are from the automatic status engine workflow
 */
export const statusToArabic = (status: string | null): string => {
  if (!status) return '—';
  const map: Record<string, string> = {
    // New status engine values
    'planning': 'تخطيط',
    'delayed': 'متأخر',
    'sailed': 'أبحرت / في الطريق',
    'awaiting_clearance': 'في انتظار التخليص',
    'pending_transport': 'في انتظار تعيين النقل',
    'loaded_to_final': 'في الطريق للوجهة النهائية',
    'received': 'تم الاستلام',
    'quality_issue': 'مشكلة جودة',
    // Legacy status mappings for backwards compatibility
    'booked': 'تخطيط',
    'gate_in': 'تخطيط',
    'loaded': 'أبحرت',
    'arrived': 'في انتظار التخليص',
    'delivered': 'تم الاستلام',
    'invoiced': 'تم الاستلام',
  };
  return map[status] || status;
};

/**
 * Get status badge color
 * Status values are from the automatic status engine workflow
 */
export const getStatusColor = (status: string | null): string => {
  if (!status) return 'gray';
  const map: Record<string, string> = {
    // New status engine values
    'planning': 'gray',
    'delayed': 'red',
    'sailed': 'blue',
    'awaiting_clearance': 'amber',
    'pending_transport': 'indigo',
    'loaded_to_final': 'purple',
    'received': 'green',
    'quality_issue': 'orange',
    // Legacy status mappings for backwards compatibility
    'booked': 'gray',
    'gate_in': 'gray',
    'loaded': 'blue',
    'arrived': 'amber',
    'delivered': 'green',
    'invoiced': 'green',
  };
  return map[status] || 'gray';
};

