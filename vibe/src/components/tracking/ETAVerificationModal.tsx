import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  UserGroupIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  TruckIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { shipmentsService } from '../../services/shipments';
import { getBorderCrossings } from '../../services/borderCrossings';
import { fetchCustomsClearingCostsByShipment, updateCustomsClearingCost } from '../../services/customsClearingCostsService';
import { useBranches } from '../../hooks/useBranches';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { AutocompleteInput } from '../common/AutocompleteInput';
import { formatNumber } from '../../utils/format';
import type { Shipment } from '../../types/api';

interface ETAVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment;
  onSuccess?: () => void;
  /** Show CC cost verification section (triggered after CC date is entered) */
  showCostVerification?: boolean;
}

/**
 * Modal for verifying Final Beneficiary (FB), Final Destination (FD), 
 * and Border Crossing information when a shipment arrives (ETA day).
 */
export function ETAVerificationModal({
  isOpen,
  onClose,
  shipment,
  onSuccess,
  showCostVerification = false,
}: ETAVerificationModalProps) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const queryClient = useQueryClient();

  // Form state - FB/FD
  const [destinationType, setDestinationType] = useState<'branch' | 'customer' | 'consignment'>('branch');
  const [finalBeneficiaryName, setFinalBeneficiaryName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [deliveryPlace, setDeliveryPlace] = useState('');
  const [borderCrossingId, setBorderCrossingId] = useState('');
  const [borderCrossingName, setBorderCrossingName] = useState('');
  const [isCrossBorder, setIsCrossBorder] = useState(false);

  // Form state - CC Cost verification
  const [hasCostDifference, setHasCostDifference] = useState<boolean | null>(null);
  const [actualCost, setActualCost] = useState('');
  const [costNotes, setCostNotes] = useState('');

  // Fetch branches for dropdown
  const { data: branchesData } = useBranches({ active_only: true });
  const regionBranches = branchesData?.branches.filter(b => b.branch_type === 'region') || [];
  
  // Get warehouses for selected branch (includes shared warehouses)
  const selectedBranchWarehouses = branchId
    ? branchesData?.branches.filter(b => 
        b.branch_type === 'warehouse' && (
          // Direct child warehouse
          b.parent_id === branchId ||
          // Shared warehouse - branch has access
          (b.is_shared && b.shared_with_branches?.includes(branchId))
        )
      ) || []
    : [];

  // Fetch border crossings
  const { data: borderCrossingsData } = useQuery({
    queryKey: ['border-crossings', 'active'],
    queryFn: () => getBorderCrossings({ is_active: true }),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing CC costs for the shipment (only when showCostVerification is true)
  const { data: ccCostsData, isLoading: ccCostsLoading } = useQuery({
    queryKey: ['customs-clearing-costs', 'by-shipment', shipment?.id],
    queryFn: () => fetchCustomsClearingCostsByShipment(shipment.id),
    enabled: !!shipment?.id && showCostVerification,
    staleTime: 0, // Always fresh
  });

  // Get the first/main CC cost entry if exists
  const existingCcCost = ccCostsData?.[0];

  // Initialize form with existing shipment data
  useEffect(() => {
    if (shipment) {
      // Set destination type from shipment or default to 'branch'
      const existingType = shipment.final_destination?.type as 'branch' | 'customer' | 'consignment' | undefined;
      setDestinationType(existingType || 'branch');
      
      // For external customer type, use customer name as final beneficiary
      // For branch type, the branch itself IS the final beneficiary
      if (existingType === 'customer' || existingType === 'consignment') {
        setFinalBeneficiaryName(shipment.final_destination?.name || shipment.final_beneficiary_name || '');
      } else if (existingType === 'branch') {
        // For branch type, look up the branch name from branch_id if not stored
        let branchName = shipment.final_destination?.name || '';
        const existingBranchId = shipment.final_destination?.branch_id;
        if (!branchName && existingBranchId && branchesData?.branches) {
          const branch = branchesData.branches.find(b => b.id === existingBranchId);
          if (branch) {
            branchName = isArabic ? (branch.name_ar || branch.name) : branch.name;
          }
        }
        setFinalBeneficiaryName(branchName || shipment.final_beneficiary_name || '');
      } else {
        // Default case
        setFinalBeneficiaryName(shipment.final_beneficiary_name || '');
      }
      setBranchId(shipment.final_destination?.branch_id || '');
      setWarehouseId(shipment.final_destination?.warehouse_id || '');
      setDeliveryPlace(shipment.final_destination?.delivery_place || '');
      setBorderCrossingId(shipment.primary_border_crossing_id || '');
      setBorderCrossingName(shipment.primary_border_name || '');
      setIsCrossBorder(shipment.is_cross_border || false);
    }
  }, [shipment, branchesData, isArabic]);

  // Initialize CC cost form when data is loaded
  useEffect(() => {
    if (existingCcCost && showCostVerification) {
      setActualCost(String(existingCcCost.total_clearing_cost || ''));
    }
  }, [existingCcCost, showCostVerification]);

  // Determine if border crossing is likely needed
  // (POD country is different from final destination region)
  const needsBorderCrossing = (() => {
    // If already marked as cross-border, definitely needs it
    if (isCrossBorder) return true;
    
    // If POD is in Turkey but FD is in Iraq/Syria, needs border crossing
    const podCountry = shipment.pod_country?.toLowerCase();
    if (podCountry === 'turkey' || podCountry === 'türkiye' || podCountry === 'tr') {
      return true; // Most shipments from Turkey ports go to Iraq/Syria
    }
    
    return false;
  })();

  // Get selected branch name for auto-FB when destination type is 'branch'
  const selectedBranch = regionBranches.find(b => b.id === branchId);
  const branchNameForFB = selectedBranch 
    ? (isArabic ? (selectedBranch.name_ar || selectedBranch.name) : selectedBranch.name)
    : '';

  // Check what's missing based on destination type
  const missingInfo = {
    fb: destinationType !== 'branch' && !finalBeneficiaryName, // FB required for customer/consignment
    branch: destinationType === 'branch' && !branchId, // Branch only required for 'branch' type
    deliveryPlace: destinationType !== 'branch' && !deliveryPlace, // Delivery place required for customer/consignment
    warehouse: destinationType === 'branch' && !warehouseId && !deliveryPlace, // Warehouse for branch type
    borderCrossing: needsBorderCrossing && !borderCrossingId,
  };

  const hasMissingInfo = missingInfo.fb || missingInfo.branch || missingInfo.deliveryPlace || missingInfo.warehouse || missingInfo.borderCrossing;

  // Update mutation for shipment
  const updateShipmentMutation = useMutation({
    mutationFn: async () => {
      // Use effective FB name (branch name for 'branch' type, explicit name for others)
      const fbName = destinationType === 'branch' ? branchNameForFB : finalBeneficiaryName;
      
      // Build final_destination based on destination type
      const finalDestination: Record<string, unknown> = {
        type: destinationType,
        delivery_place: deliveryPlace || null,
      };
      
      if (destinationType === 'branch') {
        // Branch type: store branch_id and warehouse_id
        finalDestination.branch_id = branchId || null;
        finalDestination.warehouse_id = warehouseId || null;
      } else {
        // Customer/Consignment type: store customer name, no branch
        finalDestination.name = finalBeneficiaryName || null;
        finalDestination.branch_id = null;
        finalDestination.warehouse_id = null;
      }
      
      const updateData: Record<string, unknown> = {
        final_beneficiary_name: fbName || null,
        has_final_destination: true,
        final_destination: finalDestination,
        is_cross_border: isCrossBorder || !!borderCrossingId,
        primary_border_crossing_id: borderCrossingId || null,
      };
      
      return await shipmentsService.update(shipment.id, updateData);
    },
    onError: (error) => {
      console.error('Failed to update shipment:', error);
      throw error;
    },
  });

  // Update mutation for CC cost
  const updateCcCostMutation = useMutation({
    mutationFn: async () => {
      if (!existingCcCost?.id || !hasCostDifference) return null;
      
      const newCost = parseFloat(actualCost);
      if (isNaN(newCost) || newCost <= 0) {
        throw new Error('Invalid cost value');
      }
      
      return await updateCustomsClearingCost(existingCcCost.id, {
        total_clearing_cost: newCost,
        original_clearing_amount: newCost,
        notes: costNotes ? `${existingCcCost.notes || ''}\n[Cost Updated: ${costNotes}]`.trim() : existingCcCost.notes,
      });
    },
    onError: (error) => {
      console.error('Failed to update CC cost:', error);
      throw error;
    },
  });

  const handleSubmit = async () => {
    try {
      // Update shipment
      await updateShipmentMutation.mutateAsync();
      
      // Update CC cost if there's a difference
      if (showCostVerification && hasCostDifference && existingCcCost?.id) {
        await updateCcCostMutation.mutateAsync();
      }
      
      // Invalidate queries and close
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['customs-clearing-costs'] });
      onSuccess?.();
      onClose();
    } catch (error) {
      alert(isArabic ? 'فشل تحديث البيانات' : 'Failed to update data');
    }
  };

  const isPending = updateShipmentMutation.isPending || updateCcCostMutation.isPending;

  // Handle warehouse selection - also update delivery place text
  const handleWarehouseChange = (wId: string) => {
    setWarehouseId(wId);
    const warehouse = branchesData?.branches.find(b => b.id === wId);
    if (warehouse) {
      setDeliveryPlace(isArabic ? (warehouse.name_ar || warehouse.name) : warehouse.name);
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-bold text-white">
                          {isArabic ? 'تأكيد بيانات الوصول' : 'Arrival Verification'}
                        </Dialog.Title>
                        <p className="text-sm text-amber-100">
                          {isArabic ? 'يرجى التحقق من بيانات المستفيد والوجهة' : 'Please verify beneficiary & destination'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6 text-white" />
                    </button>
                  </div>
                </div>

                {/* Shipment Info Banner */}
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-amber-700 font-medium">
                        {isArabic ? 'رقم الشحنة:' : 'Shipment:'}
                      </span>{' '}
                      <span className="font-bold text-amber-900">{shipment.sn}</span>
                    </div>
                    <div className="text-amber-600">•</div>
                    <div>
                      <span className="text-amber-700 font-medium">
                        {isArabic ? 'البضاعة:' : 'Goods:'}
                      </span>{' '}
                      <span className="text-amber-900">{shipment.product_text}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="text-amber-700 font-medium">
                      {isArabic ? 'المسار:' : 'Route:'}
                    </span>{' '}
                    <span className="text-amber-900">
                      {shipment.pod_name || 'POD'} {isArabic ? '←' : '→'} {deliveryPlace || '?'}
                    </span>
                  </div>
                </div>

                {/* Form Content */}
                <div className="px-6 py-4 space-y-5">
                  {/* Destination Type Selector */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <UserGroupIcon className="w-4 h-4 text-blue-600" />
                      {isArabic ? 'نوع المستفيد النهائي' : 'Final Beneficiary Type'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDestinationType('branch')}
                        className={`px-3 py-2.5 text-sm rounded-lg border-2 transition-all ${
                          destinationType === 'branch'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold ring-2 ring-blue-200'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        🏢 {isArabic ? 'الفرع' : 'Branch'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDestinationType('customer')}
                        className={`px-3 py-2.5 text-sm rounded-lg border-2 transition-all ${
                          destinationType === 'customer'
                            ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold ring-2 ring-purple-200'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        👤 {isArabic ? 'عميل خارجي' : 'Customer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDestinationType('consignment')}
                        className={`px-3 py-2.5 text-sm rounded-lg border-2 transition-all ${
                          destinationType === 'consignment'
                            ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold ring-2 ring-amber-200'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        📦 {isArabic ? 'أمانة' : 'Consignment'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {destinationType === 'branch' && (isArabic 
                        ? '✓ الفرع المحدد أدناه هو المستفيد النهائي (المالك)'
                        : '✓ Selected branch below is the final beneficiary (owner)')}
                      {destinationType === 'customer' && (isArabic
                        ? '⚡ البضائع لعميل خارجي - أدخل اسم الشركة/العميل'
                        : '⚡ Goods for external customer - enter company/customer name')}
                      {destinationType === 'consignment' && (isArabic
                        ? '📦 بضائع بالأمانة - أدخل اسم المستفيد'
                        : '📦 Goods on consignment - enter beneficiary name')}
                    </p>
                  </div>

                  {/* Final Beneficiary Name - Only for customer/consignment types */}
                  {(destinationType === 'customer' || destinationType === 'consignment') && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <UserGroupIcon className="w-4 h-4 text-purple-600" />
                        {isArabic ? 'اسم المستفيد / الشركة' : 'Beneficiary / Company Name'}
                        {missingInfo.fb && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {isArabic ? 'مطلوب' : 'Required'}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={finalBeneficiaryName}
                        onChange={(e) => setFinalBeneficiaryName(e.target.value)}
                        placeholder={isArabic ? 'أدخل اسم المستفيد النهائي...' : 'Enter final beneficiary name...'}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                          missingInfo.fb ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  )}

                  {/* Branch Selection - Only for 'branch' destination type */}
                  {destinationType === 'branch' && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <MapPinIcon className="w-4 h-4 text-purple-600" />
                        {isArabic ? 'الفرع (المستفيد النهائي)' : 'Branch (Final Beneficiary)'}
                        {missingInfo.branch && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {isArabic ? 'مطلوب' : 'Required'}
                          </span>
                        )}
                      </label>
                      <select
                        value={branchId}
                        onChange={(e) => {
                          setBranchId(e.target.value);
                          setWarehouseId(''); // Reset warehouse when branch changes
                        }}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                          missingInfo.branch ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">
                          {isArabic ? '-- اختر الفرع --' : '-- Select Branch --'}
                        </option>
                        {regionBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {isArabic ? (branch.name_ar || branch.name) : branch.name}
                          </option>
                        ))}
                      </select>
                      {branchId && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-700 font-medium">
                            ✓ {isArabic ? 'المستفيد النهائي (FB):' : 'Final Beneficiary (FB):'}{' '}
                            <span className="text-blue-900 font-bold">{branchNameForFB}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Free Text Delivery Place - For customer/consignment types */}
                  {(destinationType === 'customer' || destinationType === 'consignment') && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <TruckIcon className="w-4 h-4 text-emerald-600" />
                        {isArabic ? 'مكان التسليم النهائي' : 'Final Delivery Location'}
                        {missingInfo.deliveryPlace && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {isArabic ? 'مطلوب' : 'Required'}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={deliveryPlace}
                        onChange={(e) => setDeliveryPlace(e.target.value)}
                        placeholder={isArabic ? 'مثال: مستودع الرياض، ميناء جدة، وسط مدينة دمشق...' : 'e.g., Riyadh warehouse, Jeddah port, Damascus city center...'}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                          missingInfo.deliveryPlace ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {isArabic 
                          ? 'أدخل العنوان أو الموقع الذي سيتم تسليم البضائع إليه'
                          : 'Enter the address or location where goods will be delivered'}
                      </p>
                    </div>
                  )}

                  {/* Warehouse Selection - Only for branch type when branch is selected */}
                  {destinationType === 'branch' && branchId && selectedBranchWarehouses.length > 0 && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <TruckIcon className="w-4 h-4 text-emerald-600" />
                        {isArabic ? 'المستودع / مكان التسليم' : 'Warehouse / Delivery Place'}
                        {missingInfo.warehouse && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {isArabic ? 'مطلوب' : 'Required'}
                          </span>
                        )}
                      </label>
                      <select
                        value={warehouseId}
                        onChange={(e) => handleWarehouseChange(e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                          missingInfo.warehouse ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">
                          {isArabic ? '-- اختر المستودع --' : '-- Select Warehouse --'}
                        </option>
                        {selectedBranchWarehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {isArabic ? (warehouse.name_ar || warehouse.name) : warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Custom Delivery Place for branch type (if no warehouse selected) */}
                  {destinationType === 'branch' && branchId && (!selectedBranchWarehouses.length || !warehouseId) && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <MapPinIcon className="w-4 h-4 text-emerald-600" />
                        {isArabic ? 'عنوان التسليم' : 'Delivery Address'}
                      </label>
                      <input
                        type="text"
                        value={deliveryPlace}
                        onChange={(e) => setDeliveryPlace(e.target.value)}
                        placeholder={isArabic ? 'أدخل عنوان التسليم...' : 'Enter delivery address...'}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  )}

                  {/* Border Crossing Section */}
                  {needsBorderCrossing && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <GlobeAltIcon className="w-5 h-5 text-indigo-600 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-indigo-800">
                            {isArabic ? 'عبور الحدود' : 'Border Crossing'}
                          </h4>
                          <p className="text-xs text-indigo-600 mt-0.5">
                            {isArabic 
                              ? 'يرجى تحديد نقطة العبور الحدودية للشحنة'
                              : 'Please specify the border crossing point for this shipment'}
                          </p>
                        </div>
                        {missingInfo.borderCrossing && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ms-auto">
                            {isArabic ? 'مطلوب' : 'Required'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="is-cross-border"
                          checked={isCrossBorder}
                          onChange={(e) => setIsCrossBorder(e.target.checked)}
                          className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="is-cross-border" className="text-sm text-indigo-700">
                          {isArabic ? 'هذه الشحنة تعبر الحدود' : 'This shipment crosses a border'}
                        </label>
                      </div>

                      {isCrossBorder && (
                        <div>
                          <label className="block text-sm font-medium text-indigo-700 mb-2">
                            {isArabic ? 'نقطة العبور' : 'Crossing Point'}
                          </label>
                          <AutocompleteInput
                            type="borderCrossing"
                            value={borderCrossingId}
                            displayValue={borderCrossingName}
                            onChange={(id, name) => {
                              setBorderCrossingId(id || '');
                              setBorderCrossingName(name || '');
                            }}
                            placeholder={isArabic ? 'اختر نقطة العبور...' : 'Select border crossing...'}
                            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                              missingInfo.borderCrossing && isCrossBorder ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                            }`}
                          />
                          
                          {/* Quick selection for common crossings */}
                          {borderCrossingsData?.data && borderCrossingsData.data.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {borderCrossingsData.data.slice(0, 4).map((bc) => (
                                <button
                                  key={bc.id}
                                  type="button"
                                  onClick={() => {
                                    setBorderCrossingId(bc.id);
                                    setBorderCrossingName(isArabic ? (bc.name_ar || bc.name) : bc.name);
                                  }}
                                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                                    borderCrossingId === bc.id
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-100'
                                  }`}
                                >
                                  {isArabic ? (bc.name_ar || bc.name) : bc.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CC Cost Verification Section */}
                  {showCostVerification && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <CurrencyDollarIcon className="w-5 h-5 text-emerald-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-emerald-800">
                            {isArabic ? 'تأكيد تكاليف التخليص' : 'Clearance Cost Verification'}
                          </h4>
                          <p className="text-xs text-emerald-600 mt-0.5">
                            {isArabic 
                              ? 'هل يوجد فرق بين فاتورة التخليص والتكلفة الفعلية؟'
                              : 'Is there a difference between the CC invoice and the actual cost?'}
                          </p>
                        </div>
                      </div>

                      {ccCostsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Spinner size="sm" />
                          <span className="ms-2 text-sm text-gray-500">
                            {isArabic ? 'جارٍ تحميل البيانات...' : 'Loading cost data...'}
                          </span>
                        </div>
                      ) : existingCcCost ? (
                        <>
                          {/* Show current cost */}
                          <div className="bg-white rounded-md p-3 mb-4 border border-emerald-100">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  {isArabic ? 'التكلفة الحالية المسجلة' : 'Current Recorded Cost'}
                                </p>
                                <p className="text-lg font-bold text-emerald-700">
                                  ${formatNumber(existingCcCost.total_clearing_cost)} 
                                  <span className="text-xs font-normal text-gray-500 ms-2">
                                    ({existingCcCost.currency || 'USD'})
                                  </span>
                                </p>
                              </div>
                              {existingCcCost.file_number && (
                                <div className="text-end">
                                  <p className="text-xs text-gray-500">
                                    {isArabic ? 'رقم الملف' : 'File #'}
                                  </p>
                                  <p className="text-sm font-mono text-emerald-700">
                                    {existingCcCost.file_number}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Question: Is there a difference? */}
                          <div className="mb-4">
                            <p className="text-sm font-medium text-emerald-800 mb-2">
                              {isArabic 
                                ? 'هل يوجد فرق في المبلغ؟'
                                : 'Is there a difference in the amount?'}
                            </p>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setHasCostDifference(false)}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                  hasCostDifference === false
                                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                                    : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                                }`}
                              >
                                {isArabic ? '✓ لا، المبلغ صحيح' : '✓ No, amount is correct'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setHasCostDifference(true)}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                  hasCostDifference === true
                                    ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                                    : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
                                }`}
                              >
                                {isArabic ? '⚠️ نعم، يوجد فرق' : '⚠️ Yes, there\'s a difference'}
                              </button>
                            </div>
                          </div>

                          {/* Show update form if there's a difference */}
                          {hasCostDifference && (
                            <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-md p-3">
                              <div>
                                <label className="block text-sm font-medium text-amber-800 mb-1">
                                  {isArabic ? 'المبلغ الفعلي (الصحيح)' : 'Actual (Correct) Amount'}
                                </label>
                                <div className="relative">
                                  <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-gray-500">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={actualCost}
                                    onChange={(e) => setActualCost(e.target.value)}
                                    placeholder={isArabic ? 'أدخل المبلغ الصحيح...' : 'Enter correct amount...'}
                                    className="w-full ps-8 pe-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                                  />
                                </div>
                                {actualCost && existingCcCost.total_clearing_cost && (
                                  <p className="mt-1 text-xs text-amber-700">
                                    {isArabic ? 'الفرق: ' : 'Difference: '}
                                    <span className={parseFloat(actualCost) > existingCcCost.total_clearing_cost ? 'text-red-600' : 'text-emerald-600'}>
                                      {parseFloat(actualCost) > existingCcCost.total_clearing_cost ? '+' : ''}
                                      ${formatNumber(parseFloat(actualCost) - existingCcCost.total_clearing_cost)}
                                    </span>
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-amber-800 mb-1">
                                  {isArabic ? 'سبب الفرق (اختياري)' : 'Reason for Difference (optional)'}
                                </label>
                                <input
                                  type="text"
                                  value={costNotes}
                                  onChange={(e) => setCostNotes(e.target.value)}
                                  placeholder={isArabic ? 'مثال: تعديل من الجمارك...' : 'e.g., Customs adjustment...'}
                                  className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                                />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-white rounded-md p-4 text-center border border-gray-200">
                          <DocumentTextIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {isArabic 
                              ? 'لا يوجد سجل تكاليف تخليص لهذه الشحنة بعد'
                              : 'No clearance cost entry for this shipment yet'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {isArabic 
                              ? 'يمكنك إضافة التكاليف من صفحة تكاليف التخليص'
                              : 'You can add costs from the Clearance Costs page'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completion Status */}
                  {!hasMissingInfo && (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-800">
                        {isArabic 
                          ? '✓ جميع البيانات المطلوبة مكتملة'
                          : '✓ All required information is complete'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    {isArabic ? 'إلغاء' : 'Cancel'}
                  </button>
                  
                  <div className="flex items-center gap-3">
                    {hasMissingInfo && (
                      <span className="text-xs text-amber-600 hidden sm:inline">
                        {isArabic ? 'بعض الحقول غير مكتملة' : 'Some fields incomplete'}
                      </span>
                    )}
                    <Button
                      variant="primary"
                      onClick={handleSubmit}
                      disabled={isPending || (showCostVerification && hasCostDifference === true && !actualCost)}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-6"
                    >
                      {isPending ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ms-2">{isArabic ? 'جارٍ الحفظ...' : 'Saving...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="w-5 h-5 me-2" />
                          {isArabic ? 'حفظ وتأكيد' : 'Save & Confirm'}
                        </>
                      )}
                    </Button>
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

