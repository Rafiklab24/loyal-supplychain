/**
 * Elleçleme Tutanak (Handling Protocol)
 * Display and print the handling protocol for a completed request
 */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@headlessui/react';
import {
  XMarkIcon,
  PrinterIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useElleçlemeTutanak } from '../../hooks/useEllecleme';
import type { TutanakData } from '../../services/ellecleme';

interface ElleçlemeTutanakProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
}

export default function ElleçlemeTutanak({
  isOpen,
  onClose,
  requestId,
}: ElleçlemeTutanakProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const lang = i18n.language;
  const printRef = useRef<HTMLDivElement>(null);

  const { data: tutanak, isLoading, error } = useElleçlemeTutanak(requestId, isOpen);

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Elleçleme Tutanağı - ${tutanak?.request_number}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { font-size: 24px; text-align: center; margin-bottom: 20px; }
                h2 { font-size: 18px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                .header { text-align: center; margin-bottom: 30px; }
                .section { margin-bottom: 20px; }
                .row { display: flex; margin-bottom: 8px; }
                .label { width: 200px; color: #666; }
                .value { flex: 1; font-weight: 500; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
                .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB');
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '-';
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

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`mx-auto max-w-3xl w-full bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col ${isRtl ? 'rtl' : 'ltr'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-slate-800">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
              </div>
              {t('ellecleme.document.types.tutanak', 'Elleçleme Tutanağı')}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                disabled={!tutanak}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
              >
                <PrinterIcon className="h-4 w-4" />
                {t('common.print', 'Print')}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">
                {t('common.error', 'Error loading data')}
              </div>
            ) : tutanak ? (
              <div ref={printRef}>
                {/* Header */}
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-slate-800">
                    Elleçleme Tutanağı
                  </h1>
                  <p className="text-lg text-slate-600">
                    (Handling Protocol / محضر المناولة)
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    {tutanak.request_number}
                  </p>
                </div>

                {/* Activity Info */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                    {t('ellecleme.activityType', 'Activity Information')}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('ellecleme.activityCode', 'Code')}:</span>
                      <span className="font-mono font-bold text-blue-600">{tutanak.activity_code}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('ellecleme.activityType', 'Type')}:</span>
                      <span className="font-medium">{tutanak.activity_name_tr || tutanak.activity_name}</span>
                    </div>
                  </div>
                </div>

                {/* Product/Inventory Info */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                    {t('antrepo.inventory', 'Inventory Information')}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('antrepo.lot', 'Lot')}:</span>
                      <span className="font-mono font-medium">{tutanak.lot_code}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('shipments.sn', 'Shipment')}:</span>
                      <span>{tutanak.shipment_sn || '-'}</span>
                    </div>
                    <div className="flex col-span-2">
                      <span className="w-32 text-slate-500">{t('common.product', 'Product')}:</span>
                      <span>{tutanak.product_text || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('common.supplier', 'Supplier')}:</span>
                      <span>{tutanak.supplier_name || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('common.origin', 'Origin')}:</span>
                      <span>{tutanak.origin_country || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Quantity */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                    {t('ellecleme.quantityAffected', 'Quantity Affected')}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('common.weight', 'Weight')}:</span>
                      <span className="font-semibold">{formatNumber(tutanak.quantity_mt)} MT</span>
                    </div>
                    {tutanak.quantity_bags && (
                      <div className="flex">
                        <span className="w-32 text-slate-500">{t('antrepo.bags', 'Bags')}:</span>
                        <span>{formatNumber(tutanak.quantity_bags)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* GTİP */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                    GTİP (HS Code)
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('ellecleme.gtip.original', 'Original')}:</span>
                      <span className="font-mono">{tutanak.original_gtip || '-'}</span>
                    </div>
                    {tutanak.gtip_changed && (
                      <div className="flex">
                        <span className="w-32 text-slate-500">{t('ellecleme.gtip.new', 'New')}:</span>
                        <span className="font-mono font-bold text-amber-600">{tutanak.new_gtip}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                    {t('common.dates', 'Dates')}
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex">
                      <span className="w-28 text-slate-500">{t('ellecleme.startDate', 'Requested')}:</span>
                      <span>{formatDate(tutanak.requested_date)}</span>
                    </div>
                    <div className="flex">
                      <span className="w-28 text-slate-500">{t('ellecleme.startDate', 'Started')}:</span>
                      <span>{formatDate(tutanak.actual_start_date)}</span>
                    </div>
                    <div className="flex">
                      <span className="w-28 text-slate-500">{t('ellecleme.completionDate', 'Completed')}:</span>
                      <span className="font-semibold text-emerald-600">{formatDate(tutanak.actual_completion_date)}</span>
                    </div>
                  </div>
                </div>

                {/* Execution Details */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                    {t('ellecleme.execution.title', 'Execution Details')}
                  </h2>
                  {tutanak.before_description && (
                    <div className="mb-4">
                      <p className="text-sm text-slate-500 mb-1">{t('ellecleme.execution.beforeDescription', 'State Before')}:</p>
                      <p className="p-3 bg-slate-50 rounded-lg text-slate-700">{tutanak.before_description}</p>
                    </div>
                  )}
                  {tutanak.after_description && (
                    <div className="mb-4">
                      <p className="text-sm text-slate-500 mb-1">{t('ellecleme.execution.afterDescription', 'State After')}:</p>
                      <p className="p-3 bg-emerald-50 rounded-lg text-emerald-800">{tutanak.after_description}</p>
                    </div>
                  )}
                  {tutanak.executed_by_name && (
                    <div className="flex">
                      <span className="w-32 text-slate-500">{t('ellecleme.execution.executedBy', 'Executed By')}:</span>
                      <span className="font-medium">{tutanak.executed_by_name}</span>
                    </div>
                  )}
                </div>

                {/* Permit */}
                {tutanak.permit && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                      {t('ellecleme.permit.title', 'Permit')}
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex">
                        <span className="w-32 text-slate-500">{t('ellecleme.permit.approvalRef', 'Reference')}:</span>
                        <span className="font-mono">{tutanak.permit.approval_ref}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 text-slate-500">{t('ellecleme.permit.approvalDate', 'Approved')}:</span>
                        <span>{formatDate(tutanak.permit.approval_date)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Costs */}
                {tutanak.costs && tutanak.costs.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
                      {t('ellecleme.costs', 'Costs')}
                    </h2>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border border-slate-200 px-3 py-2 text-left text-sm">
                            {t('ellecleme.cost.type', 'Type')}
                          </th>
                          <th className="border border-slate-200 px-3 py-2 text-right text-sm">
                            {t('ellecleme.cost.amount', 'Amount')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tutanak.costs.map((cost, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-200 px-3 py-2">
                              {t(`ellecleme.cost.types.${cost.cost_type}`, cost.cost_type)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-right font-mono">
                              {formatCurrency(cost.total, cost.currency)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="border border-slate-200 px-3 py-2">
                            {t('ellecleme.cost.totalCost', 'Total')}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right font-mono">
                            {formatCurrency(tutanak.total_cost)}
                          </td>
                        </tr>
                        {tutanak.customs_value_cost > 0 && (
                          <tr className="bg-amber-50">
                            <td className="border border-slate-200 px-3 py-2 text-amber-800">
                              {t('ellecleme.cost.customsValueCost', 'Customs Value Cost')}
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-right font-mono text-amber-800">
                              {formatCurrency(tutanak.customs_value_cost)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
                  <p>
                    {t('ellecleme.tutanak.generated', 'Document generated on')}:{' '}
                    {new Date(tutanak.generated_at).toLocaleString('en-GB')}
                  </p>
                  <p className="mt-1">
                    Loyal International Supply Chain Management System
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
