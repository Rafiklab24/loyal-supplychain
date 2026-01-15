/**
 * Quality Review Page
 * Dashboard for Supervisors and HQ SCLM to review quality incidents
 * 
 * Features:
 * - List incidents with status filters
 * - Incident detail view with media gallery
 * - Review actions: Request Resampling, Keep HOLD, Clear HOLD, Close
 */

import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  XMarkIcon,
  ArrowPathIcon,
  LockClosedIcon,
  LockOpenIcon,
  DocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { formatDateString } from '../utils/format';
import {
  getQualityIncidents,
  addReviewAction,
  getIncidentStats,
  ISSUE_TYPES,
} from '../services/qualityIncidents';
import type {
  QualityIncident,
  IncidentStatus,
  ActionType,
} from '../services/qualityIncidents';

// ============================================================
// STATUS CONFIGURATION
// ============================================================

const STATUS_CONFIG: Record<IncidentStatus, { 
  label: string; 
  labelAr: string; 
  color: string;
  icon: typeof ClockIcon;
}> = {
  draft: { 
    label: 'Draft', 
    labelAr: 'مسودة', 
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    icon: ClockIcon,
  },
  submitted: { 
    label: 'Submitted', 
    labelAr: 'مقدم', 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    icon: DocumentCheckIcon,
  },
  under_review: { 
    label: 'Under Review', 
    labelAr: 'قيد المراجعة', 
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    icon: EyeIcon,
  },
  action_set: { 
    label: 'Action Set', 
    labelAr: 'تم اتخاذ إجراء', 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    icon: CheckCircleIcon,
  },
  closed: { 
    label: 'Closed', 
    labelAr: 'مغلق', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    icon: CheckCircleIcon,
  },
};

// ============================================================
// REVIEW ACTION MODAL
// ============================================================

interface ReviewActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: QualityIncident | null;
  actionType: ActionType | null;
  onSubmit: (notes: string, targetSamples?: string[]) => void;
  isLoading: boolean;
  isRtl: boolean;
}

