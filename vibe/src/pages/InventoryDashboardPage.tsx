/**
 * Inventory Dashboard Page
 * Desktop-first table interface for Final Beneficiary (Branch) users
 * 
 * Features:
 * - List shipments headed to user's branch in table format
 * - Show purchase price vs total landed cost
 * - Mark as delivered with quality check modal
 * - Launch Quality Incident Wizard if issues found
 */

import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import {
  TruckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  ExclamationCircleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowsUpDownIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { Pagination } from '../components/common/Pagination';
import { formatDateString, formatCurrency, formatNumber } from '../utils/format';
import { TranslatedProductText } from '../components/common/TranslatedProductText';
import { DemurrageInlineBadge } from '../components/shipments/DemurrageStatusBadge';
import { getInventoryShipments, markShipmentDelivered, getMyBranches } from '../services/inventory';
import { useBranches } from '../hooks/useBranches';
import { getFinalDestinationDisplay } from '../hooks/useFinalDestination';
import type { InventoryShipment, SortOption } from '../services/inventory';
import { BuildingOffice2Icon, ChevronDownIcon as ChevronDownIconSolid } from '@heroicons/react/24/solid';

// ============================================================
// DELIVERY CONFIRMATION MODAL
// ============================================================

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: InventoryShipment | null;
  onConfirm: (hasIssues: boolean) => void;
  isLoading: boolean;
}

