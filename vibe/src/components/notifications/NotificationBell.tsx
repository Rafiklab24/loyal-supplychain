import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
} from '../../hooks/useNotifications';

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();
  
  // Manual refresh mutation (apiClient automatically includes auth token)
  const refreshNotifications = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/notifications/check');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  
  // Complete action mutation (apiClient automatically includes auth token)
  const completeAction = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiClient.put(`/notifications/${notificationId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  
  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];
  
  // Check for critical and warning notifications
  const hasCritical = notifications.some((n: any) => n.severity === 'error' && !n.is_read);
  const hasWarning = notifications.some((n: any) => n.severity === 'warning' && !n.is_read);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'success':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return '⚠️';
      case 'warning':
        return '⏰';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.shipment_id) {
      navigate(`/shipments/${notification.shipment_id}`);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleDelete = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    deleteNotification.mutate(notificationId);
  };
  
  const handleCompleteAction = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    completeAction.mutate(notificationId);
  };
  
  const handleRefresh = () => {
    refreshNotifications.mutate();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notifications.justNow', 'Just now');
    if (diffMins < 60) return t('notifications.minutesAgo', `${diffMins}m ago`);
    if (diffHours < 24) return t('notifications.hoursAgo', `${diffHours}h ago`);
    return t('notifications.daysAgo', `${diffDays}d ago`);
  };
  
  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;
    
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);
    
    if (diffDays < 0) return { text: t('notifications.overdue', 'Overdue'), class: 'text-red-600 dark:text-red-400' };
    if (diffDays === 0) return { text: t('notifications.dueToday', 'Due today'), class: 'text-red-600 dark:text-red-400' };
    if (diffDays === 1) return { text: t('notifications.dueTomorrow', 'Due tomorrow'), class: 'text-orange-600 dark:text-orange-400' };
    if (diffDays <= 7) return { text: `${diffDays} ${t('notifications.daysLeft', 'days left')}`, class: 'text-orange-600 dark:text-orange-400' };
    return { text: `${diffDays} ${t('notifications.daysLeft', 'days left')}`, class: 'text-gray-600 dark:text-gray-400' };
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button - Color-coded based on severity */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-colors ${
          hasCritical
            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 animate-pulse'
            : hasWarning
            ? 'text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Unread Badge - Color-coded */}
        {unreadCount > 0 && (
          <span className={`absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 rounded-full ${
            hasCritical
              ? 'bg-red-600'
              : hasWarning
              ? 'bg-orange-500'
              : 'bg-blue-600'
          }`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className="absolute ltr:right-0 rtl:left-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[60] max-h-[600px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('notifications.title', 'Notifications')}
            </h3>
            <div className="flex items-center gap-2">
              {/* Manual Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshNotifications.isPending}
                className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                title={t('notifications.refresh', 'Refresh')}
              >
                <svg
                  className={`w-5 h-5 ${refreshNotifications.isPending ? 'animate-spin' : ''}`}
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
              </button>
              
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('notifications.markAllRead', 'Mark all as read')}
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                {t('common.loading', 'Loading...')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('notifications.empty', 'No notifications')}
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer
                    transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50
                    ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getSeverityColor(notification.severity)}`}>
                      <span className="text-lg">{getSeverityIcon(notification.severity)}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => handleDelete(e, notification.id)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {notification.message}
                      </p>
                      
                      {notification.sn && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                          {t('notifications.shipment', 'Shipment')}: {notification.sn}
                        </p>
                      )}
                      
                      {/* Action Required Section */}
                      {notification.action_required && !notification.action_completed && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('notifications.actionRequired', 'Action Required:')}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {notification.action_required}
                          </p>
                          {notification.due_date && formatDueDate(notification.due_date) && (
                            <p className={`text-xs font-medium mt-1 ${formatDueDate(notification.due_date)?.class}`}>
                              📅 {formatDueDate(notification.due_date)?.text}
                            </p>
                          )}
                          <button
                            onClick={(e) => handleCompleteAction(e, notification.id)}
                            disabled={completeAction.isPending}
                            className="mt-2 w-full text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                          >
                            {t('notifications.markComplete', 'Mark as Completed')}
                          </button>
                        </div>
                      )}
                      
                      {notification.action_completed && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{t('notifications.completed', 'Completed')}</span>
                        </div>
                      )}
                      
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    
                    {!notification.is_read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

