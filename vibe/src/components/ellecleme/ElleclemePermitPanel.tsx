/**
 * Elleçleme Permit Panel
 * Manage permit approval/rejection
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@headlessui/react';
import {
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { useApprovePermit, useRejectPermit } from '../../hooks/useEllecleme';
import type { ElleclemePermit, ApprovePermitInput, RejectPermitInput } from '../../services/ellecleme';

interface ElleclemePermitPanelProps {
  isOpen: boolean;
  onClose: () => void;
  permit: ElleclemePermit;
  onSuccess?: () => void;
}

export default function ElleclemePermitPanel({
  isOpen,
  onClose,
  permit,
  onSuccess,
}: ElleclemePermitPanelProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const approvePermit = useApprovePermit();
  const rejectPermit = useRejectPermit();

  // State
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [approvalData, setApprovalData] = useState<ApprovePermitInput>({
    approval_ref: '',
    approval_date: new Date().toISOString().split('T')[0],
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
  });
  const [rejectionData, setRejectionData] = useState<RejectPermitInput>({
    rejection_reason: '',
    rejection_date: new Date().toISOString().split('T')[0],
  });

  const handleApprove = async () => {
    if (!approvalData.approval_ref) return;
    
    try {
      await approvePermit.mutateAsync({
        id: permit.id,
        data: approvalData,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error approving permit:', error);
    }
  };

  const handleReject = async () => {
    if (!rejectionData.rejection_reason) return;
    
    try {
      await rejectPermit.mutateAsync({
        id: permit.id,
        data: rejectionData,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Error rejecting permit:', error);
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`mx-auto max-w-lg w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto ${isRtl ? 'rtl' : 'ltr'}`}>
          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200 z-10">
            <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-slate-800">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ClipboardDocumentCheckIcon className="h-5 w-5 text-amber-600" />
              </div>
              {t('ellecleme.permit.title', 'Permit Application')}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Permit Info */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">{t('ellecleme.permit.applicationDate', 'Application Date')}</p>
                  <p className="font-medium text-slate-800">{formatDate(permit.application_date)}</p>
                </div>
                <div>
                  <p className="text-slate-500">{t('ellecleme.permit.type', 'Type')}</p>
                  <p className="font-medium text-slate-800">
                    {t(`ellecleme.permit.types.${permit.permit_type}`, permit.permit_type)}
                  </p>
                </div>
                {permit.customs_office && (
                  <div className="col-span-2">
                    <p className="text-slate-500">{t('ellecleme.permit.customsOffice', 'Customs Office')}</p>
                    <p className="font-medium text-slate-800">{permit.customs_office}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Selection */}
            {!mode && (
              <div className="space-y-3">
                <button
                  onClick={() => setMode('approve')}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                >
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  <span className="font-medium text-green-700">
                    {t('ellecleme.permit.approve', 'Approve Permit')}
                  </span>
                </button>
                <button
                  onClick={() => setMode('reject')}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                >
                  <XCircleIcon className="h-6 w-6 text-red-600" />
                  <span className="font-medium text-red-700">
                    {t('ellecleme.permit.reject', 'Reject Permit')}
                  </span>
                </button>
              </div>
            )}

            {/* Approve Form */}
            {mode === 'approve' && (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
                  <p className="text-sm text-green-700">
                    {t('ellecleme.permit.approveInfo', 'Enter the customs approval details below.')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('ellecleme.permit.approvalRef', 'Approval Reference')} *
                  </label>
                  <input
                    type="text"
                    value={approvalData.approval_ref}
                    onChange={(e) => setApprovalData({ ...approvalData, approval_ref: e.target.value })}
                    placeholder={t('ellecleme.permit.approvalRefPlaceholder', 'Customs reference number')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('ellecleme.permit.approvalDate', 'Approval Date')}
                    </label>
                    <input
                      type="date"
                      value={approvalData.approval_date || ''}
                      onChange={(e) => setApprovalData({ ...approvalData, approval_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('ellecleme.permit.validFrom', 'Valid From')}
                    </label>
                    <input
                      type="date"
                      value={approvalData.valid_from || ''}
                      onChange={(e) => setApprovalData({ ...approvalData, valid_from: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('ellecleme.permit.validUntil', 'Valid Until')} ({t('common.optional', 'Optional')})
                  </label>
                  <input
                    type="date"
                    value={approvalData.valid_until || ''}
                    onChange={(e) => setApprovalData({ ...approvalData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className={`flex items-center justify-between pt-4 border-t border-slate-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => setMode(null)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('common.back', 'Back')}
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={approvePermit.isPending || !approvalData.approval_ref}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    {approvePermit.isPending ? t('common.saving', 'Saving...') : t('ellecleme.permit.approve', 'Approve')}
                  </button>
                </div>
              </div>
            )}

            {/* Reject Form */}
            {mode === 'reject' && (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 mb-4">
                  <p className="text-sm text-red-700">
                    {t('ellecleme.permit.rejectInfo', 'Please provide a reason for rejecting this permit.')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('ellecleme.permit.rejectionReason', 'Rejection Reason')} *
                  </label>
                  <textarea
                    value={rejectionData.rejection_reason}
                    onChange={(e) => setRejectionData({ ...rejectionData, rejection_reason: e.target.value })}
                    rows={3}
                    placeholder={t('ellecleme.permit.rejectionReasonPlaceholder', 'Why was the permit rejected?')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('ellecleme.permit.rejectionDate', 'Rejection Date')}
                  </label>
                  <input
                    type="date"
                    value={rejectionData.rejection_date || ''}
                    onChange={(e) => setRejectionData({ ...rejectionData, rejection_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className={`flex items-center justify-between pt-4 border-t border-slate-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => setMode(null)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('common.back', 'Back')}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={rejectPermit.isPending || !rejectionData.rejection_reason}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    {rejectPermit.isPending ? t('common.saving', 'Saving...') : t('ellecleme.permit.reject', 'Reject')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
