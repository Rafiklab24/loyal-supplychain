/**
 * DemurrageStatusBadge Component
 * Displays demurrage risk status with color-coded badge
 */

import { useTranslation } from 'react-i18next';
import { calculateDemurrageStatus, getDemurrageColorClass, getDemurrageIcon } from '../../utils/demurrageUtils';

interface DemurrageStatusBadgeProps {
  eta: string | null;
  freeTimeDays: number | string | null;
  customsClearanceDate: string | null;
  status: string | null; // Shipment status
  showDetails?: boolean; // Show detailed message
  size?: 'sm' | 'md' | 'lg';
}

export function DemurrageStatusBadge({
  eta,
  freeTimeDays,
  customsClearanceDate,
  status,
  showDetails = false,
  size = 'md',
}: DemurrageStatusBadgeProps) {
  const { t } = useTranslation();

  // Calculate demurrage status
  const demurrageStatus = calculateDemurrageStatus(eta, freeTimeDays, customsClearanceDate);

  // Don't show badge if status is unknown or shipment hasn't arrived yet
  const arrivedStatuses = ['arrived', 'delivered', 'invoiced'];
  if (demurrageStatus.status === 'unknown' || (status && !arrivedStatuses.includes(status))) {
    return null;
  }

  const colorClass = getDemurrageColorClass(demurrageStatus.status);
  const icon = getDemurrageIcon(demurrageStatus.status);

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          inline-flex items-center gap-1 rounded-full border font-medium
          ${colorClass}
          ${sizeClasses[size]}
        `}
      >
        <span>{icon}</span>
        <span>
          {demurrageStatus.status === 'safe' && t('shipments.demurrageSafe', 'Safe')}
          {demurrageStatus.status === 'warning' && t('shipments.demurrageWarning', 'Warning')}
          {demurrageStatus.status === 'exceeded' && t('shipments.demurrageExceeded', 'Exceeded')}
        </span>
      </span>

      {showDetails && (
        <span className="text-sm text-gray-600">
          {demurrageStatus.message}
        </span>
      )}
    </div>
  );
}

/**
 * Compact inline badge (for table cells)
 */
export function DemurrageInlineBadge({
  eta,
  freeTimeDays,
  customsClearanceDate,
}: DemurrageStatusBadgeProps) {
  const demurrageStatus = calculateDemurrageStatus(eta, freeTimeDays, customsClearanceDate);

  // Don't show if unknown
  if (demurrageStatus.status === 'unknown') {
    return <span className="text-gray-400">—</span>;
  }

  const icon = getDemurrageIcon(demurrageStatus.status);

  // Show just icon for table cells
  return (
    <span title={demurrageStatus.message} className="cursor-help">
      {icon}
    </span>
  );
}

