import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import contractsService from '../../services/contracts';
import { formatNumber, formatCurrency } from '../../utils/format';
import { Button } from '../common/Button';
import { AuditLogViewer } from '../audit/AuditLogViewer';

// Local type definitions to avoid import issues
interface ContractShipmentComparison {
  contract_line_id: string;
  contract_id: string;
  shipment_id: string;
  contract_product_id: string;
  contract_product_name: string;
  contract_qty: number;
  contract_price: number;
  contract_unit: string;
  contract_value: number;
  shipped_qty: number | null;
  actual_price: number | null;
  shipped_unit: string | null;
  shipped_value: number | null;
  qty_variance: number | null;
  price_variance: number | null;
  value_variance: number | null;
  qty_variance_pct: number | null;
  price_variance_pct: number | null;
  value_variance_pct: number | null;
  tolerance: number;
  is_within_tolerance: boolean;
}

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

interface ContractComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  shipmentId: string;
  onProposeUpdate?: () => void;
}

export function ContractComparisonModal({
  isOpen,
  onClose,
  contractId,
  shipmentId,
  onProposeUpdate,
}: ContractComparisonModalProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [comparison, setComparison] = useState<ContractShipmentComparison[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeAuditLog[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isOpen && contractId && shipmentId) {
      fetchComparison();
    }
  }, [isOpen, contractId, shipmentId]);

  const fetchComparison = async () => {
    try {
      setIsLoading(true);
      const data = await contractsService.getContractShipmentComparison(contractId, shipmentId);
      setComparison(data.comparison || []);
      setChangeHistory(data.change_history || []);
    } catch (error) {
      console.error('Error fetching comparison:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (lineId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(lineId)) {
      newExpanded.delete(lineId);
    } else {
      newExpanded.add(lineId);
    }
    setExpandedRows(newExpanded);
  };

  const getVarianceColor = (comparison: ContractShipmentComparison, type: 'qty' | 'price') => {
    const variance = type === 'qty' ? comparison.qty_variance_pct : comparison.price_variance_pct;
    const absVariance = Math.abs(variance ?? 0);

    if (comparison.is_within_tolerance || absVariance < 2) {
      return 'text-green-600 dark:text-green-400';
    } else if (absVariance < 5) {
      return 'text-yellow-600 dark:text-yellow-400';
    } else {
      return 'text-red-600 dark:text-red-400';
    }
  };

  const getRowBackgroundColor = (comparison: ContractShipmentComparison) => {
    if (comparison.is_within_tolerance) {
      return 'bg-white dark:bg-gray-800';
    }
    const maxVariance = Math.max(
      Math.abs(comparison.qty_variance_pct ?? 0),
      Math.abs(comparison.price_variance_pct ?? 0)
    );
    if (maxVariance >= 5) {
      return 'bg-red-50 dark:bg-red-900/10';
    } else if (maxVariance >= 2) {
      return 'bg-yellow-50 dark:bg-yellow-900/10';
    }
    return 'bg-white dark:bg-gray-800';
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('contracts.comparison.title', 'Contract vs Shipment Comparison')}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setShowHistory(false)}
                      className={`${
                        !showHistory
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      {t('contracts.comparison.comparison', 'Comparison')}
                    </button>
                    <button
                      onClick={() => setShowHistory(true)}
                      className={`${
                        showHistory
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      {t('contracts.comparison.history', 'Change History')} ({changeHistory.length})
                    </button>
                  </nav>
                </div>

                {/* Content */}
                <div className="max-h-[600px] overflow-y-auto">
                  {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : showHistory ? (
                    <AuditLogViewer logs={changeHistory} />
                  ) : (
                    <div className="space-y-2">
                      {/* Comparison Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8"></th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('contracts.comparison.product', 'Product')}
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('contracts.comparison.contractQty', 'Contract Qty')}
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('contracts.comparison.shippedQty', 'Shipped Qty')}
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('contracts.comparison.qtyVariance', 'Qty Variance')}
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('contracts.comparison.contractPrice', 'Contract Price')}
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('contracts.comparison.actualPrice', 'Actual Price')}
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('contracts.comparison.priceVariance', 'Price Variance')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {comparison.map((item) => (
                              <Fragment key={item.contract_line_id}>
                                <tr className={getRowBackgroundColor(item)}>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => toggleRow(item.contract_line_id)}
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                      {expandedRows.has(item.contract_line_id) ? (
                                        <ChevronDownIcon className="h-4 w-4" />
                                      ) : (
                                        <ChevronRightIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {item.contract_product_name}
                                    {!item.is_within_tolerance && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                        {t('contracts.comparison.outOfTolerance', 'Out of Tolerance')}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                                    {formatNumber(item.contract_qty)} {item.contract_unit}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                                    {formatNumber(item.shipped_qty)} {item.shipped_unit}
                                  </td>
                                  <td className={`px-4 py-3 text-sm text-right font-medium ${getVarianceColor(item, 'qty')}`}>
                                    {(item.qty_variance ?? 0) >= 0 ? '+' : ''}{formatNumber(item.qty_variance)} 
                                    <span className="text-xs ml-1">({(item.qty_variance_pct ?? 0) >= 0 ? '+' : ''}{item.qty_variance_pct}%)</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                                    {formatCurrency(item.contract_price)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                                    {formatCurrency(item.actual_price)}
                                  </td>
                                  <td className={`px-4 py-3 text-sm text-right font-medium ${getVarianceColor(item, 'price')}`}>
                                    {formatCurrency(item.price_variance)}
                                    <span className="text-xs ml-1">({(item.price_variance_pct ?? 0) >= 0 ? '+' : ''}{item.price_variance_pct}%)</span>
                                  </td>
                                </tr>
                                {expandedRows.has(item.contract_line_id) && (
                                  <tr className="bg-gray-50 dark:bg-gray-800">
                                    <td colSpan={8} className="px-4 py-4">
                                      <div className="text-sm">
                                        <div className="grid grid-cols-3 gap-4">
                                          <div>
                                            <p className="font-medium text-gray-700 dark:text-gray-300">
                                              {t('contracts.comparison.tolerance', 'Tolerance')}:
                                            </p>
                                            <p className="mt-1 text-gray-900 dark:text-gray-100">
                                              {item.tolerance ? `±${item.tolerance}%` : '—'}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="font-medium text-gray-700 dark:text-gray-300">
                                              {t('contracts.comparison.contractValue', 'Contract Value')}:
                                            </p>
                                            <p className="mt-1 text-gray-900 dark:text-gray-100">
                                              {formatCurrency(item.contract_value)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="font-medium text-gray-700 dark:text-gray-300">
                                              {t('contracts.comparison.shippedValue', 'Shipped Value')}:
                                            </p>
                                            <p className="mt-1 text-gray-900 dark:text-gray-100">
                                              {formatCurrency(item.shipped_value)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {comparison.length === 0 && (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                          {t('contracts.comparison.noData', 'No comparison data available')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                  >
                    {t('common.close', 'Close')}
                  </Button>
                  {onProposeUpdate && !showHistory && (
                    <Button
                      variant="primary"
                      onClick={onProposeUpdate}
                    >
                      {t('contracts.comparison.proposeUpdate', 'Propose Contract Update')}
                    </Button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