function DeliveryConfirmationModal({ isOpen, onClose, shipment, onConfirm, isLoading }: DeliveryModalProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  if (!shipment) return null;
  
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center gap-3">
                    <TruckIcon className="h-7 w-7" />
                    {isRtl ? 'تأكيد الاستلام' : 'Confirm Delivery'}
                  </Dialog.Title>
                  <p className="text-emerald-100 mt-1 text-sm">
                    {shipment.sn} - <TranslatedProductText text={shipment.product_text} className="inline" />
                  </p>
                </div>
                
                {/* Content */}
                <div className="p-6">
                  <div className="text-center mb-8">
                    <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
                      {isRtl ? 'هل توجد مشاكل في جودة البضاعة؟' : 'Any quality issues with this shipment?'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {isRtl 
                        ? 'في حال وجود مشاكل، سيتم تفعيل نظام التقييم'
                        : 'If issues exist, the quality incident system will be activated'}
                    </p>
                  </div>
                  
                  {/* Big Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* No Issues - Green */}
                    <button
                      onClick={() => onConfirm(false)}
                      disabled={isLoading}
                      className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 border-2 border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      <HandThumbUpIcon className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mb-3" />
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        {isRtl ? 'لا توجد مشاكل' : 'No Issues'}
                      </span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        {isRtl ? 'البضاعة سليمة' : 'Goods are fine'}
                      </span>
                    </button>
                    
                    {/* Has Issues - Amber */}
                    <button
                      onClick={() => onConfirm(true)}
                      disabled={isLoading}
                      className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-300 dark:border-amber-700 hover:border-amber-500 hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      <HandThumbDownIcon className="h-12 w-12 text-amber-600 dark:text-amber-400 mb-3" />
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                        {isRtl ? 'توجد مشاكل' : 'Has Issues'}
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {isRtl ? 'سجل المشكلة' : 'Report problem'}
                      </span>
                    </button>
                  </div>
                  
                  {isLoading && (
                    <div className="flex justify-center mt-6">
                      <Spinner />
                    </div>
                  )}
                </div>
                
                {/* Cancel Button */}
                <div className="px-6 pb-6">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="w-full py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
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

// ============================================================
// SORT COLUMN TYPE
// ============================================================

type SortColumn = 'sn' | 'product_text' | 'eta' | 'weight_ton' | 'total_value_usd' | 'status' | 'created_at';

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function InventoryDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Fetch branches for resolving branch names from IDs
  const { data: branchesData } = useBranches();
  
  // State
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveredFilter, setDeliveredFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortColumn>('eta');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedShipment, setSelectedShipment] = useState<InventoryShipment | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  
  // Fetch user's accessible branches for warehouse filtering
  const { data: myBranchesData } = useQuery({
    queryKey: ['my-branches'],
    queryFn: getMyBranches,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Convert to API sort format
  const getApiSort = (): SortOption => {
    if (sortBy === 'eta') return sortDir === 'asc' ? 'eta_asc' : 'eta_desc';
    if (sortBy === 'weight_ton') return sortDir === 'asc' ? 'weight_asc' : 'weight_desc';
    if (sortBy === 'total_value_usd') return sortDir === 'asc' ? 'price_asc' : 'price_desc';
    if (sortBy === 'created_at') return sortDir === 'asc' ? 'oldest' : 'newest';
    return 'eta_asc';
  };
  
  // Queries
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-shipments', searchQuery, deliveredFilter, sortBy, sortDir, page, selectedBranchId],
    queryFn: () => getInventoryShipments({
      search: searchQuery || undefined,
      delivered: deliveredFilter === '' ? undefined : deliveredFilter === 'true',
      sort: getApiSort(),
      branch_id: selectedBranchId || undefined,
    }),
    staleTime: 30000,
  });
  
  // Mutations - Only used for NO ISSUES case
  const deliveryMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => 
      markShipmentDelivered(id, false), // Always false - no issues
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-shipments'] });
      setIsDeliveryModalOpen(false);
      setSelectedShipment(null);
    },
  });
  
  // Handlers
  const handleMarkDelivered = (shipment: InventoryShipment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedShipment(shipment);
    setIsDeliveryModalOpen(true);
  };
  
  const handleDeliveryConfirm = (hasIssues: boolean) => {
    if (!selectedShipment) return;
    
    if (hasIssues) {
      // HAS ISSUES: Don't mark delivered yet - go to wizard first
      setIsDeliveryModalOpen(false);
      navigate(`/quality-incident/new?shipment_id=${selectedShipment.id}`);
    } else {
      // NO ISSUES: Mark delivered immediately
      deliveryMutation.mutate({ id: selectedShipment.id });
    }
  };
  
  const handleContinueIncident = (incidentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/quality-incident/${incidentId}`);
  };
  
  const handleViewIncident = (incidentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/quality-incident/${incidentId}`);
  };
  
  const handleRowClick = (shipmentId: string) => {
    navigate(`/shipments/${shipmentId}`);
  };
  
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };
  
  // Sort icon component
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) {
      return <ArrowsUpDownIcon className="w-4 h-4 opacity-30" />;
    }
    return sortDir === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 text-emerald-600" /> : 
      <ChevronDownIcon className="w-4 h-4 text-emerald-600" />;
  };
  
  // Get destination display name
  const getDestinationName = (shipment: InventoryShipment) => {
    const destInfo = getFinalDestinationDisplay(shipment.final_destination as any, branchesData?.branches, isRtl);
    if (destInfo.displayText) return destInfo.displayText;
    return isRtl ? 'غير محدد' : 'Not specified';
  };
  
  // Stats
  const stats = {
    total: data?.total || 0,
    pending: data?.shipments.filter(s => !s.delivery_confirmed_at).length || 0,
    delivered: data?.shipments.filter(s => !!s.delivery_confirmed_at).length || 0,
    onHold: data?.shipments.filter(s => s.hold_status).length || 0,
  };
  
  // Status categories for quick filtering
  const statusCategories = [
    { value: '', label: isRtl ? 'الكل' : 'All', count: stats.total },
    { value: 'false', label: isRtl ? 'بانتظار الاستلام' : 'Pending', count: stats.pending },
    { value: 'true', label: isRtl ? 'تم الاستلام' : 'Delivered', count: stats.delivered },
  ];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isRtl ? 'المستودع' : 'Inventory'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isRtl ? 'البضاعة الواردة لفرعك' : 'Inbound shipments for your branch'}
            {data && ` - ${formatNumber(data.total)} ${isRtl ? 'شحنة' : 'shipments'}`}
          </p>
        </div>
        
        {/* Stats Cards */}
        <div className="flex gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
            <p className="text-xs text-emerald-600">{isRtl ? 'الإجمالي' : 'Total'}</p>
            <p className="text-xl font-bold text-emerald-700">{stats.total}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-xs text-blue-600">{isRtl ? 'بانتظار' : 'Pending'}</p>
            <p className="text-xl font-bold text-blue-700">{stats.pending}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="text-xs text-green-600">{isRtl ? 'تم الاستلام' : 'Delivered'}</p>
            <p className="text-xl font-bold text-green-700">{stats.delivered}</p>
          </div>
          {stats.onHold > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <p className="text-xs text-red-600">{isRtl ? 'محتجز' : 'On Hold'}</p>
              <p className="text-xl font-bold text-red-700">{stats.onHold}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {statusCategories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setDeliveredFilter(cat.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                deliveredFilter === cat.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        
        {/* Branch/Warehouse Filter - Only show for global access users */}
        {myBranchesData?.has_global_access && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-px bg-gray-300" /> {/* Separator */}
            <div className="relative">
              <BuildingOffice2Icon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setPage(1);
                }}
                className="appearance-none ps-9 pe-8 py-2 pr-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer min-w-[180px]"
              >
                <option value="">{isRtl ? 'جميع الفروع' : 'All Branches'}</option>
                {myBranchesData.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {isRtl ? branch.name_ar || branch.name : branch.name}
                    {branch.city && ` (${branch.city})`}
                  </option>
                ))}
              </select>
              <ChevronDownIconSolid className="absolute end-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}
        
        {/* Show current branch badge for non-global users with single branch */}
        {!myBranchesData?.has_global_access && myBranchesData?.branches.length === 1 && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-px bg-gray-300" /> {/* Separator */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200">
              <BuildingOffice2Icon className="w-4 h-4" />
              {isRtl ? myBranchesData.branches[0].name_ar || myBranchesData.branches[0].name : myBranchesData.branches[0].name}
            </span>
          </div>
        )}
      </div>
      
      {/* Search */}
      <Card>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={isRtl ? 'بحث في الشحنات...' : 'Search shipments...'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full ps-10 pe-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </Card>
      
      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-600">{isRtl ? 'حدث خطأ في تحميل البيانات' : 'Error loading shipments'}</p>
          </div>
        ) : !data?.shipments.length ? (
          <div className="text-center py-12">
            <CubeIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">{isRtl ? 'لا توجد شحنات' : 'No shipments found'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleSort('sn')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        {t('shipments.sn', 'Shipment ID')}
                        <SortIcon column="sn" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {t('shipments.linkedContract', 'Contract')}
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        {t('shipments.status', 'Status')}
                        <SortIcon column="status" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('product_text')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        {t('shipments.product', 'Product')}
                        <SortIcon column="product_text" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('weight_ton')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        {t('shipments.weight', 'Weight')}
                        <SortIcon column="weight_ton" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {t('shipments.pricePerTon', 'Price/Ton')}
                    </th>
                    <th
                      onClick={() => handleSort('total_value_usd')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        {t('shipments.totalValue', 'Total Amount')}
                        <SortIcon column="total_value_usd" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {t('shipments.origin', 'POL')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {t('shipments.destination', 'POD')}
                    </th>
                    <th
                      onClick={() => handleSort('eta')}
                      className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-2">
                        {t('shipments.eta', 'ETA')}
                        <SortIcon column="eta" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {t('shipments.customsClearanceDate', 'Clearance Date')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {t('shipments.demurrageStatus', 'Delay Status')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {isRtl ? 'الإجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.shipments.map((shipment) => {
                    const isDelivered = !!shipment.delivery_confirmed_at;
                    const hasDraftIncident = shipment.latest_incident?.status === 'draft';
                    const hasSubmittedIncident = shipment.latest_incident && shipment.latest_incident.status !== 'draft';
                    
                    return (
                      <tr
                        key={shipment.id}
                        onClick={() => handleRowClick(shipment.id)}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          shipment.hold_status ? 'bg-red-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {shipment.hold_status && (
                              <ExclamationCircleIcon className="h-5 w-5 text-red-600" title={isRtl ? 'محتجز' : 'On Hold'} />
                            )}
                            <span className="text-sm font-medium text-emerald-600">
                              {shipment.sn || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {shipment.contract_id ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/contracts/${shipment.contract_id}`);
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {shipment.contract_no || (isRtl ? 'عرض العقد' : 'View')}
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <Badge color={shipment.hold_status ? 'red' : (isDelivered ? 'green' : 'blue')}>
                              {isDelivered 
                                ? (isRtl ? 'تم الاستلام' : 'Delivered')
                                : (shipment.status || 'Unknown')}
                            </Badge>
                            {shipment.quality_incident_count > 0 && (
                              <Badge color="amber" className="text-xs">
                                {shipment.quality_incident_count} {isRtl ? 'حوادث' : 'incidents'}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                          <TranslatedProductText text={shipment.product_text} fallback="—" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
                          {shipment.weight_ton ? `${formatNumber(shipment.weight_ton)} ${isRtl ? 'طن' : 'tons'}` : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-end">
                          {shipment.costs?.purchase_price && shipment.weight_ton 
                            ? formatCurrency(shipment.costs.purchase_price / shipment.weight_ton) 
                            : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-end">
                          {shipment.costs?.purchase_price ? formatCurrency(shipment.costs.purchase_price) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {shipment.pol_name || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {shipment.pod_name || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {shipment.eta ? formatDateString(shipment.eta as unknown as string) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {shipment.customs_clearance_date ? formatDateString(shipment.customs_clearance_date as unknown as string) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <DemurrageInlineBadge
                            eta={shipment.eta as unknown as string}
                            freeTimeDays={shipment.free_time_days}
                            customsClearanceDate={shipment.customs_clearance_date as unknown as string}
                            status={shipment.status}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* Draft Incident - Continue Button */}
                            {hasDraftIncident && shipment.latest_incident && (
                              <button
                                onClick={(e) => handleContinueIncident(shipment.latest_incident!.id, e)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                                {isRtl ? 'استكمال' : 'Continue'}
                              </button>
                            )}
                            
                            {/* Not delivered and no draft - Mark Delivered */}
                            {!isDelivered && !hasDraftIncident && (
                              <button
                                onClick={(e) => handleMarkDelivered(shipment, e)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors text-sm font-medium"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                {isRtl ? 'تأكيد الاستلام' : 'Delivered'}
                              </button>
                            )}
                            
                            {/* Delivered badge */}
                            {isDelivered && !hasSubmittedIncident && (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm">
                                <CheckCircleIcon className="h-4 w-4" />
                                {isRtl ? 'تم' : 'Done'}
                              </span>
                            )}
                            
                            {/* View Incident Button */}
                            {hasSubmittedIncident && shipment.latest_incident && (
                              <button
                                onClick={(e) => handleViewIncident(shipment.latest_incident!.id, e)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                              >
                                <DocumentTextIcon className="h-4 w-4" />
                                {isRtl ? 'التقرير' : 'Report'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {data && data.total > 20 && (
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(data.total / 20)}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>
      
      {/* Delivery Confirmation Modal */}
      <DeliveryConfirmationModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        shipment={selectedShipment}
        onConfirm={handleDeliveryConfirm}
        isLoading={deliveryMutation.isPending}
      />
    </div>
  );
}
