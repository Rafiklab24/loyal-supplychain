import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import {
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../services/api';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { formatDateString, formatCurrency } from '../utils/format';
import { TranslatedProductText } from '../components/common/TranslatedProductText';

// Types for border agent shipments
interface BorderDelivery {
  id: string;
  delivery_number: string;
  status: string;
  driver_name: string | null;
  truck_plate_number: string | null;
  transport_company_name: string | null;
  border_eta: string | null;
  border_crossing_id: string | null;
  delivery_leg: string | null;
  delivery_date: string | null;
  transport_cost: number | null;
}

interface BorderShipment {
  id: string;
  sn: string;
  shipment_status: string;
  transaction_type: string;
  border_stage: string | null;
  calculated_stage: string | null;
  border_arrival_date: string | null;
  border_clearance_date: string | null;
  product_text: string | null;
  weight_ton: number | null;
  container_count: number | null;
  customs_clearance_date: string | null;
  is_cross_border: boolean;
  primary_border_crossing_id: string | null;
  eta: string | null;
  border_crossing_name: string | null;
  border_crossing_name_ar: string | null;
  border_country_from: string | null;
  border_country_to: string | null;
  pol_name: string | null;
  pod_name: string | null;
  pod_id: string | null;
  final_destination: any;
  final_destination_place: string | null;
  final_destination_branch_id: string | null;
  supplier_name: string | null;
  delivery_count: number;
  deliveries: BorderDelivery[];
  earliest_border_eta: string | null;
  border_clearance_cost: number;
}

interface BorderShipmentSummary {
  pending_at_pod: number;
  on_the_way: number;
  arrived_at_border: number;
  clearing: number;
  cleared: number;
}

// Status configuration for visual styling
const stageConfig = {
  pending_at_pod: {
    label: 'Pending at POD',
    labelAr: 'في انتظار التحميل',
    description: 'Waiting for trucks to load',
    descriptionAr: 'في انتظار تحميل الشاحنات',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: ClockIcon,
    bgColor: 'bg-gray-50',
    badgeColor: 'gray' as const,
  },
  on_the_way: {
    label: 'On the Way',
    labelAr: 'في الطريق',
    description: 'Trucks en route to border',
    descriptionAr: 'الشاحنات في الطريق للحدود',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: TruckIcon,
    bgColor: 'bg-blue-50',
    badgeColor: 'blue' as const,
  },
  arrived_at_border: {
    label: 'At Border',
    labelAr: 'وصل الحدود',
    description: 'Arrived, waiting for clearance',
    descriptionAr: 'وصل، في انتظار التخليص',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-amber-50',
    badgeColor: 'amber' as const,
  },
  clearing: {
    label: 'Clearing',
    labelAr: 'قيد التخليص',
    description: 'In clearance process',
    descriptionAr: 'قيد عملية التخليص',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: ArrowPathIcon,
    bgColor: 'bg-purple-50',
    badgeColor: 'purple' as const,
  },
  cleared: {
    label: 'Cleared',
    labelAr: 'تم التخليص',
    description: 'Clearance complete',
    descriptionAr: 'اكتمل التخليص',
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: CheckCircleIcon,
    bgColor: 'bg-green-50',
    badgeColor: 'green' as const,
  },
};

// ============================================================
// COST ENTRY MODAL
// ============================================================

interface CostEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: BorderShipment | null;
}

