import { useTranslation } from 'react-i18next';
import { useComparison } from '../../hooks/useComparison';
import { formatNumber, formatDateString } from '../../utils/format';

interface ComparisonModalProps {
  shipmentIds: string[];
  onClose: () => void;
}

export function ComparisonModal({ shipmentIds, onClose }: ComparisonModalProps) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useComparison(shipmentIds);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <div className="animate-pulse">Loading comparison...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <p className="text-red-600">Failed to load comparison</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-md">
            Close
          </button>
        </div>
      </div>
    );
  }

  const shipments = data.shipments;

  const comparisonFields = [
    { key: 'sn', label: t('shipments.sn', 'S/N') },
    { key: 'product_text', label: t('shipments.product', 'Product') },
    { key: 'pol_name', label: t('shipments.pol', 'Origin') },
    { key: 'pod_name', label: t('shipments.pod', 'Destination') },
    { key: 'shipping_line_name', label: t('shipments.shippingLine', 'Shipping Line') },
    { key: 'eta', label: t('shipments.eta', 'ETA'), format: formatDateString },
    { key: 'container_count', label: t('shipments.containers', 'Containers'), format: (v: any) => v || '—' },
    { key: 'weight_ton', label: t('shipments.weight', 'Weight (ton)'), format: (v: any) => v ? formatNumber(v) : '—' },
    { key: 'total_value_usd', label: t('shipments.totalValue', 'Total Value'), format: (v: any) => v ? `$${formatNumber(v)}` : '—' },
    { key: 'fixed_price_usd_per_ton', label: t('shipments.pricePerTon', 'Price/Ton'), format: (v: any) => v ? `$${formatNumber(v)}` : '—' },
    { key: 'balance_value_usd', label: t('shipments.balance', 'Balance'), format: (v: any) => v ? `$${formatNumber(v)}` : '—' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('shipments.comparison', 'Shipment Comparison')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comparison Table */}
        <div className="overflow-auto flex-1 p-6">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-900">
                  Field
                </th>
                {shipments.map((shipment, idx) => (
                  <th
                    key={shipment.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Shipment {idx + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {comparisonFields.map((field) => (
                <tr key={field.key}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-gray-50 dark:bg-gray-900">
                    {field.label}
                  </td>
                  {shipments.map((shipment) => {
                    const value = (shipment as any)[field.key];
                    const displayValue = field.format ? field.format(value) : value || '—';
                    return (
                      <td
                        key={`${shipment.id}-${field.key}`}
                        className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

