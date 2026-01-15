/**
 * Contracts Page
 * Displays list of contracts with filtering, search, and creation capabilities
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  TrashIcon,
  ArchiveBoxIcon,
  PrinterIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import { useContracts } from '../hooks/useContracts';
import type { ContractFilters } from '../services/contracts';
import contractsService from '../services/contracts';
import { Spinner } from '../components/common/Spinner';
import { TranslatedProductText } from '../components/common/TranslatedProductText';
import { TruncatedText } from '../components/common/TruncatedText';

const ContractsPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';

  // State
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('');
  const [sortBy] = useState<'created_at' | 'signed_at' | 'contract_no'>('created_at');
  const [sortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Build filters
  const filters: ContractFilters = {
    page,
    limit,
    search: searchQuery || undefined,
    status: statusFilter ? (statusFilter as any) : undefined,
    product: productFilter || undefined,
    sortBy,
    sortDir,
  };

  // Fetch data
  const { data, isLoading, error, refetch } = useContracts(filters);

  // Handlers
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on new search
  };

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleProductFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProductFilter(e.target.value);
    setPage(1);
  };

  const handleNewContract = () => {
    navigate('/contracts/new');
  };

  const handleContractClick = (id: string) => {
    navigate(`/contracts/${id}`);
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && data) {
      setSelectedContracts(new Set(data.data.map(c => c.id)));
    } else {
      setSelectedContracts(new Set());
    }
  };

  const handleSelectContract = (id: string, e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContracts(newSelected);
  };

  // Bulk action handlers
  const handleBulkDelete = async () => {
    if (!confirm(t('contracts.confirmDelete', { count: selectedContracts.size }) || `Are you sure you want to delete ${selectedContracts.size} contract(s)?`)) {
      return;
    }
    
    setIsProcessing(true);
    try {
      // Delete each selected contract using the service
      const results = await Promise.allSettled(
        Array.from(selectedContracts).map(id => 
          contractsService.deleteContract(id)
        )
      );
      
      // Check for errors
      const failures = results.filter(r => r.status === 'rejected');
      
      if (failures.length > 0) {
        console.error('Some deletions failed:', failures);
        alert(
          t('contracts.deletePartialError', { 
            success: results.length - failures.length, 
            failed: failures.length 
          }) || 
          `Deleted ${results.length - failures.length} contracts. ${failures.length} failed.`
        );
      } else {
        alert(t('contracts.deleteSuccess') || 'Contracts deleted successfully');
      }
      
      setSelectedContracts(new Set());
      refetch();
    } catch (error) {
      console.error('Error deleting contracts:', error);
      alert(t('contracts.deleteError') || 'Error deleting contracts');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkArchive = async () => {
    if (!confirm(t('contracts.confirmArchive', { count: selectedContracts.size }) || `Are you sure you want to archive ${selectedContracts.size} contract(s)?`)) {
      return;
    }
    
    setIsProcessing(true);
    try {
      // Archive each selected contract by changing status to CANCELLED
      const results = await Promise.allSettled(
        Array.from(selectedContracts).map(id => 
          contractsService.patchContract(id, { status: 'CANCELLED' })
        )
      );
      
      // Check for errors
      const failures = results.filter(r => r.status === 'rejected');
      
      if (failures.length > 0) {
        console.error('Some archives failed:', failures);
        alert(
          t('contracts.archivePartialError', { 
            success: results.length - failures.length, 
            failed: failures.length 
          }) || 
          `Archived ${results.length - failures.length} contracts. ${failures.length} failed.`
        );
      } else {
        alert(t('contracts.archiveSuccess') || 'Contracts archived successfully');
      }
      
      setSelectedContracts(new Set());
      refetch();
    } catch (error) {
      console.error('Error archiving contracts:', error);
      alert(t('contracts.archiveError') || 'Error archiving contracts');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPrint = () => {
    // Open print dialog for selected contracts
    const contractIds = Array.from(selectedContracts).join(',');
    window.open(`/contracts/print?ids=${contractIds}`, '_blank');
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACTIVE: 'bg-green-100 text-green-800',
      FULFILLED: 'bg-emerald-100 text-emerald-800',
      COMPLETED: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };

    const color = statusColors[status] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>
        {t(`contracts.status${status.charAt(0) + status.slice(1).toLowerCase()}`)}
      </span>
    );
  };

  // Render
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading contracts: {error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('contracts.title')}
            </h1>
            {data && (
              <p className="text-sm text-gray-600 mt-1">
                {selectedContracts.size > 0 ? (
                  <>
                    <span className="font-semibold text-blue-600">
                      {selectedContracts.size} {t('common.selected', 'selected')}
                    </span>
                    {' '}{t('common.of', 'of')}{' '}
                  </>
                ) : null}
                {data.pagination.total} {t('contracts.title').toLowerCase()}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {selectedContracts.size > 0 ? (
              <>
                <button
                  onClick={handleBulkPrint}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <PrinterIcon className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('common.print', 'Print')} ({selectedContracts.size})
                </button>
                <button
                  onClick={handleBulkArchive}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <ArchiveBoxIcon className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('common.archive', 'Archive')} ({selectedContracts.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isProcessing}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <TrashIcon className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('common.delete', 'Delete')} ({selectedContracts.size})
                </button>
              </>
            ) : (
              <button
                onClick={handleNewContract}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <PlusIcon className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('contracts.newContract')}
              </button>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder={t('contracts.searchPlaceholder')}
              className={`w-full ${isRTL ? 'pr-10' : 'pl-10'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>

          {/* Product/Goods Type Filter */}
          <div className="sm:w-48 relative">
            <input
              type="text"
              value={productFilter}
              onChange={handleProductFilter}
              placeholder={t('contracts.filterByProduct', 'Filter by product...')}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48 relative">
            <FunnelIcon className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none ${isRTL ? 'right-3' : 'left-3'}`} />
            <select
              value={statusFilter}
              onChange={handleStatusFilter}
              className={`w-full ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white`}
            >
              <option value="">{t('common.allStatuses') || 'All Statuses'}</option>
              <option value="DRAFT">{t('contracts.statusDraft')}</option>
              <option value="ACTIVE">{t('contracts.statusActive')}</option>
              <option value="COMPLETED">{t('contracts.statusCompleted')}</option>
              <option value="CANCELLED">{t('contracts.statusCancelled')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        ) : data && data.data.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={data && selectedContracts.size === data.data.length && data.data.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.contractNo')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.typeOfGoods', 'Type of Goods')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.quantity', 'Quantity (MT)')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.price', 'Price (USD)')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.buyer')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.seller')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.expectedShipmentDate', 'Expected Shipping')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.status')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.fulfillment', 'Fulfillment')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('contracts.linkedShipments', 'Linked Shipments')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.map((contract) => (
                    <tr
                      key={contract.id}
                      onClick={() => handleContractClick(contract.id)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedContracts.has(contract.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedContracts.has(contract.id)}
                          onChange={(e) => handleSelectContract(contract.id, e)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          data-contract-id={contract.id}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <DocumentTextIcon className="w-5 h-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {contract.contract_no}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TruncatedText text={(contract as any).products_summary} className="text-sm text-gray-900" maxWidth="200px">
                          <TranslatedProductText text={(contract as any).products_summary} />
                        </TruncatedText>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {(contract as any).total_quantity_mt 
                            ? Number((contract as any).total_quantity_mt).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                            : '—'}
                        </span>
                        {(contract as any).total_quantity_mt && (
                          <span className="text-xs text-gray-500 ml-1">MT</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-green-700">
                          {(contract as any).total_amount_usd 
                            ? '$' + Number((contract as any).total_amount_usd).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{contract.buyer_name || '—'}</div>
                        {contract.buyer_country && (
                          <div className="text-xs text-gray-500">{contract.buyer_country}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{contract.seller_name || '—'}</div>
                        {contract.seller_country && (
                          <div className="text-xs text-gray-500">{contract.seller_country}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(() => {
                          // If expected shipping date is set, use it
                          if ((contract as any).estimated_shipment_date) {
                            const dateStr = (contract as any).estimated_shipment_date;
                            const [year, month] = dateStr.split('-');
                            const date = new Date(parseInt(year), parseInt(month) - 1);
                            return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { 
                              year: 'numeric', 
                              month: 'short' 
                            });
                          }
                          // Otherwise, calculate default: 1 month from contract creation
                          if (contract.created_at) {
                            const createdDate = new Date(contract.created_at);
                            createdDate.setMonth(createdDate.getMonth() + 1);
                            const defaultDate = createdDate.toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { 
                              year: 'numeric', 
                              month: 'short' 
                            });
                            return (
                              <span className="text-gray-400 italic" title={t('contracts.calculatedDefault', 'Calculated: 1 month from creation')}>
                                {defaultDate}
                              </span>
                            );
                          }
                          return '—';
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(contract.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Fulfillment Progress */}
                        {(() => {
                          const fulfillmentPct = parseFloat((contract as any).fulfillment_percentage) || 0;
                          const totalQty = parseFloat((contract as any).total_quantity_mt) || 0;
                          
                          if (totalQty > 0) {
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      fulfillmentPct >= 100
                                        ? 'bg-emerald-500'
                                        : fulfillmentPct > 0
                                        ? 'bg-amber-500'
                                        : 'bg-gray-300'
                                    }`}
                                    style={{ width: `${Math.min(fulfillmentPct, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${
                                  fulfillmentPct >= 100
                                    ? 'text-emerald-700'
                                    : fulfillmentPct > 0
                                    ? 'text-amber-700'
                                    : 'text-gray-500'
                                }`}>
                                  {fulfillmentPct.toFixed(0)}%
                                </span>
                              </div>
                            );
                          }
                          return <span className="text-xs text-gray-400">—</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {contract.shipment_count && contract.shipment_count > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {contract.linked_shipments && contract.linked_shipments.slice(0, 3).map((shipment: any) => (
                              <button
                                key={shipment.id}
                                onClick={() => navigate(`/shipments/${shipment.id}`)}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors"
                                title={`${shipment.sn} - ${shipment.status || 'N/A'}`}
                              >
                                <TruckIcon className="w-3 h-3 mr-1" />
                                {shipment.sn}
                              </button>
                            ))}
                            {contract.shipment_count > 3 && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600">
                                +{contract.shipment_count - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    {t('common.showing') || 'Showing'}{' '}
                    <span className="font-medium">
                      {(page - 1) * limit + 1}
                    </span>{' '}
                    {t('common.to') || 'to'}{' '}
                    <span className="font-medium">
                      {Math.min(page * limit, data.pagination.total)}
                    </span>{' '}
                    {t('common.of') || 'of'}{' '}
                    <span className="font-medium">{data.pagination.total}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      {t('common.previous') || 'Previous'}
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                      disabled={page === data.pagination.pages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      {t('common.next') || 'Next'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{t('contracts.noContracts')}</p>
            <button
              onClick={handleNewContract}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('contracts.newContract')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractsPage;

