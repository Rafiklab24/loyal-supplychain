/**
 * Elleçleme Request Detail Page
 * Full lifecycle view of a single Elleçleme request
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  WrenchScrewdriverIcon,
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  useElleclemeRequest,
  useSubmitForPermit,
  useStartExecution,
  useCompleteRequest,
  useCancelRequest,
  useApprovePermit,
  usePickupRequest,
  useConfirmResult,
  useRejectResult,
} from '../hooks/useEllecleme';
import { useAuth } from '../contexts/AuthContext';
import { getStatusColor, getPriorityColor, getPermitStatusColor } from '../services/ellecleme';
import type { ElleclemeRequest, ElleclemeStatus } from '../services/ellecleme';
import ElleclemeExecutionForm from '../components/ellecleme/ElleclemeExecutionForm';
import ElleclemeCostTable from '../components/ellecleme/ElleclemeCostTable';
import ElleclemeDocumentUpload from '../components/ellecleme/ElleclemeDocumentUpload';
import ElleclemePermitPanel from '../components/ellecleme/ElleclemePermitPanel';
import ElleçlemeTutanak from '../components/ellecleme/ElleçlemeTutanak';

type TabType = 'details' | 'costs' | 'documents';

// Status timeline steps
const WORKFLOW_STEPS: { status: ElleclemeStatus; labelKey: string; icon: any }[] = [
  { status: 'draft', labelKey: 'ellecleme.statuses.draft', icon: DocumentTextIcon },
  { status: 'pending_permit', labelKey: 'ellecleme.statuses.pending_permit', icon: ClipboardDocumentCheckIcon },
  { status: 'approved', labelKey: 'ellecleme.statuses.approved', icon: CheckCircleIcon },
  { status: 'in_progress', labelKey: 'ellecleme.statuses.in_progress', icon: PlayIcon },
  { status: 'pending_confirmation', labelKey: 'ellecleme.statuses.pending_confirmation', icon: ClockIcon },
  { status: 'completed', labelKey: 'ellecleme.statuses.completed', icon: CheckCircleIcon },
];

export default function ElleclemeRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language;

  // Auth
  const { user } = useAuth();
  const userRole = user?.role || '';
  // Hamza = Antrepo role, Ragıp = Clearance role
  const isWarehouseStaff = ['Antrepo', 'Admin', 'Exec'].includes(userRole);
  const isClearanceStaff = ['Clearance', 'Admin', 'Exec'].includes(userRole);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [showExecutionForm, setShowExecutionForm] = useState(false);
  const [showPermitPanel, setShowPermitPanel] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showTutanak, setShowTutanak] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmationNotes, setConfirmationNotes] = useState('');

  // Data
  const { data: request, isLoading, error, refetch } = useElleclemeRequest(id || '');

  // Mutations
  const submitForPermit = useSubmitForPermit();
  const startExecution = useStartExecution();
  const completeRequest = useCompleteRequest();
  const cancelRequest = useCancelRequest();
  const approvePermit = useApprovePermit();
  const pickupRequest = usePickupRequest();
  const confirmResult = useConfirmResult();
  const rejectResult = useRejectResult();

  // Helpers
  const getActivityName = () => {
    if (!request) return '';
    if (lang === 'ar' && request.activity_name_ar) return request.activity_name_ar;
    if (lang === 'tr' && request.activity_name_tr) return request.activity_name_tr;
    return request.activity_name || request.activity_code;
  };

  const getStatusLabel = (status: ElleclemeStatus) => t(`ellecleme.statuses.${status}`, status);
  const getPriorityLabel = (priority: string) => t(`ellecleme.priorities.${priority}`, priority);

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US', { maximumFractionDigits: 3 });
  };

  const formatCurrency = (amount: number | undefined, currency = 'TRY') => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  // Get current step index
  const getCurrentStepIndex = () => {
    if (!request) return 0;
    if (request.status === 'cancelled' || request.status === 'rejected') return -1;
    return WORKFLOW_STEPS.findIndex(step => step.status === request.status);
  };

  // Actions
  const handleSubmitForPermit = async () => {
    if (!id) return;
    try {
      await submitForPermit.mutateAsync({ id, data: {} });
      refetch();
    } catch (error) {
      console.error('Error submitting for permit:', error);
    }
  };

  const handleStartExecution = async () => {
    if (!id) return;
    try {
      await startExecution.mutateAsync({ id, data: {} });
      refetch();
    } catch (error) {
      console.error('Error starting execution:', error);
    }
  };

  const handleCancel = async () => {
    if (!id || !cancelReason) return;
    try {
      await cancelRequest.mutateAsync({ id, reason: cancelReason });
      setShowCancelDialog(false);
      setCancelReason('');
      refetch();
    } catch (error) {
      console.error('Error cancelling request:', error);
    }
  };

  // Ragıp picks up the request
  const handlePickup = async () => {
    if (!id) return;
    try {
      await pickupRequest.mutateAsync({ id });
      refetch();
    } catch (error) {
      console.error('Error picking up request:', error);
    }
  };

  // Hamza confirms the result
  const handleConfirmResult = async () => {
    if (!id) return;
    try {
      await confirmResult.mutateAsync({ id, confirmation_notes: confirmationNotes });
      setConfirmationNotes('');
      refetch();
    } catch (error) {
      console.error('Error confirming result:', error);
    }
  };

  // Hamza rejects the result
  const handleRejectResult = async () => {
    if (!id || !rejectReason) return;
    try {
      await rejectResult.mutateAsync({ id, rejection_reason: rejectReason });
      setShowRejectDialog(false);
      setRejectReason('');
      refetch();
    } catch (error) {
      console.error('Error rejecting result:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-slate-600">{t('common.error', 'Error loading data')}</p>
          <button
            onClick={() => navigate('/ellecleme')}
            className="mt-4 px-4 py-2 text-sm text-blue-600 hover:underline"
          >
            {t('common.goBack', 'Go Back')}
          </button>
        </div>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/ellecleme')}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className={`h-5 w-5 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <WrenchScrewdriverIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-800 font-mono">
                  {request.request_number}
                </h1>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                  {getStatusLabel(request.status)}
                </span>
                {request.priority !== 'normal' && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(request.priority)}`}>
                    {getPriorityLabel(request.priority)}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {request.activity_code} - {getActivityName()}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Role Based */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* DRAFT - Hamza (Warehouse) can edit, Ragıp (Clearance) can pickup */}
          {request.status === 'draft' && (
            <>
              {/* Hamza can edit and cancel his request */}
              {isWarehouseStaff && (
                <>
                  <button
                    onClick={() => navigate(`/ellecleme/requests/${id}/edit`)}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                    {t('ellecleme.editRequest', 'Edit Request')}
                  </button>
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <XCircleIcon className="h-5 w-5" />
                    {t('ellecleme.actions.cancel', 'Cancel')}
                  </button>
                </>
              )}
              {/* Ragıp can pickup the request to process */}
              {isClearanceStaff && (
                <button
                  onClick={handlePickup}
                  disabled={pickupRequest.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <ClipboardDocumentCheckIcon className="h-5 w-5" />
                  {t('ellecleme.actions.pickup', 'Pick Up Request')}
                </button>
              )}
            </>
          )}

          {/* PENDING_PERMIT - Ragıp handles permit */}
          {request.status === 'pending_permit' && isClearanceStaff && (
            <button
              onClick={() => setShowPermitPanel(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircleIcon className="h-5 w-5" />
              {t('ellecleme.permit.approve', 'Approve Permit')}
            </button>
          )}

          {/* APPROVED - Ragıp starts execution */}
          {request.status === 'approved' && isClearanceStaff && (
            <button
              onClick={handleStartExecution}
              disabled={startExecution.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <PlayIcon className="h-5 w-5" />
              {t('ellecleme.actions.startExecution', 'Start Execution')}
            </button>
          )}

          {/* IN_PROGRESS - Ragıp completes and submits for confirmation */}
          {request.status === 'in_progress' && isClearanceStaff && (
            <button
              onClick={() => setShowExecutionForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <CheckCircleIcon className="h-5 w-5" />
              {t('ellecleme.actions.completeRequest', 'Submit for Confirmation')}
            </button>
          )}

          {/* PENDING_CONFIRMATION - Hamza confirms or rejects */}
          {request.status === 'pending_confirmation' && (
            <>
              {isWarehouseStaff && (
                <>
                  <button
                    onClick={handleConfirmResult}
                    disabled={confirmResult.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    {t('ellecleme.actions.confirmResult', 'Confirm Result')}
                  </button>
                  <button
                    onClick={() => setShowRejectDialog(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <XCircleIcon className="h-5 w-5" />
                    {t('ellecleme.actions.rejectResult', 'Reject Result')}
                  </button>
                </>
              )}
              {/* Ragıp sees pending status */}
              {isClearanceStaff && !isWarehouseStaff && (
                <span className="text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
                  <ClockIcon className="h-4 w-4 inline mr-1" />
                  {t('ellecleme.workflow.awaitingConfirmation', 'Awaiting confirmation from Warehouse team')}
                </span>
              )}
            </>
          )}

          {/* COMPLETED - View Tutanak */}
          {request.status === 'completed' && (
            <button
              onClick={() => setShowTutanak(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <DocumentTextIcon className="h-5 w-5" />
              {t('ellecleme.document.types.tutanak', 'Tutanak')}
            </button>
          )}
        </div>

        {/* Workflow Info Banner */}
        {request.status === 'draft' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <ClockIcon className="h-4 w-4 inline mr-1" />
            {t('ellecleme.workflow.awaitingPickup', 'Awaiting pickup by Clearance team')}
          </div>
        )}

        {/* Result Rejected Warning */}
        {request.result_rejected && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
            {t('ellecleme.workflow.resultRejected', 'Result was rejected')}
            {request.result_rejection_reason && (
              <span className="block mt-1 text-red-600">
                {request.result_rejection_reason}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status Timeline */}
      {currentStepIndex >= 0 && (
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const Icon = step.icon;

              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-600'
                          : isActive
                          ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-600 ring-offset-2'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`text-xs mt-2 ${
                        isActive ? 'font-medium text-blue-600' : 'text-slate-500'
                      }`}
                    >
                      {t(step.labelKey)}
                    </span>
                  </div>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        isCompleted ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancelled/Rejected Banner */}
      {(request.status === 'cancelled' || request.status === 'rejected') && (
        <div className={`p-4 rounded-xl mb-6 ${
          request.status === 'cancelled' ? 'bg-slate-100 border border-slate-300' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <XCircleIcon className={`h-6 w-6 ${request.status === 'cancelled' ? 'text-slate-500' : 'text-red-500'}`} />
            <div>
              <p className={`font-medium ${request.status === 'cancelled' ? 'text-slate-700' : 'text-red-700'}`}>
                {getStatusLabel(request.status)}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {request.cancelled_reason || request.rejected_reason || '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex items-center gap-1 p-2">
            {(['details', 'costs', 'documents'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab === 'details' && t('ellecleme.requests', 'Details')}
                {tab === 'costs' && (
                  <span className="flex items-center gap-2">
                    <CurrencyDollarIcon className="h-4 w-4" />
                    {t('ellecleme.costs', 'Costs')}
                    {request.total_cost > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {formatCurrency(request.total_cost, request.cost_currency || 'TRY')}
                      </span>
                    )}
                  </span>
                )}
                {tab === 'documents' && (
                  <span className="flex items-center gap-2">
                    <PhotoIcon className="h-4 w-4" />
                    {t('ellecleme.documents', 'Documents')}
                    {request.document_count > 0 && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {request.document_count}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - Request Info */}
              <div className="space-y-6">
                {/* Inventory Info */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">{t('antrepo.inventory', 'Inventory')}</h3>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-indigo-600">{request.lot_code}</span>
                      <span className="font-semibold text-slate-800" dir="ltr">
                        {formatNumber(request.quantity_mt)} MT
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{request.product_text || '-'}</p>
                    {request.shipment_sn && (
                      <p className="text-xs text-slate-500 mt-1">{t('shipments.sn', 'SN')}: {request.shipment_sn}</p>
                    )}
                    {request.supplier_name && (
                      <p className="text-xs text-slate-500">{request.supplier_name}</p>
                    )}
                  </div>
                </div>

                {/* Activity Details */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">{t('ellecleme.activityType', 'Activity')}</h3>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl font-bold text-blue-700 font-mono">{request.activity_code}</span>
                      <div>
                        <p className="font-medium text-blue-800">{getActivityName()}</p>
                        {request.gtip_may_change && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                            <ExclamationTriangleIcon className="h-3 w-3" />
                            {t('ellecleme.gtip.mayChange', 'This activity may change the GTİP code')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason & Description */}
                {(request.reason || request.description) && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-3">{t('ellecleme.reason', 'Reason')}</h3>
                    <div className="space-y-3">
                      {request.reason && (
                        <p className="text-sm text-slate-600">{request.reason}</p>
                      )}
                      {request.description && (
                        <p className="text-sm text-slate-500">{request.description}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* GTİP Info */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">GTİP</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">{t('ellecleme.gtip.original', 'Original')}</p>
                      <p className="font-mono font-medium text-slate-800">{request.original_gtip || '-'}</p>
                    </div>
                    {request.gtip_changed && (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs text-amber-600">{t('ellecleme.gtip.new', 'New')}</p>
                        <p className="font-mono font-medium text-amber-800">{request.new_gtip || '-'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Dates & Execution */}
              <div className="space-y-6">
                {/* Dates */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">{t('common.dates', 'Dates')}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t('ellecleme.startDate', 'Requested')}</span>
                      <span className="text-sm text-slate-800">{formatDate(request.requested_date)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t('ellecleme.plannedDate', 'Planned')}</span>
                      <span className="text-sm text-slate-800">{formatDate(request.planned_execution_date)}</span>
                    </div>
                    {request.actual_start_date && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t('ellecleme.startDate', 'Started')}</span>
                        <span className="text-sm text-slate-800">{formatDate(request.actual_start_date)}</span>
                      </div>
                    )}
                    {request.actual_completion_date && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{t('ellecleme.completionDate', 'Completed')}</span>
                        <span className="text-sm text-emerald-600 font-medium">{formatDate(request.actual_completion_date)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Permit Info */}
                {request.permit_id && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-3">{t('ellecleme.permit.title', 'Permit')}</h3>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500">{t('ellecleme.status', 'Status')}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPermitStatusColor(request.permit_status!)}`}>
                          {t(`ellecleme.permit.status.${request.permit_status}`, request.permit_status)}
                        </span>
                      </div>
                      {request.permit_application_date && (
                        <div className="flex items-center justify-between text-sm py-1">
                          <span className="text-slate-500">{t('ellecleme.permit.applicationDate', 'Applied')}</span>
                          <span className="text-slate-800">{formatDate(request.permit_application_date)}</span>
                        </div>
                      )}
                      {request.permit_approval_date && (
                        <div className="flex items-center justify-between text-sm py-1">
                          <span className="text-slate-500">{t('ellecleme.permit.approvalDate', 'Approved')}</span>
                          <span className="text-emerald-600">{formatDate(request.permit_approval_date)}</span>
                        </div>
                      )}
                      {request.permit_approval_ref && (
                        <div className="flex items-center justify-between text-sm py-1">
                          <span className="text-slate-500">{t('ellecleme.permit.approvalRef', 'Reference')}</span>
                          <span className="font-mono text-slate-800">{request.permit_approval_ref}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Execution Results */}
                {(request.before_description || request.after_description) && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-3">{t('ellecleme.execution.title', 'Execution Results')}</h3>
                    <div className="space-y-4">
                      {request.before_description && (
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-500 mb-1">{t('ellecleme.execution.beforeDescription', 'Before')}</p>
                          <p className="text-sm text-slate-700">{request.before_description}</p>
                        </div>
                      )}
                      {request.after_description && (
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <p className="text-xs text-emerald-600 mb-1">{t('ellecleme.execution.afterDescription', 'After')}</p>
                          <p className="text-sm text-emerald-800">{request.after_description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Executed By */}
                {request.executed_by_name && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-500">{t('ellecleme.execution.executedBy', 'Executed By')}</span>
                    <span className="text-sm font-medium text-slate-800">{request.executed_by_name}</span>
                  </div>
                )}

                {/* Workflow Tracking */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">{t('common.workflow', 'Workflow')}</h3>
                  <div className="space-y-2">
                    {request.requested_by_name && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                        <span className="text-slate-500">{t('ellecleme.workflow.requestedBy', 'Requested by')}</span>
                        <span className="font-medium text-slate-700">{request.requested_by_name}</span>
                      </div>
                    )}
                    {request.processed_by_name && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                        <span className="text-slate-500">{t('ellecleme.workflow.processedBy', 'Processed by')}</span>
                        <span className="font-medium text-slate-700">{request.processed_by_name}</span>
                      </div>
                    )}
                    {request.picked_up_at && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                        <span className="text-slate-500">{t('ellecleme.workflow.pickedUpAt', 'Picked up at')}</span>
                        <span className="text-slate-600">{formatDate(request.picked_up_at)}</span>
                      </div>
                    )}
                    {request.confirmed_by_name && (
                      <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg text-sm">
                        <span className="text-emerald-600">{t('ellecleme.workflow.confirmedBy', 'Confirmed by')}</span>
                        <span className="font-medium text-emerald-700">{request.confirmed_by_name}</span>
                      </div>
                    )}
                    {request.confirmed_at && (
                      <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg text-sm">
                        <span className="text-emerald-600">{t('ellecleme.workflow.confirmedAt', 'Confirmed at')}</span>
                        <span className="text-emerald-700">{formatDate(request.confirmed_at)}</span>
                      </div>
                    )}
                    {request.confirmation_notes && (
                      <div className="p-3 bg-emerald-50 rounded-lg text-sm">
                        <p className="text-xs text-emerald-600 mb-1">{t('ellecleme.workflow.confirmationNotes', 'Confirmation Notes')}</p>
                        <p className="text-emerald-800">{request.confirmation_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Costs Tab */}
          {activeTab === 'costs' && (
            <ElleclemeCostTable requestId={id!} onUpdate={refetch} />
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <ElleclemeDocumentUpload requestId={id!} onUpdate={refetch} />
          )}
        </div>
      </div>

      {/* Execution Form Modal */}
      {showExecutionForm && (
        <ElleclemeExecutionForm
          isOpen={showExecutionForm}
          onClose={() => setShowExecutionForm(false)}
          request={request}
          onSuccess={() => {
            setShowExecutionForm(false);
            refetch();
          }}
        />
      )}

      {/* Permit Panel Modal */}
      {showPermitPanel && request.permits && request.permits.length > 0 && (
        <ElleclemePermitPanel
          isOpen={showPermitPanel}
          onClose={() => setShowPermitPanel(false)}
          permit={request.permits[0]}
          onSuccess={() => {
            setShowPermitPanel(false);
            refetch();
          }}
        />
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCancelDialog(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className={`relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {t('ellecleme.actions.cancel', 'Cancel Request')}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {t('ellecleme.confirmCancel', 'Are you sure you want to cancel this request?')}
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('ellecleme.actions.cancelReason', 'Cancellation reason...')}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!cancelReason || cancelRequest.isPending}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {cancelRequest.isPending ? t('common.saving', 'Saving...') : t('common.confirm', 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Result Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRejectDialog(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className={`relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                {t('ellecleme.actions.rejectResult', 'Reject Result')}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {t('ellecleme.actions.rejectResultDesc', 'Send back for revision')}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('ellecleme.actions.rejectionReasonPlaceholder', 'Explain why this result is being rejected...')}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowRejectDialog(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleRejectResult}
                  disabled={!rejectReason || rejectResult.isPending}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {rejectResult.isPending ? t('common.saving', 'Saving...') : t('ellecleme.actions.rejectResult', 'Reject')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tutanak Modal */}
      {showTutanak && (
        <ElleçlemeTutanak
          isOpen={showTutanak}
          onClose={() => setShowTutanak(false)}
          requestId={id!}
        />
      )}
    </div>
  );
}
