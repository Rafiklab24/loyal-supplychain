/**
 * Beyaname Section Component
 * Handles Turkish customs export declaration (Beyaname) tracking
 * Used in the selling workflow when transaction_type = 'outgoing'
 */

import { useTranslation } from 'react-i18next';
import { 
  DocumentTextIcon, 
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import type { ShipmentFormData } from './types';

interface BeyanameSectionProps {
  formData: ShipmentFormData;
  onChange: (field: keyof ShipmentFormData, value: any) => void;
  errors?: Partial<Record<keyof ShipmentFormData, string>>;
}

export function BeyanameSection({ formData, onChange, errors }: BeyanameSectionProps) {
  const { t } = useTranslation();
  
  const beyanameStatus = formData.beyaname_status;
  
  // Status badge styling
  const getStatusBadge = () => {
    switch (beyanameStatus) {
      case 'issued':
        return {
          icon: CheckCircleIcon,
          bg: 'bg-green-100',
          text: 'text-green-800',
          label: t('selling.beyaname.issued', 'Issued')
        };
      case 'pending':
        return {
          icon: ClockIcon,
          bg: 'bg-amber-100',
          text: 'text-amber-800',
          label: t('selling.beyaname.pending', 'Pending')
        };
      case 'cancelled':
        return {
          icon: XCircleIcon,
          bg: 'bg-red-100',
          text: 'text-red-800',
          label: t('selling.beyaname.cancelled', 'Cancelled')
        };
      default:
        return null;
    }
  };
  
  const statusBadge = getStatusBadge();

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-purple-600" />
          <h4 className="text-sm font-semibold text-purple-900">
            {t('selling.beyaname.title', 'Beyaname (Customs Export Declaration)')}
          </h4>
        </div>
        {statusBadge && (
          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
            <statusBadge.icon className="h-3.5 w-3.5" />
            {statusBadge.label}
          </span>
        )}
      </div>
      
      {/* Info Box */}
      <div className="flex items-start gap-2 p-3 bg-purple-100 rounded-lg mb-4">
        <InformationCircleIcon className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-purple-800">
          {t('selling.beyaname.info', 'The Beyaname is issued by the customs agent (Ragib) based on the original import records. This document is required for all export sales from Turkey.')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Beyaname Number */}
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('selling.beyaname.number', 'Beyaname Number')}
          </label>
          <input
            type="text"
            value={formData.beyaname_number || ''}
            onChange={(e) => onChange('beyaname_number', e.target.value)}
            placeholder={t('selling.beyaname.numberPlaceholder', 'e.g., 26TE0000012345')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
          />
          {errors?.beyaname_number && (
            <p className="mt-1 text-sm text-red-600">{errors.beyaname_number}</p>
          )}
        </div>

        {/* Beyaname Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('selling.beyaname.date', 'Issue Date')}
          </label>
          <input
            type="date"
            value={formData.beyaname_date || ''}
            onChange={(e) => onChange('beyaname_date', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Beyaname Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('selling.beyaname.status', 'Status')}
          </label>
          <select
            value={formData.beyaname_status || ''}
            onChange={(e) => onChange('beyaname_status', e.target.value || undefined)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">{t('common.select', 'Select...')}</option>
            <option value="pending">{t('selling.beyaname.pending', 'Pending')}</option>
            <option value="issued">{t('selling.beyaname.issued', 'Issued')}</option>
            <option value="cancelled">{t('selling.beyaname.cancelled', 'Cancelled')}</option>
          </select>
        </div>
      </div>

      {/* Source Import Reference */}
      {formData.source_imports && formData.source_imports.length > 0 && (
        <div className="mt-4 p-3 bg-white border border-purple-200 rounded-lg">
          <label className="block text-xs font-medium text-purple-800 mb-2">
            {t('selling.beyaname.sourceReference', 'Linked to Original Import(s)')}:
          </label>
          <div className="flex flex-wrap gap-2">
            {formData.source_imports.map((link, index) => (
              <span 
                key={index}
                className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-mono"
              >
                {link.source_ci_number || link.source_shipment_id}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t('selling.beyaname.sourceNote', 'The customs agent will use these original import records to issue the Beyaname.')}
          </p>
        </div>
      )}

      {/* Workflow Status Note */}
      {beyanameStatus === 'issued' && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              {t('selling.beyaname.issuedNote', 'Beyaname has been issued. You can proceed with loading and shipping.')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

