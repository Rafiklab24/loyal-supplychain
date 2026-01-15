import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { LoadingState } from '../components/common/LoadingState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

interface Task {
  id: string;
  type: string;
  title: string;
  title_ar?: string;
  message: string;
  message_ar?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  action_required: string;
  action_required_ar?: string;
  due_date: string | null;
  days_until_due: number | null;
  shipment_id: string | null;
  contract_id: string | null;
  sn?: string;
  product_text?: string;
  eta?: string;
  contract_no?: string;
  shipment_status?: string;
  pol_name?: string;
  pod_name?: string;
  created_at: string;
}

interface TasksResponse {
  total: number;
  tasks: Task[];
  grouped: {
    critical: Task[];
    warning: Task[];
    info: Task[];
  };
  timestamp: string;
}

export function TasksPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  
  // Helper to get localized content
  const isArabic = i18n.language === 'ar';
  const getLocalizedText = (en: string, ar?: string) => {
    return isArabic && ar ? ar : en;
  };

  // Fetch pending tasks
  const { data, isLoading, error } = useQuery<TasksResponse>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications/pending');
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Manual refresh
  const refreshTasks = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/notifications/check');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Complete task
  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiClient.put(`/notifications/${taskId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'warning':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📋';
    }
  };

  const formatDueDate = (dueDate: string | null, daysUntilDue: number | null) => {
    if (!dueDate) return null;
    
    if (daysUntilDue === null || daysUntilDue === 999) return null;
    
    if (daysUntilDue === -1 || daysUntilDue < 0) {
      return { text: t('notifications.overdue', 'Overdue'), class: 'text-red-600 dark:text-red-400 font-bold' };
    }
    if (daysUntilDue === 0) {
      return { text: t('notifications.dueToday', 'Due today'), class: 'text-red-600 dark:text-red-400 font-bold' };
    }
    if (daysUntilDue === 1) {
      return { text: t('notifications.dueTomorrow', 'Due tomorrow'), class: 'text-orange-600 dark:text-orange-400 font-medium' };
    }
    if (daysUntilDue <= 7) {
      return { text: `${daysUntilDue} ${t('notifications.daysLeft', 'days left')}`, class: 'text-orange-600 dark:text-orange-400' };
    }
    return { text: `${daysUntilDue} ${t('notifications.daysLeft', 'days left')}`, class: 'text-gray-600 dark:text-gray-400' };
  };

  const handleTaskClick = (task: Task) => {
    if (task.shipment_id) {
      navigate(`/shipments/${task.shipment_id}`);
    } else if (task.contract_id) {
      navigate(`/contracts/${task.contract_id}`);
    }
  };

  const filteredTasks = selectedSeverity === 'all' 
    ? data?.tasks || [] 
    : data?.tasks.filter(t => t.severity === selectedSeverity) || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              📋 {t('tasks.title', 'Pending Tasks')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('tasks.description', 'Track and complete all action items')}
            </p>
          </div>
          
          <button
            onClick={() => refreshTasks.mutate()}
            disabled={refreshTasks.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <svg
              className={`w-5 h-5 ${refreshTasks.isPending ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t('notifications.refresh', 'Refresh')}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedSeverity('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'all'
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {t('tasks.all', 'All')} ({data?.total || 0})
          </button>
          <button
            onClick={() => setSelectedSeverity('error')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            🚨 {t('tasks.critical', 'Critical')} ({data?.grouped.critical.length || 0})
          </button>
          <button
            onClick={() => setSelectedSeverity('warning')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'warning'
                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            ⚠️ {t('tasks.warning', 'Warning')} ({data?.grouped.warning.length || 0})
          </button>
          <button
            onClick={() => setSelectedSeverity('info')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'info'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            ℹ️ {t('tasks.info', 'Info')} ({data?.grouped.info.length || 0})
          </button>
        </div>
      </div>

      {/* Tasks List with Loading State */}
      <LoadingState
        isLoading={isLoading}
        error={error ? (error instanceof Error ? error : new Error(String(error))) : null}
        data={filteredTasks}
        skeleton={<LoadingSkeleton lines={5} />}
        emptyState={
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              {t('tasks.noTasks', 'No pending tasks')}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('tasks.allCaughtUp', 'You\'re all caught up!')}
            </p>
          </div>
        }
      >
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-4">
                {/* Severity Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getSeverityBadge(task.severity)}`}>
                  <span className="text-xl">{getSeverityIcon(task.severity)}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {getLocalizedText(task.title, task.title_ar)}
                    </h3>
                    {task.due_date && formatDueDate(task.due_date, task.days_until_due) && (
                      <span className={`text-sm ${formatDueDate(task.due_date, task.days_until_due)?.class}`}>
                        📅 {formatDueDate(task.due_date, task.days_until_due)?.text}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {getLocalizedText(task.message, task.message_ar)}
                  </p>

                  {/* Reference Info */}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                    {task.sn && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        {task.sn}
                      </span>
                    )}
                    {task.contract_no && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {task.contract_no}
                      </span>
                    )}
                    {task.pol_name && task.pod_name && (
                      <span>{task.pol_name} → {task.pod_name}</span>
                    )}
                  </div>

                  {/* Action Required */}
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('notifications.actionRequired', 'Action Required:')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {getLocalizedText(task.action_required, task.action_required_ar)}
                    </p>
                  </div>
                </div>

                {/* Complete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    completeTask.mutate(task.id);
                  }}
                  disabled={completeTask.isPending}
                  className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {t('notifications.markComplete', 'Mark Complete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </LoadingState>
    </div>
  );
}

