import React from 'react';
import { useTranslation } from 'react-i18next';

interface BatchStatusBadgeProps {
  status: 'pending' | 'approved' | 'archived';
  size?: 'sm' | 'md';
}

const BatchStatusBadge: React.FC<BatchStatusBadgeProps> = ({ status, size = 'md' }) => {
  const { t } = useTranslation();

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2 py-1 text-xs';

  const statusConfig = {
    pending: {
      label: t('batches.statusPending'),
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    approved: {
      label: t('batches.statusApproved'),
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    archived: {
      label: t('batches.statusArchived'),
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    },
  };

  const config = statusConfig[status];

  return (
    <span className={`${sizeClasses} ${config.className} rounded-full font-medium whitespace-nowrap`}>
      {config.label}
    </span>
  );
};

export default BatchStatusBadge;