function CostEntryModal({ isOpen, onClose, shipment }: CostEntryModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [borderClearanceCost, setBorderClearanceCost] = useState<string>('');
  const [internalTransportCost, setInternalTransportCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const costMutation = useMutation({
    mutationFn: async (data: { border_clearance_cost: number; internal_transport_cost?: number; notes?: string }) => {
      const response = await apiClient.post(`/border-crossings/border-shipments/${shipment?.id}/costs`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['border-shipments'] });
      onClose();
      setBorderClearanceCost('');
      setInternalTransportCost('');
      setNotes('');
    },
  });

  const handleSubmit = () => {
    if (!borderClearanceCost || isNaN(parseFloat(borderClearanceCost))) return;
    costMutation.mutate({
      border_clearance_cost: parseFloat(borderClearanceCost),
      internal_transport_cost: internalTransportCost ? parseFloat(internalTransportCost) : undefined,
      notes: notes || undefined,
    });
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
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full sm:max-w-md transform overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl transition-all">
                {/* Handle for mobile swipe */}
                <div className="flex justify-center pt-2 sm:hidden">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>
                
                <div className="p-6">
                  <Dialog.Title className="text-xl font-semibold text-gray-900 mb-1">
                    {t('borderAgent.enterCosts', 'Enter Border Costs')}
                  </Dialog.Title>
                  <p className="text-sm text-gray-500 mb-6">
                    {shipment?.sn} - <TranslatedProductText text={shipment?.product_text} className="inline" />
                  </p>

                  {/* Border Clearance Cost Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('borderAgent.borderClearanceCost', 'Border Clearance Cost')} (USD) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                        <CurrencyDollarIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={borderClearanceCost}
                        onChange={(e) => setBorderClearanceCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full ps-12 pe-4 py-4 text-2xl font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Internal Transport Cost Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('borderAgent.internalTransportCost', 'Internal Transport Cost')} (USD) ({t('common.optional', 'optional')})
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                        <TruckIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={internalTransportCost}
                        onChange={(e) => setInternalTransportCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full ps-12 pe-4 py-3 text-xl font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('borderAgent.transportCostHint', 'Cost from border to final destination')}
                    </p>
                  </div>

                  {/* Notes Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('borderAgent.notes', 'Notes')} ({t('common.optional', 'optional')})
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder={t('borderAgent.notesPlaceholder', 'Any additional details...')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!borderClearanceCost || costMutation.isPending}
                      className="flex-1 px-4 py-3 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {costMutation.isPending ? (
                        <Spinner size="sm" />
                      ) : (
                        t('borderAgent.saveAndClear', 'Save & Mark Cleared')
                      )}
                    </button>
                  </div>
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
// SHIPMENT CARD COMPONENT
// ============================================================

interface ShipmentCardProps {
  shipment: BorderShipment;
  onStageChange: (id: string, stage: string) => void;
  onEnterCosts: (shipment: BorderShipment) => void;
  isUpdating: boolean;
}

function ShipmentCard({ shipment, onStageChange, onEnterCosts, isUpdating }: ShipmentCardProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const currentStage = shipment.border_stage || shipment.calculated_stage || 'pending_at_pod';
  const config = stageConfig[currentStage as keyof typeof stageConfig] || stageConfig.pending_at_pod;
  const StageIcon = config.icon;

  // Determine next action based on current stage
  const getNextAction = (): { stage: string; label: string; color: string } | null => {
    switch (currentStage) {
      case 'pending_at_pod':
        return null; // Can't do anything, waiting for delivery to be created
      case 'on_the_way':
        return { stage: 'arrived_at_border', label: t('borderAgent.confirmArrival', '✓ Confirm Arrival'), color: 'bg-amber-600 hover:bg-amber-700' };
      case 'arrived_at_border':
        return { stage: 'clearing', label: t('borderAgent.startClearing', '📋 Start Clearing'), color: 'bg-purple-600 hover:bg-purple-700' };
      case 'clearing':
        return null; // Need to enter costs to mark as cleared
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const canEnterCosts = currentStage === 'arrived_at_border' || currentStage === 'clearing';

  return (
    <div className={`rounded-2xl border-2 ${config.color} ${config.bgColor} p-4 sm:p-5 transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StageIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold text-lg truncate">
              {shipment.sn}
            </span>
          </div>
          <p className="text-sm opacity-75 truncate">
            <TranslatedProductText text={shipment.product_text} fallback={t('borderAgent.noProduct', 'No product info')} />
          </p>
          {shipment.supplier_name && (
            <p className="text-xs opacity-60 truncate mt-0.5">
              {shipment.supplier_name}
            </p>
          )}
        </div>
        <Badge color={config.badgeColor}>
          {isArabic ? config.labelAr : config.label}
        </Badge>
      </div>

      {/* Route Info */}
      <div className="flex items-center gap-2 text-sm mb-3 p-2 bg-white/50 rounded-lg">
        <MapPinIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
        <span className="truncate">
          {shipment.pod_name || 'POD'} 
          <ArrowRightIcon className="w-3 h-3 mx-1 inline" />
          {shipment.border_crossing_name ? (
            <span className="font-medium text-amber-700">
              🚧 {isArabic && shipment.border_crossing_name_ar 
                ? shipment.border_crossing_name_ar 
                : shipment.border_crossing_name}
            </span>
          ) : (
            <span className="text-gray-400">Border</span>
          )}
          <ArrowRightIcon className="w-3 h-3 mx-1 inline" />
          {shipment.final_destination_place || 'FD'}
        </span>
      </div>

      {/* Quick Info Grid */}
      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        {shipment.weight_ton && (
          <div className="p-2 bg-white/50 rounded-lg">
            <p className="text-xs opacity-70">{t('borderAgent.weight', 'Weight')}</p>
            <p className="font-semibold">{shipment.weight_ton} MT</p>
          </div>
        )}
        {shipment.container_count && (
          <div className="p-2 bg-white/50 rounded-lg">
            <p className="text-xs opacity-70">{t('borderAgent.containers', 'Containers')}</p>
            <p className="font-semibold">{shipment.container_count}</p>
          </div>
        )}
        {shipment.border_clearance_cost > 0 ? (
          <div className="p-2 bg-white/50 rounded-lg">
            <p className="text-xs opacity-70">{t('borderAgent.cost', 'Cost')}</p>
            <p className="font-semibold">{formatCurrency(shipment.border_clearance_cost)}</p>
          </div>
        ) : (
          <div className="p-2 bg-white/50 rounded-lg">
            <p className="text-xs opacity-70">{t('borderAgent.eta', 'Border ETA')}</p>
            <p className="font-semibold text-sm">
              {shipment.earliest_border_eta ? formatDateString(shipment.earliest_border_eta) : '—'}
            </p>
          </div>
        )}
      </div>

      {/* Delivery Info (when on the way) */}
      {currentStage === 'on_the_way' && shipment.deliveries && shipment.deliveries.length > 0 && (
        <div className="text-xs opacity-75 mb-3 p-2 bg-white/30 rounded-lg">
          <div className="flex items-center gap-2">
            <TruckIcon className="w-4 h-4" />
            <span>{shipment.deliveries.length} {t('borderAgent.trucksAssigned', 'truck(s) assigned')}</span>
          </div>
          {shipment.deliveries[0].truck_plate_number && (
            <p className="mt-1">
              🚚 {shipment.deliveries[0].truck_plate_number}
              {shipment.deliveries[0].driver_name && ` - ${shipment.deliveries[0].driver_name}`}
            </p>
          )}
        </div>
      )}

      {/* Dates */}
      {(shipment.border_arrival_date || shipment.border_clearance_date) && (
        <div className="text-xs opacity-75 mb-4 flex gap-4">
          {shipment.border_arrival_date && (
            <span>📍 {t('borderAgent.arrived', 'Arrived')}: {formatDateString(shipment.border_arrival_date)}</span>
          )}
          {shipment.border_clearance_date && (
            <span>✓ {t('borderAgent.cleared', 'Cleared')}: {formatDateString(shipment.border_clearance_date)}</span>
          )}
        </div>
      )}

      {/* Pending at POD - No actions available */}
      {currentStage === 'pending_at_pod' && (
        <div className="p-3 bg-white/30 rounded-lg text-center text-sm opacity-75">
          <ClockIcon className="w-5 h-5 mx-auto mb-1" />
          {t('borderAgent.waitingForTrucks', 'Waiting for trucks to be assigned in Land Transport')}
        </div>
      )}

      {/* Actions */}
      {(nextAction || canEnterCosts) && currentStage !== 'cleared' && (
        <div className="flex gap-2">
          {nextAction && (
            <button
              onClick={() => onStageChange(shipment.id, nextAction.stage)}
              disabled={isUpdating}
              className={`flex-1 px-4 py-3 text-white ${nextAction.color} rounded-xl font-medium text-sm transition-colors disabled:opacity-50`}
            >
              {isUpdating ? <Spinner size="sm" /> : nextAction.label}
            </button>
          )}
          
          {canEnterCosts && (
            <button
              onClick={() => onEnterCosts(shipment)}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
            >
              <CurrencyDollarIcon className="w-5 h-5" />
              {t('borderAgent.enterCosts', 'Enter Costs')}
            </button>
          )}
        </div>
      )}

      {/* Cleared Status */}
      {currentStage === 'cleared' && (
        <div className="p-3 bg-green-100 rounded-lg text-center text-sm text-green-800">
          <CheckCircleIcon className="w-5 h-5 mx-auto mb-1" />
          {t('borderAgent.clearanceComplete', 'Clearance complete')}
          {shipment.border_clearance_cost > 0 && (
            <p className="font-semibold mt-1">
              {t('borderAgent.totalCost', 'Total Cost')}: {formatCurrency(shipment.border_clearance_cost)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export function BorderAgentPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const queryClient = useQueryClient();
  
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [costModalShipment, setCostModalShipment] = useState<BorderShipment | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch border shipments
  const { data, isLoading, error } = useQuery({
    queryKey: ['border-shipments', selectedStage],
    queryFn: async () => {
      const params = selectedStage !== 'all' ? `?stage=${selectedStage}` : '';
      const response = await apiClient.get(`/border-crossings/border-shipments${params}`);
      return response.data as { 
        data: BorderShipment[]; 
        summary: BorderShipmentSummary;
        pagination: { total: number };
      };
    },
  });

  // Update stage mutation
  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const response = await apiClient.patch(`/border-crossings/border-shipments/${id}/stage`, {
        stage,
      });
      return response.data;
    },
    onMutate: (variables) => {
      setUpdatingId(variables.id);
    },
    onSettled: () => {
      setUpdatingId(null);
      queryClient.invalidateQueries({ queryKey: ['border-shipments'] });
    },
  });

  const handleStageChange = (id: string, stage: string) => {
    stageMutation.mutate({ id, stage });
  };

  const summary = data?.summary || { pending_at_pod: 0, on_the_way: 0, arrived_at_border: 0, clearing: 0, cleared: 0 };
  const shipments = data?.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-amber-600 text-white px-4 py-4 sm:px-6 shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <BuildingOffice2Icon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {t('borderAgent.title', 'Border Clearance')}
              </h1>
              <p className="text-sm text-amber-200">
                {t('borderAgent.autoWorkflow', 'Cross-border shipments')}
              </p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-1.5 mt-4">
            {(['pending_at_pod', 'on_the_way', 'arrived_at_border', 'clearing', 'cleared'] as const).map((stage) => {
              const config = stageConfig[stage];
              const count = summary[stage];
              const isSelected = selectedStage === stage;
              return (
                <button
                  key={stage}
                  onClick={() => setSelectedStage(selectedStage === stage ? 'all' : stage)}
                  className={`p-2 rounded-xl text-center transition-all ${
                    isSelected 
                      ? 'bg-white text-amber-600 shadow-md scale-105' 
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-[10px] leading-tight">
                    {isArabic ? config.labelAr.split(' ')[0] : config.label.split(' ')[0]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <Card className="p-6">
            <p className="text-center text-red-600">
              {t('errors.loadFailed', 'Failed to load data')}
            </p>
          </Card>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block p-4 bg-amber-100 rounded-full mb-4">
              <CheckCircleIcon className="w-12 h-12 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedStage !== 'all' 
                ? t('borderAgent.noFilteredItems', 'No shipments with this status')
                : t('borderAgent.noShipments', 'No cross-border shipments')}
            </h3>
            <p className="text-gray-600">
              {selectedStage !== 'all'
                ? t('borderAgent.tryDifferentFilter', 'Try selecting a different status')
                : t('borderAgent.noShipmentsDescription', 'Cross-border shipments with customs clearance dates will appear here automatically')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active filter indicator */}
            {selectedStage !== 'all' && (
              <div className="flex items-center justify-between px-3 py-2 bg-amber-100 rounded-lg">
                <span className="text-sm text-amber-800">
                  {t('borderAgent.showingStatus', 'Showing')}: {
                    isArabic 
                      ? stageConfig[selectedStage as keyof typeof stageConfig]?.labelAr 
                      : stageConfig[selectedStage as keyof typeof stageConfig]?.label
                  }
                </span>
                <button
                  onClick={() => setSelectedStage('all')}
                  className="text-sm text-amber-600 hover:text-amber-800 font-medium"
                >
                  {t('borderAgent.showAll', 'Show All')}
                </button>
              </div>
            )}

            {/* Shipment Cards */}
            {shipments.map((shipment) => (
              <ShipmentCard
                key={shipment.id}
                shipment={shipment}
                onStageChange={handleStageChange}
                onEnterCosts={(s) => setCostModalShipment(s)}
                isUpdating={updatingId === shipment.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cost Entry Modal */}
      <CostEntryModal
        isOpen={!!costModalShipment}
        onClose={() => setCostModalShipment(null)}
        shipment={costModalShipment}
      />
    </div>
  );
}

export default BorderAgentPage;
