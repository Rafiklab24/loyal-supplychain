import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  TruckIcon,
  CheckCircleIcon,
  CheckIcon,
  XMarkIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CubeIcon,
  GlobeAltIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useReadyForDelivery, useDeliveryMutations } from '../../hooks/useLandTransport';
import type { ReadyForDeliveryFilters, ReadyForDeliveryShipment, ContainerDetailAPI, CreateDeliveryInput } from '../../types/api';
import { formatNumber, formatDateString } from '../../utils/format';
import { TranslatedProductText } from '../common/TranslatedProductText';
import { TruncatedText } from '../common/TruncatedText';
import { DeliveryFormModal } from './DeliveryFormModal';
import { Pagination } from '../common/Pagination';

interface ReadyForDeliveryTableProps {
  filters: ReadyForDeliveryFilters;
  onFiltersChange: (filters: ReadyForDeliveryFilters) => void;
  onDeliveryCreated?: () => void;
}

export const ReadyForDeliveryTable: React.FC<ReadyForDeliveryTableProps> = ({
  filters,
  onFiltersChange,
  onDeliveryCreated,
}) => {
  const { t } = useTranslation();
  
  // Only fetch shipments that have a clearance date
  const { data, loading, error, pagination, refresh } = useReadyForDelivery(filters);
  const { create: createDelivery, loading: createLoading } = useDeliveryMutations();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<ReadyForDeliveryShipment | null>(null);
  const [selectedContainerForModal, setSelectedContainerForModal] = useState<ContainerDetailAPI | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Expanded shipments (to show container details)
  const [expandedShipmentIds, setExpandedShipmentIds] = useState<Set<string>>(new Set());
  
  // Inline delivery creation state - now per container
  const [inlineEditingKey, setInlineEditingKey] = useState<string | null>(null);
  const [inlineFormData, setInlineFormData] = useState<Partial<CreateDeliveryInput>>({});
  
  // Currency for transport costs - default to USD
  const [transportCurrency, setTransportCurrency] = useState<string>('USD');
  
  // Available currencies for internal transport
  const TRANSPORT_CURRENCIES = [
    { code: 'USD', symbol: '$' },
    { code: 'TRY', symbol: '₺' },
    { code: 'EUR', symbol: '€' },
  ];
  
  // Get current user for assignment indicator
  const { user } = useAuth();
  const currentUsername = user?.username?.toLowerCase() || '';
  
  // Determine which filter is applied based on username
  const getAssignmentInfo = () => {
    if (currentUsername === 'cuma') {
      return {
        type: 'cross-border',
        label: t('landTransport.crossBorderOnly', 'Cross-Border Shipments Only'),
        labelAr: 'شحنات عبور الحدود فقط',
        icon: GlobeAltIcon,
        color: 'amber',
      };
    } else if (currentUsername === 'i.bozkurt') {
      return {
        type: 'domestic',
        label: t('landTransport.domesticOnly', 'Domestic Shipments Only'),
        labelAr: 'الشحنات المحلية فقط',
        icon: HomeIcon,
        color: 'blue',
      };
    }
    return null; // Admin/Exec or other users see all
  };
  
  const assignmentInfo = getAssignmentInfo();
  
  // Get currency symbol helper
  const getCurrencySymbol = (code: string) => {
    const currency = TRANSPORT_CURRENCIES.find(c => c.code === code);
    return currency?.symbol || '$';
  };

  // Toggle shipment expansion
  const toggleShipmentExpansion = (shipmentId: string) => {
    setExpandedShipmentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shipmentId)) {
        newSet.delete(shipmentId);
      } else {
        newSet.add(shipmentId);
      }
      return newSet;
    });
  };

  // Calculate total containers across all shipments
  const totalContainers = useMemo(() => {
    return data.reduce((sum, shipment) => {
      return sum + (shipment.containers?.length || shipment.container_count || 1);
    }, 0);
  }, [data]);

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchTerm, page: 1 });
  };

  const handlePageChange = (page: number) => {
    onFiltersChange({ ...filters, page });
  };

  const handleCreateDelivery = (shipment: ReadyForDeliveryShipment, container?: ContainerDetailAPI | null) => {
    setSelectedShipment(shipment);
    setSelectedContainerForModal(container || null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedShipment(null);
    setSelectedContainerForModal(null);
  };

  const handleDeliveryCreated = () => {
    refresh();
    onDeliveryCreated?.();
    handleModalClose();
  };

  // Inline delivery creation handlers
  const handleStartInlineCreate = (shipment: ReadyForDeliveryShipment, container: ContainerDetailAPI | null, rowKey: string) => {
    setInlineEditingKey(rowKey);
    setInlineFormData({
      delivery_date: new Date().toISOString().split('T')[0],
      shipment_id: shipment.id,
      origin: shipment.pod_name || '',
      destination: shipment.final_beneficiary_name || '',
      goods_description: shipment.product_text || '',
      customer_name: shipment.final_beneficiary_name || shipment.supplier_name || '',
      weight_kg: container?.net_weight_kg || (shipment.weight_ton ? Number(shipment.weight_ton) * 1000 : null),
      container_id: container?.container_number || shipment.container_number || '',
      package_count: container?.package_count || null,
      truck_plate_number: '',
      driver_name: '',
      transport_cost: null,
      transport_currency: transportCurrency, // Include selected currency
      status: 'pending',
    });
  };

  const handleCancelInlineCreate = () => {
    setInlineEditingKey(null);
    setInlineFormData({});
  };

  const handleInlineFieldChange = (field: string, value: any) => {
    setInlineFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveInlineCreate = async () => {
    if (!inlineFormData.destination?.trim()) {
      alert(t('landTransport.destinationRequired', 'Destination is required'));
      return;
    }

    const result = await createDelivery(inlineFormData as CreateDeliveryInput);
    if (result) {
      refresh();
      onDeliveryCreated?.();
      setInlineEditingKey(null);
      setInlineFormData({});
    }
  };

  // Format weight from kg to MT
  const formatWeightKgToMT = (weightKg: number | null | undefined): string => {
    if (!weightKg) return '—';
    return formatNumber(weightKg / 1000) + ' MT';
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('landTransport.searchShipments', 'Search by SN, product, BL...')}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white w-72"
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            {t('common.search', 'Search')}
          </button>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg">
            {t('landTransport.totalShipments', 'Shipments: {{count}}', { count: pagination.total })}
          </div>
          <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg font-medium">
            {t('landTransport.totalContainers', 'Containers: {{count}}', { count: totalContainers })}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-800/30 rounded-full">
          <TruckIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-sm">
          <span className="font-semibold text-emerald-800 dark:text-emerald-200 block">
            {t('landTransport.readyForTransport', 'Ready for Transport')}
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">
            {t('landTransport.containerRowsHint', 'Each row represents one container. Click to assign transport for that container.')}
          </span>
        </div>
      </div>
      
      {/* User Assignment Filter Indicator */}
      {assignmentInfo && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
          assignmentInfo.color === 'amber' 
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' 
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className={`p-2 rounded-full ${
            assignmentInfo.color === 'amber'
              ? 'bg-amber-100 dark:bg-amber-800/30'
              : 'bg-blue-100 dark:bg-blue-800/30'
          }`}>
            <assignmentInfo.icon className={`h-5 w-5 ${
              assignmentInfo.color === 'amber'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-blue-600 dark:text-blue-400'
            }`} />
          </div>
          <div className="text-sm">
            <span className={`font-semibold block ${
              assignmentInfo.color === 'amber'
                ? 'text-amber-800 dark:text-amber-200'
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {assignmentInfo.type === 'cross-border' ? '🚧 ' : '🏠 '}
              {assignmentInfo.labelAr}
            </span>
            <span className={`${
              assignmentInfo.color === 'amber'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}>
              {assignmentInfo.type === 'cross-border' 
                ? t('landTransport.crossBorderDesc', 'Showing shipments that cross international borders (Turkey → Iraq/Syria)')
                : t('landTransport.domesticDesc', 'Showing shipments that stay within Turkey (no border crossing)')
              }
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {data.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircleIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              {t('landTransport.noShipmentsReady', 'No shipments ready for delivery')}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              {t('landTransport.noShipmentsReadyDesc', 'Shipments will appear here after customs clearance')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('shipments.sn', 'SN')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('shipments.clearanceDate', 'Clearance')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('shipments.product', 'Product')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('landTransport.containers', 'Containers')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('shipments.route', 'المسار')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('landTransport.finalBeneficiary', 'Beneficiary')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('common.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((shipment) => {
                  const containers = shipment.containers || [];
                  const containerCount = containers.length || shipment.container_count || 1;
                  const isExpanded = expandedShipmentIds.has(shipment.id);
                  const hasMultipleContainers = containerCount > 1;
                  
                  return (
                    <React.Fragment key={shipment.id}>
                      {/* Main Shipment Row */}
                      <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                        {/* SN */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {shipment.sn || '—'}
                          </span>
                        </td>
                        
                        {/* Clearance Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {shipment.customs_clearance_date ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {formatDateString(shipment.customs_clearance_date)}
                            </span>
                          ) : '—'}
                        </td>
                        
                        {/* Product */}
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          <TruncatedText text={shipment.product_text} className="font-medium" maxWidth="180px">
                            <TranslatedProductText text={shipment.product_text} />
                          </TruncatedText>
                        </td>
                        
                        {/* Containers - Clickable dropdown trigger */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {hasMultipleContainers ? (
                            <button
                              onClick={() => toggleShipmentExpansion(shipment.id)}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                                isExpanded 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-2 ring-emerald-500' 
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                              }`}
                            >
                              <CubeIcon className="h-4 w-4" />
                              <span>{containerCount} {t('landTransport.containersCount', 'containers')}</span>
                              {isExpanded ? (
                                <ChevronUpIcon className="h-4 w-4" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-sm">
                              <CubeIcon className="h-4 w-4" />
                              <span className="font-mono">{containers[0]?.container_number || shipment.container_number || '—'}</span>
                            </span>
                          )}
                        </td>
                        
                        {/* Route: POD → Border → Final Destination */}
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                            <span className="font-medium text-gray-900 dark:text-white">{shipment.pod_name || '—'}</span>
                            {shipment.is_cross_border && shipment.primary_border_name && (
                              <>
                                <span className="text-amber-500">→</span>
                                <span className="font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-xs">
                                  🚧 {shipment.primary_border_name}
                                </span>
                              </>
                            )}
                            <span className={shipment.is_cross_border ? 'text-amber-500' : 'text-gray-400'}>→</span>
                            <span className="font-medium text-gray-900 dark:text-white">{shipment.final_destination_place || '—'}</span>
                          </div>
                        </td>
                        
                        {/* Beneficiary */}
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          <div className="truncate max-w-[120px]" title={shipment.final_beneficiary_name || ''}>
                            {shipment.final_beneficiary_name || shipment.supplier_name || '—'}
                          </div>
                        </td>
                        
                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {!hasMultipleContainers && (
                            <button
                              onClick={() => handleCreateDelivery(shipment, containers[0] || null)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-medium rounded-lg hover:bg-emerald-600 hover:text-white transition-all duration-200 shadow-sm"
                            >
                              <TruckIcon className="h-3.5 w-3.5" />
                              {t('landTransport.assign', 'Assign')}
                            </button>
                          )}
                          {hasMultipleContainers && !isExpanded && (
                            <span className="text-xs text-gray-400 italic">
                              {t('landTransport.clickToExpand', 'Click containers to expand')}
                            </span>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Container Details */}
                      {isExpanded && hasMultipleContainers && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border-y border-emerald-200 dark:border-emerald-800">
                              {/* Container header with currency selector */}
                              <div className="px-4 py-2 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-100/50 dark:bg-emerald-900/20">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                    <CubeIcon className="h-4 w-4" />
                                    {t('landTransport.containerDetails', 'Container Details')} — {shipment.sn}
                                  </div>
                                  {/* Currency Selector */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('common.currency', 'Currency')}:</span>
                                    <div className="flex gap-1">
                                      {TRANSPORT_CURRENCIES.map((currency) => (
                                        <button
                                          key={currency.code}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTransportCurrency(currency.code);
                                          }}
                                          className={`px-2 py-0.5 text-xs font-medium rounded transition-all ${
                                            transportCurrency === currency.code
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                                          }`}
                                        >
                                          {currency.symbol} {currency.code}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Container table */}
                              <table className="min-w-full">
                                <thead className="bg-emerald-100/30 dark:bg-emerald-900/20">
                                  <tr>
                                    <th className="px-4 py-2 text-start text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">#</th>
                                    <th className="px-4 py-2 text-start text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('shipments.containerNumber', 'Container ID')}</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.packages', 'Packages')}</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.netWeight', 'Net Weight')}</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.grossWeight', 'Gross Weight')}</th>
                                    <th className="px-4 py-2 text-start text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.truckPlate', 'Truck')}</th>
                                    <th className="px-4 py-2 text-start text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.driver', 'Driver')}</th>
                                    <th className="px-4 py-2 text-start text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.transportCompany', 'Company')}</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.transportCost', 'Cost')}</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.insuranceCost', 'Insurance')}</th>
                                    <th className="px-4 py-2 text-start text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.insuranceCompany', 'Insurer')}</th>
                                    <th className="px-4 py-2 text-start text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('landTransport.destination', 'Destination')}</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase">{t('common.actions', 'Actions')}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-emerald-200/50 dark:divide-emerald-800/50">
                                  {containers.map((container, idx) => {
                                    const containerKey = `${shipment.id}-${container.id}`;
                                    const isEditing = inlineEditingKey === containerKey;
                                    const hasDelivery = container.has_delivery || false;
                                    const deliveryInfo = container.delivery_info;
                                    
                                    return (
                                      <tr
                                        key={containerKey}
                                        className={`transition-colors ${
                                          hasDelivery
                                            ? 'bg-blue-50 dark:bg-blue-900/20 opacity-75'
                                            : isEditing 
                                              ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500 ring-inset' 
                                              : 'hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 cursor-pointer'
                                        }`}
                                        onClick={() => !hasDelivery && !isEditing && !inlineEditingKey && handleStartInlineCreate(shipment, container, containerKey)}
                                      >
                                        {/* Index */}
                                        <td className="px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                                          {idx + 1}/{containerCount}
                                        </td>
                                        
                                        {/* Container ID */}
                                        <td className="px-4 py-2.5 text-sm font-mono text-gray-900 dark:text-white">
                                          <div className="flex items-center gap-2">
                                            {container.container_number || '—'}
                                            {hasDelivery && (
                                              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded">
                                                ✓ {t('landTransport.assigned', 'Assigned')}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        
                                        {/* Packages */}
                                        <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white text-center">
                                          {container.package_count || '—'}
                                        </td>
                                        
                                        {/* Net Weight */}
                                        <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white text-center">
                                          {container.net_weight_kg ? formatWeightKgToMT(container.net_weight_kg) : '—'}
                                        </td>
                                        
                                        {/* Gross Weight */}
                                        <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white text-center">
                                          {container.gross_weight_kg ? formatWeightKgToMT(container.gross_weight_kg) : '—'}
                                        </td>
                                        
                                        {/* Truck - show assigned value or editable */}
                                        <td className="px-4 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className="font-mono text-blue-700 dark:text-blue-300">{deliveryInfo.truck_plate_number || '—'}</span>
                                          ) : isEditing ? (
                                            <input
                                              type="text"
                                              value={inlineFormData.truck_plate_number || ''}
                                              onChange={(e) => handleInlineFieldChange('truck_plate_number', e.target.value)}
                                              className="w-full px-2 py-1 text-sm font-mono border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-emerald-600 dark:text-white"
                                              placeholder={t('landTransport.truckPlate', 'Plate #')}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className="text-gray-400 italic text-xs">{t('landTransport.clickToInput', 'Click to input')}</span>
                                          )}
                                        </td>
                                        
                                        {/* Driver - show assigned value or editable */}
                                        <td className="px-4 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className="text-blue-700 dark:text-blue-300">{deliveryInfo.driver_name || '—'}</span>
                                          ) : isEditing ? (
                                            <input
                                              type="text"
                                              value={inlineFormData.driver_name || ''}
                                              onChange={(e) => handleInlineFieldChange('driver_name', e.target.value)}
                                              className="w-full px-2 py-1 text-sm border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-emerald-600 dark:text-white"
                                              placeholder={t('landTransport.driverName', 'Driver name')}
                                            />
                                          ) : (
                                            <span className="text-gray-400 italic text-xs">{t('landTransport.clickToInput', 'Click to input')}</span>
                                          )}
                                        </td>
                                        
                                        {/* Transport Company - show assigned value or editable */}
                                        <td className="px-4 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className="text-blue-700 dark:text-blue-300">{deliveryInfo.transport_company_name || '—'}</span>
                                          ) : isEditing ? (
                                            <input
                                              type="text"
                                              value={inlineFormData.transport_company_name || ''}
                                              onChange={(e) => handleInlineFieldChange('transport_company_name', e.target.value)}
                                              className="w-full px-2 py-1 text-sm border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-emerald-600 dark:text-white"
                                              placeholder={t('landTransport.companyName', 'Company')}
                                            />
                                          ) : (
                                            <span className="text-gray-400 italic text-xs">{t('landTransport.clickToInput', 'Click to input')}</span>
                                          )}
                                        </td>
                                        
                                        {/* Transport Cost - show assigned value or editable */}
                                        <td className="px-4 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                                              {deliveryInfo.transport_cost ? `${getCurrencySymbol(deliveryInfo.transport_currency || transportCurrency)}${formatNumber(deliveryInfo.transport_cost)}` : '—'}
                                            </span>
                                          ) : isEditing ? (
                                            <div className="flex items-center gap-0.5">
                                              <span className="text-emerald-600 font-medium text-xs">{getCurrencySymbol(transportCurrency)}</span>
                                              <input
                                                type="number"
                                                value={inlineFormData.transport_cost || ''}
                                                onChange={(e) => handleInlineFieldChange('transport_cost', e.target.value ? Number(e.target.value) : null)}
                                                className="w-16 px-1.5 py-1 text-sm text-center border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-emerald-600 dark:text-white"
                                                placeholder="0"
                                                min="0"
                                                step="0.01"
                                              />
                                            </div>
                                          ) : (
                                            <span className="text-gray-400 italic text-xs">{t('landTransport.clickToInput', 'Click to input')}</span>
                                          )}
                                        </td>
                                        
                                        {/* Insurance Cost - show assigned value or editable */}
                                        <td className="px-4 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                                              {deliveryInfo.insurance_cost ? `${getCurrencySymbol(deliveryInfo.transport_currency || transportCurrency)}${formatNumber(deliveryInfo.insurance_cost)}` : '—'}
                                            </span>
                                          ) : isEditing ? (
                                            <div className="flex items-center gap-0.5">
                                              <span className="text-emerald-600 font-medium text-xs">{getCurrencySymbol(transportCurrency)}</span>
                                              <input
                                                type="number"
                                                value={inlineFormData.insurance_cost || ''}
                                                onChange={(e) => handleInlineFieldChange('insurance_cost', e.target.value ? Number(e.target.value) : null)}
                                                className="w-16 px-1.5 py-1 text-sm text-center border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-emerald-600 dark:text-white"
                                                placeholder="0"
                                                min="0"
                                                step="0.01"
                                              />
                                            </div>
                                          ) : (
                                            <span className="text-gray-400 italic text-xs">{t('landTransport.clickToInput', 'Click to input')}</span>
                                          )}
                                        </td>
                                        
                                        {/* Insurance Company - show assigned value or editable */}
                                        <td className="px-4 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className="text-blue-700 dark:text-blue-300">{deliveryInfo.insurance_company || '—'}</span>
                                          ) : isEditing ? (
                                            <input
                                              type="text"
                                              value={inlineFormData.insurance_company || ''}
                                              onChange={(e) => handleInlineFieldChange('insurance_company', e.target.value)}
                                              className="w-full px-2 py-1 text-sm border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-emerald-600 dark:text-white"
                                              placeholder={t('landTransport.insuranceCompanyPlaceholder', 'Insurer name')}
                                            />
                                          ) : (
                                            <span className="text-gray-400 italic text-xs">{t('landTransport.clickToInput', 'Click to input')}</span>
                                          )}
                                        </td>
                                        
                                        {/* Destination - show assigned value or editable */}
                                        <td className="px-4 py-2.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className="text-blue-700 dark:text-blue-300 truncate max-w-[100px] block">
                                              {deliveryInfo.destination || '—'}
                                            </span>
                                          ) : isEditing ? (
                                            <input
                                              type="text"
                                              value={inlineFormData.destination || ''}
                                              onChange={(e) => handleInlineFieldChange('destination', e.target.value)}
                                              className="w-full px-2 py-1 text-sm border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:border-emerald-600 dark:text-white"
                                              placeholder={t('landTransport.destination', 'Destination')}
                                            />
                                          ) : (
                                            <span className="text-gray-500 dark:text-gray-400 truncate max-w-[100px] block">
                                              {shipment.final_beneficiary_name || shipment.pod_name || '—'}
                                            </span>
                                          )}
                                        </td>
                                        
                                        {/* Actions - show status badge if assigned, otherwise show assign button */}
                                        <td className="px-4 py-2.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                                          {hasDelivery && deliveryInfo ? (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg ${
                                              deliveryInfo.status === 'delivered' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                                                : deliveryInfo.status === 'in_transit'
                                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                            }`}>
                                              <CheckIcon className="h-3.5 w-3.5" />
                                              {deliveryInfo.status === 'delivered' ? t('landTransport.delivered', 'Delivered') :
                                               deliveryInfo.status === 'in_transit' ? t('landTransport.inTransit', 'In Transit') :
                                               t('landTransport.pending', 'Pending')}
                                            </span>
                                          ) : isEditing ? (
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                onClick={handleSaveInlineCreate}
                                                disabled={createLoading}
                                                className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                                                title={t('landTransport.createDelivery', 'Create Delivery')}
                                              >
                                                <CheckIcon className="h-4 w-4" />
                                              </button>
                                              <button
                                                onClick={handleCancelInlineCreate}
                                                disabled={createLoading}
                                                className="p-1.5 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                                                title={t('common.cancel', 'Cancel')}
                                              >
                                                <XMarkIcon className="h-4 w-4" />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  handleCancelInlineCreate();
                                                  handleCreateDelivery(shipment, container);
                                                }}
                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title={t('landTransport.openWizard', 'Open full editor')}
                                              >
                                                <Cog6ToothIcon className="h-4 w-4" />
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCreateDelivery(shipment, container);
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-sm"
                                            >
                                              <TruckIcon className="h-3.5 w-3.5" />
                                              {t('landTransport.assign', 'Assign')}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Delivery Form Modal */}
      {isModalOpen && selectedShipment && (
        <DeliveryFormModal
          shipment={selectedShipment}
          container={selectedContainerForModal}
          onClose={handleModalClose}
          onSuccess={handleDeliveryCreated}
        />
      )}
    </div>
  );
};
