import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ShipmentStatus } from '../../types/api';
import { SHIPMENT_STATUS_CONFIG } from '../../types/api';
import { shipmentsService } from '../../services/shipments';
import { useToast } from '../common/Toast';

interface StatusOverrideModalProps {
  shipmentId: string;
  shipmentSN: string;
  currentStatus: ShipmentStatus | null;
  currentReason?: string | null;
  isOverridden?: boolean;
  overrideBy?: string | null;
  onClose: () => void;
}

export function StatusOverrideModal({
  shipmentId,
  shipmentSN,
  currentStatus,
  currentReason,
  isOverridden,
  overrideBy,
  onClose,
}: StatusOverrideModalProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatus>(currentStatus || 'planning');
  const [reason, setReason] = useState('');

  const statusOptions: ShipmentStatus[] = [
    'planning',
    'delayed',
    'sailed',
    'awaiting_clearance',
    'pending_transport',
    'loaded_to_final',
    'received',
    'quality_issue',
  ];

  const overrideMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/shipments/${shipmentId}/override-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: selectedStatus, reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to override status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast.success(isArabic ? 'تم تغيير الحالة بنجاح' : 'Status overridden successfully');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const clearOverrideMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/shipments/${shipmentId}/clear-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to clear override');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast.success(isArabic ? 'تم مسح التجاوز وإعادة الحساب' : 'Override cleared, status recalculated');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error(isArabic 
        ? 'يجب أن يكون السبب 10 أحرف على الأقل' 
        : 'Reason must be at least 10 characters');
      return;
    }
    overrideMutation.mutate();
  };

  const getStatusLabel = (status: ShipmentStatus) => {
    const config = SHIPMENT_STATUS_CONFIG[status];
    return isArabic ? config.label_ar : config.label;
  };

  const getStatusColor = (status: ShipmentStatus) => {
    return SHIPMENT_STATUS_CONFIG[status]?.color || 'gray';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isArabic ? 'تغيير حالة الشحنة' : 'Override Shipment Status'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {shipmentSN}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current Status Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {isArabic ? 'الحالة الحالية:' : 'Current Status:'}
            </p>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${getStatusColor(currentStatus || 'planning')}-100 text-${getStatusColor(currentStatus || 'planning')}-700 dark:bg-${getStatusColor(currentStatus || 'planning')}-900/30 dark:text-${getStatusColor(currentStatus || 'planning')}-400`}>
                {getStatusLabel(currentStatus || 'planning')}
              </span>
              {isOverridden && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  ({isArabic ? 'تم التجاوز يدوياً' : 'Manually overridden'})
                </span>
              )}
            </div>
            {currentReason && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {currentReason}
              </p>
            )}
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {isArabic ? 'ملاحظة مهمة' : 'Important Note'}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  {isArabic 
                    ? 'هذا التجاوز مؤقت. قد يقوم النظام بإعادة حساب الحالة تلقائياً عند تغيير البيانات.'
                    : 'This override is temporary. The system may recalculate the status automatically when data changes.'}
                </p>
              </div>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isArabic ? 'الحالة الجديدة' : 'New Status'}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ShipmentStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isArabic ? 'سبب التغيير (مطلوب)' : 'Reason for Override (Required)'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isArabic 
                ? 'اشرح لماذا تقوم بتغيير الحالة يدوياً...' 
                : 'Explain why you are overriding the status...'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              minLength={10}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {isArabic 
                ? `${reason.length}/10 حرف كحد أدنى`
                : `${reason.length}/10 characters minimum`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            {isOverridden && (
              <button
                type="button"
                onClick={() => clearOverrideMutation.mutate()}
                disabled={clearOverrideMutation.isPending}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {clearOverrideMutation.isPending
                  ? (isArabic ? 'جاري المسح...' : 'Clearing...')
                  : (isArabic ? 'مسح التجاوز (إعادة الحساب)' : 'Clear Override (Recalculate)')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={overrideMutation.isPending || reason.trim().length < 10}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {overrideMutation.isPending
                ? (isArabic ? 'جاري الحفظ...' : 'Saving...')
                : (isArabic ? 'تأكيد التغيير' : 'Confirm Override')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StatusOverrideModal;