function ReviewActionModal({
  isOpen,
  onClose,
  incident,
  actionType,
  onSubmit,
  isLoading,
  isRtl
}: ReviewActionModalProps) {
  const [notes, setNotes] = useState('');
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  
  const handleSubmit = () => {
    onSubmit(notes, actionType === 'request_resample' ? selectedSamples : undefined);
    setNotes('');
    setSelectedSamples([]);
  };
  
  const getActionTitle = () => {
    switch (actionType) {
      case 'request_resample': return isRtl ? 'طلب إعادة العينات' : 'Request Resampling';
      case 'keep_hold': return isRtl ? 'إبقاء الاحتجاز' : 'Keep HOLD';
      case 'clear_hold': return isRtl ? 'رفع الاحتجاز' : 'Clear HOLD';
      case 'close': return isRtl ? 'إغلاق الحادثة' : 'Close Incident';
      default: return '';
    }
  };
  
  const getActionColor = () => {
    switch (actionType) {
      case 'clear_hold': return 'bg-green-600 hover:bg-green-700';
      case 'keep_hold': return 'bg-red-600 hover:bg-red-700';
      case 'close': return 'bg-purple-600 hover:bg-purple-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                <div className="p-6">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {getActionTitle()}
                  </Dialog.Title>
                  
                  {actionType === 'request_resample' && incident && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {isRtl ? 'اختر العينات لإعادتها' : 'Select samples to redo'}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {incident.sample_cards.map(sample => (
                          <button
                            key={sample.sample_id}
                            onClick={() => {
                              setSelectedSamples(prev =>
                                prev.includes(sample.sample_id)
                                  ? prev.filter(s => s !== sample.sample_id)
                                  : [...prev, sample.sample_id]
                              );
                            }}
                            className={`p-3 rounded-lg border-2 font-bold transition-colors ${
                              selectedSamples.includes(sample.sample_id)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {sample.sample_id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {isRtl ? 'ملاحظات' : 'Notes'} 
                      {(actionType === 'keep_hold' || actionType === 'clear_hold') && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder={isRtl ? 'أدخل ملاحظاتك...' : 'Enter your notes...'}
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isLoading || (
                        (actionType === 'keep_hold' || actionType === 'clear_hold') && !notes.trim()
                      ) || (
                        actionType === 'request_resample' && selectedSamples.length === 0
                      )}
                      className={`flex-1 py-2 px-4 text-white font-medium rounded-lg disabled:opacity-50 ${getActionColor()}`}
                    >
                      {isLoading ? <Spinner /> : (isRtl ? 'تأكيد' : 'Confirm')}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================
// INCIDENT CARD COMPONENT
// ============================================================

interface IncidentCardProps {
  incident: QualityIncident;
  onSelect: (incident: QualityIncident) => void;
  isRtl: boolean;
}

function IncidentCard({ incident, onSelect, isRtl }: IncidentCardProps) {
  const statusConfig = STATUS_CONFIG[incident.status];
  const StatusIcon = statusConfig.icon;
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onSelect(incident)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              {incident.shipment_sn}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {incident.supplier_name}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
            <StatusIcon className="h-4 w-4 mr-1" />
            {isRtl ? statusConfig.labelAr : statusConfig.label}
          </span>
        </div>
        
        {/* Issue Type */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">
            {incident.issue_type && ISSUE_TYPES[incident.issue_type]?.icon}
          </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {incident.issue_type && ISSUE_TYPES[incident.issue_type]
              ? (isRtl ? ISSUE_TYPES[incident.issue_type].labelAr : ISSUE_TYPES[incident.issue_type].label)
              : 'Unknown'}
          </span>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isRtl ? 'العينات' : 'Samples'}
            </p>
            <p className="font-bold text-gray-900 dark:text-white">
              {incident.samples_completed}/{incident.samples_required}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isRtl ? 'المتوسط' : 'Avg'}
            </p>
            <p className={`font-bold ${
              (Number(incident.avg_defect_pct) || 0) > 5 ? 'text-red-600' : 'text-amber-600'
            }`}>
              {Number(incident.avg_defect_pct || 0).toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isRtl ? 'الصور' : 'Media'}
            </p>
            <p className="font-bold text-gray-900 dark:text-white">
              {incident.media?.length || 0}
            </p>
          </div>
        </div>
        
        {/* Timestamp */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          {formatDateString(incident.created_at)} • {incident.reporter_name || incident.reporter_username}
        </p>
      </div>
    </Card>
  );
}

// ============================================================
// INCIDENT DETAIL PANEL
// ============================================================

interface IncidentDetailProps {
  incident: QualityIncident;
  onAction: (action: ActionType) => void;
  onClose: () => void;
  isRtl: boolean;
}

function IncidentDetail({ incident, onAction, onClose, isRtl }: IncidentDetailProps) {
  const statusConfig = STATUS_CONFIG[incident.status];
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {incident.shipment_sn}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {incident.product_text} • {incident.supplier_name}
          </p>
        </div>
        <button onClick={onClose} className="p-2">
          <XMarkIcon className="h-6 w-6 text-gray-500" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status & Issue */}
        <div className="flex gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
            {isRtl ? statusConfig.labelAr : statusConfig.label}
          </span>
          <Badge color="amber">
            {incident.issue_type && ISSUE_TYPES[incident.issue_type]
              ? ISSUE_TYPES[incident.issue_type].icon + ' ' + (isRtl ? ISSUE_TYPES[incident.issue_type].labelAr : ISSUE_TYPES[incident.issue_type].label)
              : 'Unknown'}
          </Badge>
        </div>
        
        {/* Stats Card */}
        <Card className="p-4">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            {isRtl ? 'إحصائيات العيوب' : 'Defect Statistics'}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {Number(incident.min_defect_pct || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRtl ? 'الحد الأدنى' : 'Min'}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {Number(incident.avg_defect_pct || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRtl ? 'المتوسط' : 'Avg'}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {Number(incident.max_defect_pct || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRtl ? 'الحد الأقصى' : 'Max'}
              </p>
            </div>
          </div>
          
          {incident.worst_sample_id && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-3 text-center">
              {isRtl ? 'أسوأ عينة:' : 'Worst sample:'} <strong>{incident.worst_sample_id}</strong>
            </p>
          )}
        </Card>
        
        {/* Sample Cards Grid */}
        <Card className="p-4">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">
            {isRtl ? 'العينات' : 'Samples'} ({incident.samples_completed}/{incident.samples_required})
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {incident.sample_cards?.map(sample => (
              <div
                key={sample.sample_id}
                className={`p-3 rounded-lg text-center ${
                  sample.is_complete
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                <p className="font-bold">{sample.sample_id}</p>
                <p className={`text-sm ${
                  Number(sample.total_defect_pct || 0) > 5 ? 'text-red-600' : 
                  Number(sample.total_defect_pct || 0) > 2 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {Number(sample.total_defect_pct || 0).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </Card>
        
        {/* Media Gallery */}
        {incident.media && incident.media.length > 0 && (
          <Card className="p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <PhotoIcon className="h-5 w-5" />
              {isRtl ? 'الصور والفيديو' : 'Media'} ({incident.media.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {incident.media.map(media => (
                <div
                  key={media.id}
                  className="aspect-square rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden"
                >
                  {media.media_type === 'photo' ? (
                    <img
                      src={media.file_url || `/api/documents/download/${media.id}`}
                      alt={media.slot}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl">🎥</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {/* Container Conditions */}
        {(incident.container_moisture_seen || incident.container_bad_smell ||
          incident.container_torn_bags || incident.container_condensation) && (
          <Card className="p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">
              {isRtl ? 'حالة الحاوية' : 'Container Condition'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {incident.container_moisture_seen && (
                <Badge color="red">💧 {isRtl ? 'رطوبة' : 'Moisture'}</Badge>
              )}
              {incident.container_bad_smell && (
                <Badge color="red">👃 {isRtl ? 'رائحة' : 'Smell'}</Badge>
              )}
              {incident.container_torn_bags && (
                <Badge color="red">
                  📦 {incident.container_torn_bags_count || 0} {isRtl ? 'ممزق' : 'torn'}
                </Badge>
              )}
              {incident.container_condensation && (
                <Badge color="red">💦 {isRtl ? 'تكثف' : 'Condensation'}</Badge>
              )}
            </div>
          </Card>
        )}
        
        {/* Review Actions Timeline */}
        {incident.review_actions && incident.review_actions.length > 0 && (
          <Card className="p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
              {isRtl ? 'سجل الإجراءات' : 'Action History'}
            </h3>
            <div className="space-y-3">
              {incident.review_actions.map(action => (
                <div key={action.id} className="border-l-2 border-blue-500 pl-3">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {action.action_type.replace('_', ' ')}
                  </p>
                  {action.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{action.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {action.reviewer_name} • {formatDateString(action.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      
      {/* Action Buttons */}
      {incident.status !== 'closed' && (
        <div className="p-4 border-t dark:border-gray-700 grid grid-cols-2 gap-2">
          <button
            onClick={() => onAction('request_resample')}
            className="py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium rounded-lg flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
            {isRtl ? 'إعادة العينات' : 'Resample'}
          </button>
          <button
            onClick={() => onAction('keep_hold')}
            className="py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg flex items-center justify-center gap-2"
          >
            <LockClosedIcon className="h-5 w-5" />
            {isRtl ? 'إبقاء الاحتجاز' : 'Keep HOLD'}
          </button>
          <button
            onClick={() => onAction('clear_hold')}
            className="py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium rounded-lg flex items-center justify-center gap-2"
          >
            <LockOpenIcon className="h-5 w-5" />
            {isRtl ? 'رفع الاحتجاز' : 'Clear HOLD'}
          </button>
          <button
            onClick={() => onAction('close')}
            className="py-3 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-lg flex items-center justify-center gap-2"
          >
            <CheckCircleIcon className="h-5 w-5" />
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function QualityReviewPage() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  
  // State
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [selectedIncident, setSelectedIncident] = useState<QualityIncident | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  
  // Queries
  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['quality-incidents', statusFilter],
    queryFn: () => getQualityIncidents({ 
      status: statusFilter || undefined 
    }),
    staleTime: 30000,
  });
  
  const { data: stats } = useQuery({
    queryKey: ['quality-incidents-stats'],
    queryFn: () => getIncidentStats(),
    staleTime: 60000,
  });
  
  // Mutations
  const reviewMutation = useMutation({
    mutationFn: ({ incidentId, action, notes, targetSamples }: {
      incidentId: string;
      action: ActionType;
      notes: string;
      targetSamples?: string[];
    }) => addReviewAction(incidentId, {
      action_type: action,
      notes,
      target_sample_ids: targetSamples,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['quality-incidents-stats'] });
      setActionModalOpen(false);
      setCurrentAction(null);
    },
  });
  
  // Handlers
  const handleAction = (action: ActionType) => {
    setCurrentAction(action);
    setActionModalOpen(true);
  };
  
  const handleActionSubmit = (notes: string, targetSamples?: string[]) => {
    if (selectedIncident && currentAction) {
      reviewMutation.mutate({
        incidentId: selectedIncident.id,
        action: currentAction,
        notes,
        targetSamples,
      });
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {/* Left Panel - List */}
      <div className={`w-full ${selectedIncident ? 'hidden lg:block lg:w-1/2 xl:w-2/5' : ''} border-r dark:border-gray-700`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-4 py-6">
          <h1 className="text-2xl font-bold mb-1">
            {isRtl ? 'مراجعة الجودة' : 'Quality Review'}
          </h1>
          <p className="text-purple-100 text-sm">
            {isRtl ? 'مراجعة حوادث الجودة واتخاذ الإجراءات' : 'Review incidents and take actions'}
          </p>
          
          {/* Stats */}
          {stats && (
            <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
              <div className="bg-white/20 rounded-lg px-3 py-2 flex-shrink-0">
                <p className="text-xs text-purple-100">{isRtl ? 'مقدم' : 'Submitted'}</p>
                <p className="text-xl font-bold">{stats.submitted}</p>
              </div>
              <div className="bg-white/20 rounded-lg px-3 py-2 flex-shrink-0">
                <p className="text-xs text-purple-100">{isRtl ? 'قيد المراجعة' : 'Under Review'}</p>
                <p className="text-xl font-bold">{stats.under_review}</p>
              </div>
              <div className="bg-white/20 rounded-lg px-3 py-2 flex-shrink-0">
                <p className="text-xs text-purple-100">{isRtl ? 'تم الإجراء' : 'Action Set'}</p>
                <p className="text-xl font-bold">{stats.action_set}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Filters */}
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <div className="flex gap-2 overflow-x-auto">
            {(['', 'submitted', 'under_review', 'action_set', 'closed'] as const).map(status => (
              <button
                key={status || 'all'}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {status === '' ? (isRtl ? 'الكل' : 'All') : 
                  (isRtl ? STATUS_CONFIG[status].labelAr : STATUS_CONFIG[status].label)}
              </button>
            ))}
          </div>
        </div>
        
        {/* List */}
        <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {isLoading && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}
          
          {!isLoading && incidentsData?.incidents.length === 0 && (
            <Card className="p-6 text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {isRtl ? 'لا توجد حوادث' : 'No incidents found'}
              </p>
            </Card>
          )}
          
          {incidentsData?.incidents.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onSelect={setSelectedIncident}
              isRtl={isRtl}
            />
          ))}
        </div>
      </div>
      
      {/* Right Panel - Detail */}
      {selectedIncident && (
        <div className="w-full lg:w-1/2 xl:w-3/5 bg-white dark:bg-gray-800">
          <IncidentDetail
            incident={selectedIncident}
            onAction={handleAction}
            onClose={() => setSelectedIncident(null)}
            isRtl={isRtl}
          />
        </div>
      )}
      
      {/* Action Modal */}
      <ReviewActionModal
        isOpen={actionModalOpen}
        onClose={() => {
          setActionModalOpen(false);
          setCurrentAction(null);
        }}
        incident={selectedIncident}
        actionType={currentAction}
        onSubmit={handleActionSubmit}
        isLoading={reviewMutation.isPending}
        isRtl={isRtl}
      />
    </div>
  );
}

