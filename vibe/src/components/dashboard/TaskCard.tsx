import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Task } from '../../hooks/useTasks';
import clsx from 'clsx';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  // Helper to get localized text
  const getLocalizedText = (en: string, ar?: string) => {
    return isArabic && ar ? ar : en;
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'error':
        return {
          badge: 'bg-red-100 text-red-800 border-red-300',
          border: 'border-l-4 border-l-red-500',
          icon: '🚨',
        };
      case 'warning':
        return {
          badge: 'bg-orange-100 text-orange-800 border-orange-300',
          border: 'border-l-4 border-l-orange-500',
          icon: '⚠️',
        };
      case 'info':
        return {
          badge: 'bg-green-100 text-green-800 border-green-300',
          border: 'border-l-4 border-l-green-500',
          icon: 'ℹ️',
        };
      default:
        return {
          badge: 'bg-gray-100 text-gray-800 border-gray-300',
          border: 'border-l-4 border-l-gray-500',
          icon: '📋',
        };
    }
  };

  const formatDueDate = (dueDate: string | null, daysUntilDue: number | null) => {
    if (!dueDate || daysUntilDue === null || daysUntilDue === 999) return null;
    
    if (daysUntilDue < 0) {
      return { text: t('tasks.overdue', 'Overdue'), class: 'text-red-600 font-bold' };
    }
    if (daysUntilDue === 0) {
      return { text: t('tasks.dueToday', 'Due today'), class: 'text-red-600 font-bold' };
    }
    if (daysUntilDue === 1) {
      return { text: t('tasks.dueTomorrow', 'Due tomorrow'), class: 'text-orange-600 font-medium' };
    }
    if (daysUntilDue <= 3) {
      return { text: isArabic ? `${daysUntilDue} ${t('tasks.daysLeft', 'days left')}` : `${daysUntilDue} days left`, class: 'text-orange-600' };
    }
    return { text: isArabic ? `${daysUntilDue} ${t('tasks.daysLeft', 'days left')}` : `${daysUntilDue} days left`, class: 'text-gray-600' };
  };

  const handleClick = () => {
    if (task.shipment_id) {
      navigate(`/shipments/${task.shipment_id}`);
    } else if (task.contract_id) {
      navigate(`/contracts/${task.contract_id}`);
    }
  };

  const styles = getSeverityStyles(task.severity);
  const dueDateInfo = formatDueDate(task.due_date, task.days_until_due);

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'bg-white rounded-lg p-4 cursor-pointer transition-all hover:shadow-md',
        styles.border
      )}
    >
      <div className="flex items-start gap-3">
        {/* Priority Icon */}
        <div className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border',
          styles.badge
        )}>
          <span className="text-lg">{styles.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
              {getLocalizedText(task.title, task.title_ar)}
            </h4>
            {dueDateInfo && (
              <span className={clsx('text-xs flex-shrink-0', dueDateInfo.class)}>
                {dueDateInfo.text}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-600 line-clamp-2">
            {getLocalizedText(task.message, task.message_ar)}
          </p>

          {/* Reference Info */}
          {(task.sn || task.contract_no) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              {task.sn && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  {task.sn}
                </span>
              )}
              {task.contract_no && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {task.contract_no}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

