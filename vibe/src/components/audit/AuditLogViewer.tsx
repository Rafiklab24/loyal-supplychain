import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { ClockIcon, UserIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatDateTime } from '../../utils/format';
import { apiClient } from '../../services/api';

// Local type definition to avoid import issues
interface ChangeAuditLog {
  id: string;
  entity_type: 'contract' | 'contract_line' | 'shipment' | 'shipment_line';
  entity_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: 'created' | 'updated' | 'split' | 'deleted';
  source_type: 'manual' | 'contract_import' | 'sync' | 'system';
  changed_by: string;
  changed_at: string;
  notes?: string | null;
  related_contract_id?: string | null;
  related_shipment_id?: string | null;
  contract_no?: string;
  shipment_sn?: string;
  contract_product_name?: string;
  shipment_product_name?: string;
  product_name?: string;
}

// Props for inline usage (passing logs directly)
interface InlineAuditLogViewerProps {
  logs: ChangeAuditLog[];
  isLoading?: boolean;
  title?: string;
}

// Props for modal usage (fetching logs by entity)
interface ModalAuditLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'contract' | 'shipment';
  entityId: string;
}

export type AuditLogViewerProps = InlineAuditLogViewerProps | ModalAuditLogViewerProps;

// Type guard to check if props are for modal mode
function isModalProps(props: AuditLogViewerProps): props is ModalAuditLogViewerProps {
  return 'isOpen' in props && 'onClose' in props && 'entityType' in props && 'entityId' in props;
}

// Inner component for rendering the log list
function AuditLogContent({ logs, isLoading, title }: InlineAuditLogViewerProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState({
    field: 'all',
    changeType: 'all',
    sourceType: 'all',
  });

  // Ensure logs is an array before filtering
  const safeLogs = Array.isArray(logs) ? logs : [];

  const filteredLogs = safeLogs.filter(log => {
    if (filter.field !== 'all' && log.field_name !== filter.field) return false;
    if (filter.changeType !== 'all' && log.change_type !== filter.changeType) return false;
    if (filter.sourceType !== 'all' && log.source_type !== filter.sourceType) return false;
    return true;
  });

  // Get unique values for filters
  const uniqueFields = Array.from(new Set(safeLogs.map(l => l.field_name)));
  const uniqueChangeTypes = Array.from(new Set(safeLogs.map(l => l.change_type)));
  const uniqueSourceTypes = Array.from(new Set(safeLogs.map(l => l.source_type)));

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'updated':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'split':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'deleted':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getSourceTypeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'manual':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'contract_import':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300';
      case 'sync':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'system':
        return 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {title || t('audit.changeHistory', 'Change History')}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filteredLogs.length} {t('audit.changes', 'changes')}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filter.field}
          onChange={(e) => setFilter(prev => ({ ...prev, field: e.target.value }))}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">{t('audit.allFields', 'All Fields')}</option>
          {uniqueFields.map(field => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>

        <select
          value={filter.changeType}
          onChange={(e) => setFilter(prev => ({ ...prev, changeType: e.target.value }))}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">{t('audit.allTypes', 'All Types')}</option>
          {uniqueChangeTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <select
          value={filter.sourceType}
          onChange={(e) => setFilter(prev => ({ ...prev, sourceType: e.target.value }))}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">{t('audit.allSources', 'All Sources')}</option>
          {uniqueSourceTypes.map(source => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      <div className="flow-root max-h-96 overflow-y-auto">
        <ul className="-mb-8">
          {filteredLogs.map((log, idx) => (
            <li key={log.id}>
              <div className="relative pb-8">
                {idx !== filteredLogs.length - 1 && (
                  <span
                    className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  {/* Icon */}
                  <div>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-900 ${getChangeTypeColor(log.change_type)}`}>
                      {log.change_type === 'created' && <DocumentTextIcon className="h-5 w-5" />}
                      {log.change_type === 'updated' && <ClockIcon className="h-5 w-5" />}
                      {log.change_type === 'split' && <DocumentTextIcon className="h-5 w-5" />}
                      {log.change_type === 'deleted' && <DocumentTextIcon className="h-5 w-5" />}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {log.field_name}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getChangeTypeColor(log.change_type)}`}>
                          {log.change_type}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSourceTypeColor(log.source_type)}`}>
                          {log.source_type}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <ClockIcon className="h-4 w-4" />
                        <time dateTime={log.changed_at}>
                          {formatDateTime(log.changed_at)}
                        </time>
                        <UserIcon className="h-4 w-4 ml-2" />
                        <span>{log.changed_by}</span>
                      </div>
                    </div>

                    {/* Value changes */}
                    <div className="mt-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md p-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t('audit.oldValue', 'Old Value')}
                          </p>
                          <p className="mt-1 text-gray-900 dark:text-gray-100 font-mono">
                            {log.old_value || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t('audit.newValue', 'New Value')}
                          </p>
                          <p className="mt-1 text-gray-900 dark:text-gray-100 font-mono">
                            {log.new_value || '—'}
                          </p>
                        </div>
                      </div>
                      {log.notes && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{t('audit.notes', 'Notes')}: </span>
                            {log.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {filteredLogs.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {t('audit.noChanges', 'No changes found')}
        </div>
      )}
    </div>
  );
}

// Modal wrapper component
function AuditLogModal({ isOpen, onClose, entityType, entityId }: ModalAuditLogViewerProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ChangeAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entityId) {
      fetchLogs();
    }
  }, [isOpen, entityId, entityType]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const endpoint = entityType === 'contract' 
        ? `/contracts/${entityId}/audit-log`
        : `/shipments/${entityId}/audit-log`;
      const response = await apiClient.get(endpoint);
      setLogs(response.data?.logs || response.data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                    {t('audit.changeHistory', 'Change History')} - {entityType === 'contract' ? t('contracts.contract', 'Contract') : t('shipments.shipment', 'Shipment')}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <AuditLogContent logs={logs} isLoading={isLoading} />

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Main export - decides which component to render based on props
export function AuditLogViewer(props: AuditLogViewerProps) {
  if (isModalProps(props)) {
    return <AuditLogModal {...props} />;
  }
  return <AuditLogContent {...props} />;
}
