import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  FunnelIcon,
  PlusIcon,
  TruckIcon,
  CheckIcon,
  XMarkIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useDeliveries, useDeliveryMutations } from '../../hooks/useLandTransport';
import type { DeliveryFilters, OutboundDelivery, DeliveryStatus, UpdateDeliveryInput } from '../../types/api';
import { formatNumber, formatDateString } from '../../utils/format';
import { DeliveryFormModal } from './DeliveryFormModal';
import { DeliveryReceipt } from './DeliveryReceipt';
import { DateInput } from '../common/DateInput';
import { Pagination } from '../common/Pagination';
import { TruncatedText } from '../common/TruncatedText';

interface OutboundDeliveriesTableProps {
  filters: DeliveryFilters;
  onFiltersChange: (filters: DeliveryFilters) => void;
  onDeliveryUpdated?: () => void;
}

const statusColors: Record<DeliveryStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800',
};

export const OutboundDeliveriesTable: React.FC<OutboundDeliveriesTableProps> = ({
  filters,
  onFiltersChange,
  onDeliveryUpdated,
}) => {
  const { t } = useTranslation();
  
  const { data, loading, error, pagination, refresh } = useDeliveries(filters);
  const { updateStatus, update, remove, generateReceipt, loading: mutationLoading } = useDeliveryMutations();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<OutboundDelivery | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, setIsNewDelivery] = useState(false);
  const [receiptDelivery, setReceiptDelivery] = useState<OutboundDelivery | null>(null);
  
  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState<Partial<UpdateDeliveryInput>>({});

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchTerm, page: 1 });
  };

  const handlePageChange = (page: number) => {
    onFiltersChange({ ...filters, page });
  };

  const handleStatusChange = async (id: string, status: DeliveryStatus) => {
    const result = await updateStatus(id, status);
    if (result) {
      refresh();
      onDeliveryUpdated?.();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('landTransport.confirmDelete', 'Are you sure you want to delete this delivery?'))) {
      return;
    }
    const success = await remove(id);
    if (success) {
      refresh();
      onDeliveryUpdated?.();
    }
  };

  const handleEdit = (delivery: OutboundDelivery) => {
    setEditingDelivery(delivery);
    setIsNewDelivery(false);
    setIsModalOpen(true);
  };

  const handleNewDelivery = () => {
    setEditingDelivery(null);
    setIsNewDelivery(true);
    setIsModalOpen(true);
  };

  const handleGenerateReceipt = async (delivery: OutboundDelivery) => {
    if (!delivery.receipt_number) {
      const result = await generateReceipt(delivery.id);
      if (result) {
        setReceiptDelivery(result);
      }
    } else {
      setReceiptDelivery(delivery);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingDelivery(null);
    setIsNewDelivery(false);
  };

  const handleDeliveryUpdated = () => {
    refresh();
    onDeliveryUpdated?.();
    handleModalClose();
  };

  // Inline editing handlers
  const handleStartInlineEdit = (delivery: OutboundDelivery) => {
    setInlineEditingId(delivery.id);
    setInlineEditData({
      destination: delivery.destination,
      origin: delivery.origin || '',
      customer_name: delivery.customer_name || '',
      customer_reference: delivery.customer_reference || '',
      truck_plate_number: delivery.truck_plate_number || '',
      driver_name: delivery.driver_name || '',
      driver_phone: delivery.driver_phone || '',
      transport_cost: delivery.transport_cost || 0,
      selling_price: delivery.selling_price || 0,
    });
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditData({});
  };

  const handleInlineFieldChange = (field: string, value: any) => {
    setInlineEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveInlineEdit = async () => {
    if (!inlineEditingId) return;
    
    const result = await update(inlineEditingId, inlineEditData);
    if (result) {
      refresh();
      onDeliveryUpdated?.();
      setInlineEditingId(null);
      setInlineEditData({});
    }
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
      {/* Header & Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('landTransport.searchDeliveries', 'Search deliveries...')}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white w-64"
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
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
              showFilters 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
              {t('common.filter', 'Filter')}
          </button>
          <button
            onClick={refresh}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('landTransport.totalDeliveries', 'Total: {{count}}', { count: pagination.total })}
          </span>
          <button
            onClick={handleNewDelivery}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm"
          >
            <PlusIcon className="h-5 w-5" />
            {t('landTransport.newDelivery', 'New Delivery')}
          </button>
        </div>
      </div>

        {/* Expanded Filters */}
      {showFilters && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('landTransport.status', 'Status')}
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as DeliveryStatus || undefined, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('common.all', 'All')}</option>
              <option value="pending">{t('landTransport.statusPending', 'Pending')}</option>
              <option value="in_transit">{t('landTransport.statusInTransit', 'In Transit')}</option>
              <option value="delivered">{t('landTransport.statusDelivered', 'Delivered')}</option>
              <option value="cancelled">{t('landTransport.statusCancelled', 'Cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('landTransport.dateFrom', 'Date From')}
            </label>
            <DateInput
              value={filters.date_from || ''}
              onChange={(val) => onFiltersChange({ ...filters, date_from: val || undefined, page: 1 })}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('landTransport.dateTo', 'Date To')}
            </label>
            <DateInput
              value={filters.date_to || ''}
              onChange={(val) => onFiltersChange({ ...filters, date_to: val || undefined, page: 1 })}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('landTransport.destination', 'Destination')}
            </label>
            <input
              type="text"
              value={filters.destination || ''}
              onChange={(e) => onFiltersChange({ ...filters, destination: e.target.value || undefined, page: 1 })}
              placeholder={t('landTransport.filterByDestination', 'Filter by destination...')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      )}
      </div>

      {/* Inline edit hint */}
      {data.length > 0 && !inlineEditingId && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <PencilIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-blue-700 dark:text-blue-300">
            {t('landTransport.clickToEdit', 'Click on any row to edit inline')}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {data.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <TruckIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            {t('landTransport.noDeliveries', 'No deliveries found')}
          </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              {t('landTransport.createFirst', 'Create a new delivery to get started')}
            </p>
        </div>
      ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('landTransport.deliveryNumber', 'Delivery #')}
                </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('landTransport.date', 'Date')}
                </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('landTransport.product', 'Product')}
                </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('landTransport.route', 'Route')}
                </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('landTransport.customer', 'Customer')}
                </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('landTransport.truckDriver', 'Truck / Driver')}
                </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('landTransport.cost', 'Cost')}
                </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('landTransport.status', 'Status')}
                </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {data.map((delivery) => {
                const isEditing = inlineEditingId === delivery.id;
                const isCancelled = delivery.status === 'cancelled';
                
                return (
                  <tr 
                    key={delivery.id} 
                    className={`transition-colors ${
                      isCancelled
                        ? 'bg-red-50/50 dark:bg-red-900/10 opacity-60'
                        : isEditing 
                          ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 ring-inset' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'
                    }`}
                    onClick={() => !isEditing && !isCancelled && handleStartInlineEdit(delivery)}
                  >
                    {/* Delivery Number - always read-only */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${isCancelled ? 'text-red-500 line-through' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {delivery.delivery_number}
                      </div>
                      {delivery.shipment_sn && (
                        <div className={`text-xs mt-0.5 ${isCancelled ? 'text-red-400 line-through' : 'text-gray-500 dark:text-gray-400'}`}>
                          {t('landTransport.ref', 'Ref')}: {delivery.shipment_sn}
                        </div>
                      )}
                    </td>
                    
                    {/* Date - always read-only */}
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                      {formatDateString(delivery.delivery_date)}
                    </td>
                    
                    {/* Product Type - always read-only */}
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                      <TruncatedText text={delivery.shipment_product} maxWidth="120px" />
                    </td>
                    
                    {/* Route - editable (but not if cancelled) */}
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {isEditing && !isCancelled ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={inlineEditData.destination || ''}
                            onChange={(e) => handleInlineFieldChange('destination', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder={t('landTransport.destination', 'Destination')}
                          />
                          <input
                            type="text"
                            value={inlineEditData.origin || ''}
                            onChange={(e) => handleInlineFieldChange('origin', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder={t('landTransport.origin', 'Origin')}
                          />
                        </div>
                      ) : (
                        <div className={`flex flex-col ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                          <span className="font-medium">{delivery.destination}</span>
                          {delivery.origin && (
                            <span className={`text-xs ${isCancelled ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {t('landTransport.from', 'From')}: {delivery.origin}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Customer - editable (but not if cancelled) */}
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {isEditing && !isCancelled ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={inlineEditData.customer_name || ''}
                            onChange={(e) => handleInlineFieldChange('customer_name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder={t('landTransport.customerName', 'Customer name')}
                          />
                          <input
                            type="text"
                            value={inlineEditData.customer_reference || ''}
                            onChange={(e) => handleInlineFieldChange('customer_reference', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder={t('landTransport.customerReference', 'Reference')}
                          />
                        </div>
                      ) : (
                        <div className={`flex flex-col ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                          <span>{delivery.customer_name || '—'}</span>
                          {delivery.customer_reference && (
                            <span className={`text-xs ${isCancelled ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {delivery.customer_reference}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Truck/Driver - editable (but not if cancelled) */}
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {isEditing && !isCancelled ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={inlineEditData.truck_plate_number || ''}
                            onChange={(e) => handleInlineFieldChange('truck_plate_number', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder={t('landTransport.truckPlate', 'Truck plate')}
                          />
                          <input
                            type="text"
                            value={inlineEditData.driver_name || ''}
                            onChange={(e) => handleInlineFieldChange('driver_name', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder={t('landTransport.driverName', 'Driver name')}
                          />
                        </div>
                      ) : (
                        <div className={`flex flex-col ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                          <span className="font-mono">{delivery.truck_plate_number || '—'}</span>
                          {delivery.driver_name && (
                            <span className={`text-xs ${isCancelled ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {delivery.driver_name}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Cost - editable (but not if cancelled) */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center" onClick={(e) => e.stopPropagation()}>
                      {isEditing && !isCancelled ? (
                        <input
                          type="number"
                          value={inlineEditData.transport_cost || ''}
                          onChange={(e) => handleInlineFieldChange('transport_cost', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="0"
                        />
                      ) : (
                        <div className={`font-medium ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          ${formatNumber(delivery.total_cost || 0)}
                        </div>
                      )}
                    </td>
                    
                    {/* Status - always editable via dropdown */}
                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={delivery.status}
                        onChange={(e) => handleStatusChange(delivery.id, e.target.value as DeliveryStatus)}
                        disabled={mutationLoading}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 ${statusColors[delivery.status]}`}
                      >
                        <option value="pending">{t('landTransport.statusPending', 'Pending')}</option>
                        <option value="in_transit">{t('landTransport.statusInTransit', 'In Transit')}</option>
                        <option value="delivered">{t('landTransport.statusDelivered', 'Delivered')}</option>
                        <option value="cancelled">{t('landTransport.statusCancelled', 'Cancelled')}</option>
                      </select>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                      {isCancelled ? (
                        // Cancelled deliveries: only show delete option
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-red-500 italic mr-2">{t('landTransport.cancelled', 'Cancelled')}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(delivery.id);
                            }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title={t('common.delete', 'Delete')}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={handleSaveInlineEdit}
                            disabled={mutationLoading}
                            className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                            title={t('common.save', 'Save')}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelInlineEdit}
                            disabled={mutationLoading}
                            className="p-1.5 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            title={t('common.cancel', 'Cancel')}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              handleCancelInlineEdit();
                              handleEdit(delivery);
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title={t('landTransport.openWizard', 'Open full editor')}
                          >
                            <Cog6ToothIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateReceipt(delivery);
                            }}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title={t('landTransport.generateReceipt', 'Generate Receipt')}
                          >
                            <DocumentTextIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(delivery);
                            }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title={t('landTransport.openWizard', 'Open full editor')}
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(delivery.id);
                            }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title={t('common.delete', 'Delete')}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
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
      {isModalOpen && (
        <DeliveryFormModal
          delivery={editingDelivery}
          onClose={handleModalClose}
          onSuccess={handleDeliveryUpdated}
        />
      )}

      {/* Receipt Modal */}
      {receiptDelivery && (
        <DeliveryReceipt
          delivery={receiptDelivery}
          onClose={() => setReceiptDelivery(null)}
        />
      )}
    </div>
  );
};
