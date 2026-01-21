/**
 * Elleçleme History Panel Component
 * Shows handling history for a shipment
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { 
  ArrowPathIcon, 
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../common/Card';
import { Spinner } from '../common/Spinner';
import { Badge } from '../common/Badge';
import { useShipmentElleclemeHistory } from '../../hooks/useEllecleme';
import { getStatusColor, type ElleclemeStatus } from '../../services/ellecleme';
import { formatDateString, formatCurrency } from '../../utils/format';

interface ElleclemeHistoryPanelProps {
  shipmentId: string;
  shipmentSn?: string;
}

export default function ElleclemeHistoryPanel({ shipmentId, shipmentSn }: ElleclemeHistoryPanelProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { data: history, isLoading, error } = useShipmentElleclemeHistory(shipmentId);

  const getStatusIcon = (status: ElleclemeStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
      case 'pending_confirmation':
        return <ClockIcon className="h-5 w-5 text-purple-500" />;
      case 'in_progress':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'rejected':
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-amber-500" />;
    }
  };

  const getActivityName = (item: any) => {
    if (i18n.language === 'ar' && item.activity_name_ar) return item.activity_name_ar;
    if (i18n.language === 'tr' && item.activity_name_tr) return item.activity_name_tr;
    return item.activity_name || `Activity ${item.activity_code}`;
  };

  if (isLoading) {
    return (
      <Card>
        <div className="p-6 flex items-center justify-center">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return null; // Silently fail if no access
  }

  if (!history || history.length === 0) {
    return null; // Don't show section if no history
  }

  return (
    <Card>
      <div className={`p-4 border-b border-slate-200 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <ArrowPathIcon className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">
            {t('ellecleme.history.title', 'Elleçleme History')}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {history.length}
          </Badge>
        </div>
        <Link
          to="/ellecleme"
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          {t('ellecleme.history.viewAll', 'View All')}
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="divide-y divide-slate-100">
        {history.map((item: any) => (
          <div key={item.id} className={`p-4 hover:bg-slate-50 transition-colors ${isRtl ? 'text-right' : ''}`}>
            <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              {/* Status Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(item.status)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Link 
                    to={`/ellecleme/requests/${item.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {item.request_number}
                  </Link>
                  <span className={`text-sm px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}>
                    {t(`ellecleme.statuses.${item.status}`, item.status)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {item.activity_code}
                  </span>
                </div>

                <p className="text-sm text-slate-700 mt-1">
                  {getActivityName(item)}
                </p>

                {/* Before / After */}
                {item.status === 'completed' && (item.before_description || item.after_description) && (
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs">
                    <p className="font-medium text-slate-600 mb-1">
                      {t('ellecleme.history.beforeAfter', 'Before / After')}:
                    </p>
                    {item.before_description && (
                      <p className="text-slate-500">
                        <span className="text-red-500">−</span> {item.before_description}
                      </p>
                    )}
                    {item.after_description && (
                      <p className="text-slate-500">
                        <span className="text-green-500">+</span> {item.after_description}
                      </p>
                    )}
                  </div>
                )}

                {/* GTİP Change */}
                {item.gtip_changed && item.new_gtip && (
                  <div className={`mt-2 flex items-center gap-2 text-xs ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="text-slate-500">{t('ellecleme.gtip.changed', 'GTİP Changed')}:</span>
                    <span className="line-through text-red-500">{item.original_gtip}</span>
                    <span>→</span>
                    <span className="font-medium text-green-600">{item.new_gtip}</span>
                  </div>
                )}

                {/* Result Rejected Warning */}
                {item.result_rejected && (
                  <div className={`mt-2 flex items-center gap-2 text-xs text-amber-600 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    <span>{t('ellecleme.workflow.resultRejected', 'Result was rejected')}</span>
                    {item.result_rejection_reason && (
                      <span className="text-slate-500">: {item.result_rejection_reason}</span>
                    )}
                  </div>
                )}

                {/* Meta Information */}
                <div className={`mt-2 flex items-center gap-4 text-xs text-slate-500 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {item.quantity_mt && (
                    <span>{item.quantity_mt} MT</span>
                  )}
                  {item.requested_date && (
                    <span>{formatDateString(item.requested_date)}</span>
                  )}
                  {item.requested_by_name && (
                    <span>
                      {t('ellecleme.workflow.requestedBy', 'Requested by')}: {item.requested_by_name}
                    </span>
                  )}
                  {item.status === 'completed' && item.confirmed_at && (
                    <span className="text-emerald-600">
                      {t('ellecleme.history.changeApplied', 'Change Applied')}: {formatDateString(item.confirmed_at)}
                    </span>
                  )}
                  {item.total_cost > 0 && (
                    <span>
                      {formatCurrency(item.total_cost, item.cost_currency || 'TRY')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
