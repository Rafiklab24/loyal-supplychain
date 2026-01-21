import { useState, Fragment, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { 
  ArrowLeftIcon, 
  PencilIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  BanknotesIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CalendarIcon,
  ScaleIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon,
  PlusIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { useShipment } from '../hooks/useShipments';
import { useContract } from '../hooks/useContracts';
import { Card } from '../components/common/Card';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { EditShipmentWizard } from '../components/shipments/EditShipmentWizard';
import { ContractComparisonModal } from '../components/shipments/ContractComparisonModal';
import { AuditLogViewer } from '../components/audit/AuditLogViewer';
import { DemurrageStatusBadge } from '../components/shipments/DemurrageStatusBadge';
import { DocumentPanel } from '../components/documents';
import { TransactionsPanel } from '../components/finance';
import ElleclemeHistoryPanel from '../components/ellecleme/ElleclemeHistoryPanel';
import { updateShipment } from '../services/shipments';
import { companiesService } from '../services/companies';
import { 
  formatCurrency, 
  formatNumber, 
  formatWeight, 
  formatDateString,
  statusToArabic, 
  getStatusColor 
} from '../utils/format';
import { getCargoDisplay } from '../utils/cargoDisplay';
import { DateInput } from '../components/common/DateInput';
import { TransferOrderModal } from '../components/transfers';
import { useFinalDestination } from '../hooks/useFinalDestination';
import type { Company } from '../types/api';

export function ShipmentDetailPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: shipment, isLoading, error, refetch } = useShipment(id);
  const { data: contract } = useContract(shipment?.contract_id || '');
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showTransferOrderModal, setShowTransferOrderModal] = useState(false);
  const [supplier, setSupplier] = useState<Company | null>(null);

  // Debug: Log when shipment data changes
  useEffect(() => {
    if (shipment) {
      console.log('🚢 Shipment data updated:', {
        id: shipment.id,
        sn: shipment.sn,
        customs_clearance_date: shipment.customs_clearance_date,
        eta: shipment.eta,
        free_time_days: shipment.free_time_days,
      });
    }
  }, [shipment]);

  // Fetch supplier data for transfer order generation
  useEffect(() => {
    async function fetchSupplier() {
      if (shipment?.supplier_id) {
        try {
          const supplierData = await companiesService.getById(shipment.supplier_id);
          setSupplier(supplierData);
        } catch (error) {
          console.error('Failed to fetch supplier:', error);
        }
      }
    }
    fetchSupplier();
  }, [shipment?.supplier_id]);

  // Resolve final destination (looks up branch name from branch_id if needed)
  const finalDestInfo = useFinalDestination(shipment?.final_destination as any);

  const handleEditClick = () => {
    setShowConfirmEdit(true);
  };

  const confirmEdit = () => {
    setShowConfirmEdit(false);
    setShowEditWizard(true);
  };

  const handleInlineEditStart = () => {
    // Parse batches if they exist
    const currentBatches = shipment?.batches ? 
      (typeof shipment.batches === 'string' ? JSON.parse(shipment.batches) : shipment.batches) 
      : [];
    
    // Helper function to extract date from ISO string
    const extractDate = (dateString: string | null | undefined): string => {
      if (!dateString) return '';
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
      // Otherwise extract date portion from ISO datetime
      return dateString.split('T')[0];
    };
    
    // Initialize edited data with current shipment data
    setEditedData({
      customs_clearance_date: extractDate(shipment?.customs_clearance_date),
      product_text: shipment?.product_text || '',
      weight_ton: shipment?.weight_ton || '',
      container_count: shipment?.container_count || '',
      fixed_price_usd_per_ton: shipment?.fixed_price_usd_per_ton || '',
      selling_price_usd_per_ton: shipment?.selling_price_usd_per_ton || '',
      etd: extractDate(shipment?.etd),
      eta: extractDate(shipment?.eta),
      booking_no: shipment?.booking_no || '',
      bl_no: shipment?.bl_no || '',
      notes: shipment?.notes || '',
      status: shipment?.status || 'planning',
      is_split_shipment: shipment?.is_split_shipment || false,
      batches: currentBatches,
    });
    setIsInlineEditing(true);
    setSaveError(null);
  };

  const handleInlineEditCancel = () => {
    setIsInlineEditing(false);
    setEditedData({});
    setSaveError(null);
  };

  const handleInlineEditSave = async () => {
    if (!id) return;
    
    setIsSaving(true);
    setSaveError(null);

    try {
      // Prepare data for update - convert empty strings to null for optional fields
      const updateData = {
        ...editedData,
        customs_clearance_date: editedData.customs_clearance_date || null,
        etd: editedData.etd || null,
        eta: editedData.eta || null,
      };
      
      console.log('💾 Saving shipment data:', updateData);
      const response = await updateShipment(id, updateData);
      console.log('✅ Save response:', response);
      
      // Exit edit mode first
      setIsInlineEditing(false);
      setEditedData({});
      
      // Then invalidate and refetch to get fresh data
      await queryClient.invalidateQueries({ queryKey: ['shipment', id] });
      await queryClient.refetchQueries({ queryKey: ['shipment', id] });
      
      console.log('🔄 Data refreshed successfully');
    } catch (error: any) {
      console.error('❌ Failed to save changes:', error);
      setSaveError(error.response?.data?.message || error.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    console.log(`📝 Field changed: ${field} =`, value);
    setEditedData((prev: any) => {
      const newData = { ...prev, [field]: value };
      console.log('📊 Updated editedData:', newData);
      return newData;
    });
  };

  // Batch management functions
  const handleAddBatch = () => {
    const newBatch = {
      id: `batch-${Date.now()}`,
      batch_number: `${(editedData.batches?.length || 0) + 1}`,
      batch_name: `Batch ${(editedData.batches?.length || 0) + 1}`,
      weight_ton: '',
      container_count: '',
      barrels: '',
      etd: '',
      eta: '',
      booking_no: '',
      bl_no: '',
      status: 'planning',
      vessel_name: '',
      vessel_imo: '',
      container_number: '',
      truck_plate_number: '',
      tanker_name: '',
      tanker_imo: '',
      notes: '',
    };
    setEditedData((prev: any) => ({
      ...prev,
      batches: [...(prev.batches || []), newBatch],
    }));
  };

  const handleRemoveBatch = (batchId: string) => {
    setEditedData((prev: any) => ({
      ...prev,
      batches: prev.batches.filter((b: any) => b.id !== batchId),
    }));
  };

  const handleBatchFieldChange = (batchId: string, field: string, value: any) => {
    setEditedData((prev: any) => ({
      ...prev,
      batches: prev.batches.map((batch: any) =>
        batch.id === batchId ? { ...batch, [field]: value } : batch
      ),
    }));
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
    );
  }

  if (error || !shipment) {
    return (
        <div className="text-center py-12">
          <p className="text-red-600">{t('common.error')}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            {t('common.back')}
          </Button>
        </div>
    );
  }

  // Parse batches if they exist
  const batches = shipment.batches ? 
    (typeof shipment.batches === 'string' ? JSON.parse(shipment.batches) : shipment.batches) 
    : [];

  // Parse financial arrays
  const paymentSchedule = shipment.payment_schedule || [];
  const additionalCosts = shipment.additional_costs || [];
  const bolNumbers = shipment.bol_numbers || [];

  return (
    <div className="space-y-6 pb-8">
        {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {shipment.sn}
              </h1>
              {shipment.subject && (
                <p className="text-sm text-gray-500 mt-0.5">{shipment.subject}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
          <Badge color={getStatusColor(shipment.status) as any} size="md">
              {isRtl ? statusToArabic(shipment.status) : shipment.status}
          </Badge>
            
            {!isInlineEditing ? (
              <>
                {shipment?.contract_id && (
                  <Button 
                    variant="secondary" 
                    onClick={() => setShowComparisonModal(true)}
                    className="inline-flex items-center gap-2"
                  >
                    <DocumentTextIcon className="h-5 w-5" />
                    {t('shipments.compareWithContract', 'Compare with Contract')}
                  </Button>
                )}
                <Button 
                  variant="secondary" 
                  onClick={() => setShowAuditLog(true)}
                  className="inline-flex items-center gap-2"
                >
                  <DocumentTextIcon className="h-5 w-5" />
                  {t('shipments.viewChangeHistory', 'View Change History')}
                </Button>
                {/* Generate Transfer Order Button */}
                {shipment?.supplier_id && (
                  <Button 
                    variant="secondary" 
                    onClick={() => setShowTransferOrderModal(true)}
                    className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  >
                    <CurrencyDollarIcon className="h-5 w-5" />
                    {t('shipments.generateTransferOrder', 'Transfer Order')}
                  </Button>
                )}
                <Button 
                  variant="secondary" 
                  onClick={handleInlineEditStart}
                  className="inline-flex items-center gap-2"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                  {t('shipments.quickEdit', 'Quick Edit')}
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleEditClick}
                  className="inline-flex items-center gap-2"
                >
                  <PencilIcon className="h-5 w-5" />
                  {t('shipments.editWizard', 'Edit (Wizard)')}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="secondary" 
                  onClick={handleInlineEditCancel}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2"
                >
                  <XMarkIcon className="h-5 w-5" />
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleInlineEditSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 min-w-[120px]"
                >
                  {isSaving ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      {t('common.saving', 'Saving...')}
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-5 w-5" />
                      {t('common.save', 'Save Changes')}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Save error message */}
        {saveError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{saveError}</p>
          </div>
        )}
        
        {/* Edit mode indicator */}
        {isInlineEditing && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <PencilSquareIcon className="h-5 w-5" />
              {t('shipments.editModeActive', 'Edit mode active - Click on fields to modify them')}
            </p>
          </div>
        )}
      </div>

      {/* Contract Information (if linked) */}
      {contract && (
        <Card>
          <div className="border-b border-gray-200 pb-4 mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="h-6 w-6 text-purple-600" />
              {t('contracts.title', 'Contract Information')}
            </h2>
            <button
              onClick={() => navigate(`/contracts/${contract.id}`)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {t('common.viewDetails', 'View Details')} →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.contractNo', 'Contract Number')}
              </dt>
              <dd className="text-base font-semibold text-gray-900">{contract.contract_no}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.buyer', 'Buyer')}
              </dt>
              <dd className="text-base text-gray-900">{contract.buyer_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.seller', 'Seller')}
              </dt>
              <dd className="text-base text-gray-900">{contract.seller_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('contracts.status', 'Status')}
              </dt>
              <dd className="text-base">
                <Badge color={contract.status === 'ACTIVE' ? 'green' : contract.status === 'DRAFT' ? 'gray' : 'blue'}>
                  {t(`contracts.status${contract.status.charAt(0) + contract.status.slice(1).toLowerCase()}`, contract.status)}
                </Badge>
              </dd>
            </div>
          </div>
        </Card>
      )}

      {/* Step 1: Basic Information */}
      <Card>
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
            {t('shipments.wizard.step1Title', 'Basic Information')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">
              {t('shipments.wizard.transactionType', 'Transaction Type')}
            </dt>
            <dd className="text-base font-semibold">
              <Badge color={(shipment.transaction_type || shipment.direction) === 'incoming' ? 'blue' : 'green'}>
                {(shipment.transaction_type || shipment.direction) === 'incoming' 
                  ? t('shipments.wizard.directionIncoming', 'Purchase (Buyer)')
                  : t('shipments.wizard.directionOutgoing', 'Sale (Seller)')
                }
              </Badge>
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">
              {t('shipments.sn', 'Contract Number')}
            </dt>
            <dd className="text-base font-semibold text-gray-900">{shipment.sn}</dd>
          </div>

          {/* Customs Clearance Date - Quick Edit Priority Field */}
          <div className="md:col-span-2 lg:col-span-1">
            <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2">
              {t('shipments.customsClearanceDate')}
              <span className="text-xs text-gray-400">
                ({t('shipments.customsClearanceDateHelper')})
              </span>
            </dt>
            {isInlineEditing ? (
              <div className="space-y-2">
                <DateInput
                  value={editedData.customs_clearance_date || ''}
                  onChange={(val) => handleFieldChange('customs_clearance_date', val)}
                  className="w-full border-amber-300 focus:ring-amber-500 focus:border-amber-500 text-base font-semibold bg-amber-50"
                />
                {editedData.customs_clearance_date && shipment.eta && shipment.free_time_days && (
                  <DemurrageStatusBadge
                    eta={shipment.eta}
                    freeTimeDays={shipment.free_time_days}
                    customsClearanceDate={editedData.customs_clearance_date}
                    status={shipment.status}
                    showDetails={true}
                    size="sm"
                  />
                )}
              </div>
            ) : (
              <dd className="text-base font-semibold text-gray-900">
                <div className="flex items-center gap-2">
                  <span>{shipment.customs_clearance_date ? formatDateString(shipment.customs_clearance_date) : '—'}</span>
                  {shipment.customs_clearance_date && shipment.eta && shipment.free_time_days && (
                    <DemurrageStatusBadge
                      eta={shipment.eta}
                      freeTimeDays={shipment.free_time_days}
                      customsClearanceDate={shipment.customs_clearance_date}
                      status={shipment.status}
                      size="sm"
                    />
                  )}
                </div>
              </dd>
            )}
          </div>

          {shipment.subject && (
            <div className="md:col-span-2 lg:col-span-1">
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.subject', 'Subject')}
              </dt>
              <dd className="text-base text-gray-900">{shipment.subject}</dd>
            </div>
          )}

          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">
              {t('shipments.product', 'Product')}
            </dt>
            {isInlineEditing ? (
              <input
                type="text"
                value={editedData.product_text}
                onChange={(e) => handleFieldChange('product_text', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold"
              />
            ) : (
              <dd className="text-base font-semibold text-gray-900">{shipment.product_text}</dd>
            )}
          </div>

          {(shipment.supplier_name || shipment.supplier_id) && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.supplier', 'Supplier')}
              </dt>
              <dd className="text-base text-gray-900">{shipment.supplier_name || shipment.supplier_id}</dd>
            </div>
          )}

          {(shipment.customer_name || shipment.customer_id) && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.customer', 'Customer')}
              </dt>
              <dd className="text-base text-gray-900">{shipment.customer_name || shipment.customer_id}</dd>
            </div>
          )}

          {/* Buyer/Importer - The party receiving the goods for documentation */}
          {(shipment.buyer_company_name || shipment.buyer_name || shipment.buyer_id) && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.buyerImporter', 'Buyer / Importer')}
              </dt>
              <dd className="text-base text-gray-900">{shipment.buyer_company_name || shipment.buyer_name || shipment.buyer_id}</dd>
            </div>
          )}

          {shipment.has_broker && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.brokerName', 'Broker Name')}
              </dt>
              <dd className="text-base text-gray-900">{shipment.broker_name || '—'}</dd>
            </div>
          )}
        </div>
      </Card>

      {/* Step 2: Commercial Terms */}
      <Card>
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ScaleIcon className="h-6 w-6 text-purple-600" />
            {t('shipments.wizard.step2Title', 'Commercial Terms')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shipment.cargo_type && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.cargoType', 'Cargo Type')}
              </dt>
              <dd className="text-base font-semibold text-gray-900">
                {t(`shipments.wizard.cargoTypes.${shipment.cargo_type}`, shipment.cargo_type)}
              </dd>
            </div>
          )}

          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">
              {t('shipments.weight', 'Weight')}
            </dt>
            {isInlineEditing ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  value={editedData.weight_ton}
                  onChange={(e) => handleFieldChange('weight_ton', e.target.value)}
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold"
                />
                <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm">
                  {shipment.weight_unit || 'tons'}
                </span>
              </div>
            ) : (
              <dd className="text-base font-semibold text-gray-900">
                {formatWeight(shipment.weight_ton)} {shipment.weight_unit || 'tons'}
              </dd>
            )}
          </div>

          {/* Dynamic Cargo Display */}
          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">
              {t('shipments.cargo', 'Cargo')}
            </dt>
            {isInlineEditing ? (
              <input
                type="number"
                value={
                  shipment.cargo_type === 'containers' ? editedData.container_count :
                  shipment.cargo_type === 'trucks' ? editedData.truck_count :
                  shipment.cargo_type === 'tankers' ? editedData.barrels :
                  editedData.unit_count || editedData.package_count || ''
                }
                onChange={(e) => {
                  const field = 
                    shipment.cargo_type === 'containers' ? 'container_count' :
                    shipment.cargo_type === 'trucks' ? 'truck_count' :
                    shipment.cargo_type === 'tankers' ? 'barrels' :
                    'unit_count';
                  handleFieldChange(field, e.target.value);
                }}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold"
              />
            ) : (
              <dd className="text-base font-semibold text-gray-900">
                {(() => {
                  const cargoInfo = getCargoDisplay({
                    cargo_type: shipment.cargo_type,
                    tanker_type: shipment.tanker_type,
                    container_count: shipment.container_count,
                    truck_count: shipment.truck_count,
                    barrels: shipment.barrels,
                    unit_count: shipment.unit_count,
                    package_count: shipment.package_count,
                  });
                  return i18n.language === 'ar' ? cargoInfo.displayAr : cargoInfo.displayEn;
                })()}
              </dd>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <dt className="text-sm font-medium text-blue-700 mb-1">
              {(shipment.transaction_type || shipment.direction) === 'incoming' 
                ? t('shipments.wizard.costPerTon', 'Cost per Ton')
                : t('shipments.wizard.sellingPricePerTon', 'Selling Price per Ton')
              }
            </dt>
            {isInlineEditing ? (
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-blue-700 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={editedData.fixed_price_usd_per_ton}
                  onChange={(e) => handleFieldChange('fixed_price_usd_per_ton', e.target.value)}
                  className="w-full ps-8 pe-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-bold bg-white"
                />
              </div>
            ) : (
              <dd className="text-lg font-bold text-blue-900">
                {formatCurrency(shipment.fixed_price_usd_per_ton)}
              </dd>
            )}
          </div>

          {(shipment.transaction_type || shipment.direction) === 'outgoing' && (
            <div className="bg-green-50 p-4 rounded-lg">
              <dt className="text-sm font-medium text-green-700 mb-1">
                {t('shipments.wizard.sellingPricePerTon', 'Selling Price per Ton')}
              </dt>
              {isInlineEditing ? (
                <div className="relative">
                  <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-green-700 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.selling_price_usd_per_ton}
                    onChange={(e) => handleFieldChange('selling_price_usd_per_ton', e.target.value)}
                    className="w-full ps-8 pe-3 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-bold bg-white"
                  />
                </div>
              ) : (
                <dd className="text-lg font-bold text-green-900">
                  {formatCurrency(shipment.selling_price_usd_per_ton) || '—'}
                </dd>
              )}
            </div>
          )}

          {shipment.payment_terms && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.paymentTerms', 'Payment Terms')}
              </dt>
              <dd className="text-base text-gray-900">{shipment.payment_terms}</dd>
            </div>
          )}

          {shipment.incoterms && (
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.wizard.incoterms', 'Incoterms')}
              </dt>
              <dd className="text-base text-gray-900">{shipment.incoterms}</dd>
              </div>
          )}
              </div>
          </Card>

      {/* Step 3: Financial Details */}
      <Card>
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BanknotesIcon className="h-6 w-6 text-green-600" />
            {t('shipments.wizard.step3Title', 'Financial Details')}
          </h2>
        </div>

          {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
            <dt className="text-sm font-medium text-blue-700 mb-2">
              {t('shipments.totalValue', 'Total Value')}
            </dt>
            <dd className="text-2xl font-bold text-blue-900">
              {formatCurrency(shipment.total_value_usd)}
            </dd>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
            <dt className="text-sm font-medium text-green-700 mb-2">
              {t('shipments.paidAmount', 'Paid Amount')}
            </dt>
            <dd className="text-2xl font-bold text-green-900">
              {formatCurrency(shipment.paid_value_usd)}
            </dd>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border border-red-200">
            <dt className="text-sm font-medium text-red-700 mb-2">
              {t('shipments.balance', 'Balance')}
            </dt>
            <dd className="text-2xl font-bold text-red-900">
              {formatCurrency(shipment.balance_value_usd)}
            </dd>
          </div>
        </div>

        {/* Down Payment */}
        {(shipment.down_payment_percentage || shipment.down_payment_amount) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('shipments.wizard.downPayment', 'Down Payment')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shipment.down_payment_percentage && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <dt className="text-sm font-medium text-yellow-700 mb-1">
                    {t('shipments.wizard.downPaymentPercentage', 'Down Payment %')}
                  </dt>
                  <dd className="text-lg font-bold text-yellow-900">
                    {shipment.down_payment_percentage}%
                  </dd>
                </div>
              )}
              {shipment.down_payment_amount && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <dt className="text-sm font-medium text-yellow-700 mb-1">
                    {t('shipments.wizard.downPaymentAmount', 'Down Payment Amount')}
                  </dt>
                  <dd className="text-lg font-bold text-yellow-900">
                    {formatCurrency(shipment.down_payment_amount)}
                  </dd>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Method */}
        {shipment.payment_method && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('shipments.wizard.paymentMethod', 'Payment Method')}
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <Badge color="blue" size="md">
                {t(`shipments.wizard.paymentMethods.${shipment.payment_method}`, shipment.payment_method)}
              </Badge>
              {shipment.swift_code && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-medium text-gray-500">SWIFT Code</dt>
                    <dd className="text-sm font-mono text-gray-900">{shipment.swift_code}</dd>
                  </div>
                  {shipment.beneficiary_bank_name && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        {t('shipments.wizard.beneficiaryBank', 'Beneficiary Bank')}
                      </dt>
                      <dd className="text-sm text-gray-900">{shipment.beneficiary_bank_name}</dd>
                    </div>
                  )}
                  {shipment.beneficiary_account_number && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        {t('shipments.wizard.accountNumber', 'Account Number')}
                      </dt>
                      <dd className="text-sm font-mono text-gray-900">{shipment.beneficiary_account_number}</dd>
                    </div>
                  )}
                  {shipment.beneficiary_iban && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">IBAN</dt>
                      <dd className="text-sm font-mono text-gray-900">{shipment.beneficiary_iban}</dd>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        {paymentSchedule && paymentSchedule.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('shipments.wizard.paymentSchedule', 'Payment Schedule')}
            </h3>
            <div className="space-y-3">
              {paymentSchedule.map((payment: any, index: number) => (
                <div key={index} className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">{payment.description}</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {t('shipments.wizard.dueDate', 'Due Date')}: {formatDateString(payment.due_date)}
                    </p>
                  </div>
                  <div className="text-lg font-bold text-blue-900">
                    {formatCurrency(payment.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Costs */}
        {additionalCosts && additionalCosts.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {t('shipments.wizard.additionalCosts', 'Additional Costs')}
            </h3>
            <div className="space-y-2">
              {additionalCosts.map((cost: any, index: number) => (
                <div key={index} className="bg-orange-50 p-3 rounded-lg border border-orange-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-900">{cost.description}</span>
                  <span className="text-base font-bold text-orange-900">{formatCurrency(cost.amount)}</span>
              </div>
              ))}
              </div>
              </div>
        )}
          </Card>

      {/* Step 4: Logistics Details */}
      <Card>
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <TruckIcon className="h-6 w-6 text-indigo-600" />
            {t('shipments.wizard.step4Title', 'Logistics Details')}
          </h2>
        </div>

        {/* Port & Shipping Line */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="flex items-start gap-3">
            <MapPinIcon className="h-5 w-5 text-blue-600 mt-1" />
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.origin', 'Origin Port')} (POL)
              </dt>
              <dd className="text-base font-semibold text-gray-900">
                  {shipment.pol_name ? `${shipment.pol_name}, ${shipment.pol_country}` : '—'}
                </dd>
              </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPinIcon className="h-5 w-5 text-green-600 mt-1" />
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.destination', 'Destination Port')} (POD)
              </dt>
              <dd className="text-base font-semibold text-gray-900">
                  {shipment.pod_name ? `${shipment.pod_name}, ${shipment.pod_country}` : '—'}
                </dd>
              </div>
          </div>

          <div className="flex items-start gap-3">
            <BuildingOfficeIcon className="h-5 w-5 text-purple-600 mt-1" />
            <div>
              <dt className="text-sm font-medium text-gray-500 mb-1">
                {t('shipments.shippingLine', 'Shipping Line')}
              </dt>
              <dd className="text-base font-semibold text-gray-900">
                {shipment.shipping_line_name || '—'}
              </dd>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <dt className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              {t('shipments.etd', 'ETD')}
            </dt>
            {isInlineEditing ? (
              <DateInput
                value={editedData.etd}
                onChange={(val) => handleFieldChange('etd', val)}
                className="w-full border-blue-300 focus:ring-blue-500 focus:border-blue-500 text-sm font-bold bg-white"
              />
            ) : (
              <dd className="text-base font-bold text-blue-900">
                {formatDateString(shipment.etd) || '—'}
              </dd>
            )}
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <dt className="text-sm font-medium text-green-700 mb-1 flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              {t('shipments.eta', 'ETA')}
            </dt>
            {isInlineEditing ? (
              <DateInput
                value={editedData.eta}
                onChange={(val) => handleFieldChange('eta', val)}
                className="w-full border-green-300 focus:ring-green-500 focus:border-green-500 text-sm font-bold bg-white"
              />
            ) : (
              <dd className="text-base font-bold text-green-900">
                {formatDateString(shipment.eta) || '—'}
              </dd>
            )}
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">
              {t('shipments.bookingNo', 'Booking Number')}
            </dt>
            {isInlineEditing ? (
              <input
                type="text"
                value={editedData.booking_no}
                onChange={(e) => handleFieldChange('booking_no', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono"
              />
            ) : (
              <dd className="text-base font-mono text-gray-900">{shipment.booking_no || '—'}</dd>
            )}
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500 mb-1">
              {t('shipments.blNo', 'B/L Number')}
            </dt>
            {isInlineEditing ? (
              <input
                type="text"
                value={editedData.bl_no}
                onChange={(e) => handleFieldChange('bl_no', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono"
              />
            ) : (
              <dd className="text-base font-mono text-gray-900">{shipment.bl_no || '—'}</dd>
            )}
          </div>
        </div>

        {/* Enable/Disable Split Shipment Mode (Edit Mode Only) */}
        {isInlineEditing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="split-shipment-toggle-edit"
                checked={editedData.is_split_shipment || false}
                onChange={(e) => {
                  handleFieldChange('is_split_shipment', e.target.checked);
                  // If enabling split shipment and no batches exist, add first batch
                  if (e.target.checked && (!editedData.batches || editedData.batches.length === 0)) {
                    handleAddBatch();
                  }
                }}
                className="mt-1 h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1">
                <label
                  htmlFor="split-shipment-toggle-edit"
                  className="text-sm font-semibold text-gray-900 cursor-pointer"
                >
                  📦 {t('shipments.wizard.splitIntoMultipleBatches', 'Split into Multiple Batches')}
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  {t(
                    'shipments.wizard.splitShipmentHint',
                    'Enable this if your order is shipped in multiple batches with different vessels, containers, or dates.'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Split Shipment / Batches */}
        {(isInlineEditing ? editedData.is_split_shipment && editedData.batches?.length > 0 : shipment.is_split_shipment && batches && batches.length > 0) ? (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-900">
                📦 {t('shipments.wizard.splitShipment', 'Split Shipment')} - {(isInlineEditing ? editedData.batches?.length : batches.length)} {t('shipments.wizard.batches', 'Batches')}
              </p>
              {isInlineEditing && (
                <button
                  type="button"
                  onClick={handleAddBatch}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  <PlusIcon className="h-4 w-4 me-1" />
                  {t('shipments.wizard.addBatch', 'Add Batch')}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {(isInlineEditing ? editedData.batches : batches).map((batch: any) => (
                <div key={batch.id} className={`border-2 rounded-lg p-5 ${isInlineEditing ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                        {batch.batch_number}
                      </span>
                      {isInlineEditing ? (
                        <input
                          type="text"
                          value={batch.batch_name}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'batch_name', e.target.value)}
                          className="px-3 py-1 border border-blue-300 rounded-md font-bold text-lg flex-1 max-w-xs"
                          placeholder={`Batch ${batch.batch_number}`}
                        />
                      ) : (
                        <span className="font-bold text-lg text-gray-900">
                          {batch.batch_name || `${t('shipments.wizard.batch', 'Batch')} ${batch.batch_number}`}
                        </span>
                      )}
                      {isInlineEditing ? (
                        <select
                          value={batch.status}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'status', e.target.value)}
                          className="px-3 py-1 border border-blue-300 rounded-md text-sm font-medium"
                        >
                          <option value="planning">Planning</option>
                          <option value="in_transit">In Transit</option>
                          <option value="arrived">Arrived</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      ) : (
                        <Badge color={batch.status === 'delivered' ? 'green' : batch.status === 'in_transit' ? 'blue' : 'gray'}>
                          {batch.status}
                        </Badge>
                      )}
                    </div>
                    {isInlineEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBatch(batch.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Remove batch"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Weight */}
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">
                        {t('shipments.weight', 'Weight (tons)')}
                      </dt>
                      {isInlineEditing ? (
                        <input
                          type="number"
                          step="0.001"
                          value={batch.weight_ton}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'weight_ton', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm"
                        />
                      ) : (
                        <dd className="text-sm font-semibold text-gray-900">
                          {formatNumber(batch.weight_ton)} tons
                        </dd>
                      )}
                    </div>

                    {/* Containers */}
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">
                        {t('shipments.containers', 'Containers')}
                      </dt>
                      {isInlineEditing ? (
                        <input
                          type="number"
                          value={batch.container_count}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'container_count', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm"
                        />
                      ) : (
                        <dd className="text-sm font-semibold text-gray-900">
                          {formatNumber(batch.container_count) || '—'}
                        </dd>
                      )}
                    </div>

                    {/* ETD */}
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">ETD</dt>
                      {isInlineEditing ? (
                        <DateInput
                          value={batch.etd}
                          onChange={(val) => handleBatchFieldChange(batch.id, 'etd', val)}
                          className="w-full border-blue-300"
                        />
                      ) : (
                        <dd className="text-sm font-semibold text-gray-900">
                          {formatDateString(batch.etd) || '—'}
                        </dd>
                      )}
                    </div>

                    {/* ETA */}
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">ETA</dt>
                      {isInlineEditing ? (
                        <DateInput
                          value={batch.eta}
                          onChange={(val) => handleBatchFieldChange(batch.id, 'eta', val)}
                          className="w-full border-blue-300"
                        />
                      ) : (
                        <dd className="text-sm font-semibold text-gray-900">
                          {formatDateString(batch.eta) || '—'}
                        </dd>
                      )}
                    </div>

                    {/* Vessel Name */}
                    <div className="col-span-2">
                      <dt className="text-xs font-medium text-gray-500 mb-1">
                        {t('shipments.wizard.vesselName', 'Vessel Name')}
                      </dt>
                      {isInlineEditing ? (
                        <input
                          type="text"
                          value={batch.vessel_name}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'vessel_name', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm"
                          placeholder="Enter vessel name"
                        />
                      ) : (
                        <dd className="text-sm font-semibold text-gray-900">
                          {batch.vessel_name || '—'}
                        </dd>
                      )}
                    </div>

                    {/* Container Number */}
                    <div className="col-span-2">
                      <dt className="text-xs font-medium text-gray-500 mb-1">
                        {t('shipments.wizard.containerNumber', 'Container Number')}
                      </dt>
                      {isInlineEditing ? (
                        <input
                          type="text"
                          value={batch.container_number}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'container_number', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm font-mono"
                          placeholder="Enter container number"
                        />
                      ) : (
                        <dd className="text-sm font-mono text-gray-900">
                          {batch.container_number || '—'}
                        </dd>
                      )}
                    </div>

                    {/* Booking No */}
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">
                        {t('shipments.bookingNo', 'Booking No')}
                      </dt>
                      {isInlineEditing ? (
                        <input
                          type="text"
                          value={batch.booking_no}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'booking_no', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm"
                        />
                      ) : (
                        <dd className="text-sm text-gray-900">
                          {batch.booking_no || '—'}
                        </dd>
                      )}
                    </div>

                    {/* B/L No */}
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">
                        {t('shipments.blNo', 'B/L No')}
                      </dt>
                      {isInlineEditing ? (
                        <input
                          type="text"
                          value={batch.bl_no}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'bl_no', e.target.value)}
                          className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm"
                        />
                      ) : (
                        <dd className="text-sm text-gray-900">
                          {batch.bl_no || '—'}
                        </dd>
                      )}
                    </div>

                    {/* Truck Plate (if applicable) */}
                    {(isInlineEditing || batch.truck_plate_number) && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500 mb-1">
                          {t('shipments.wizard.truckPlate', 'Truck Plate')}
                        </dt>
                        {isInlineEditing ? (
                          <input
                            type="text"
                            value={batch.truck_plate_number}
                            onChange={(e) => handleBatchFieldChange(batch.id, 'truck_plate_number', e.target.value)}
                            className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm"
                          />
                        ) : (
                          <dd className="text-sm text-gray-900">
                            {batch.truck_plate_number || '—'}
                          </dd>
                        )}
                      </div>
                    )}

                    {/* Tanker Name (if applicable) */}
                    {(isInlineEditing || batch.tanker_name) && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500 mb-1">
                          {t('shipments.wizard.tankerName', 'Tanker')}
                        </dt>
                        {isInlineEditing ? (
                          <input
                            type="text"
                            value={batch.tanker_name}
                            onChange={(e) => handleBatchFieldChange(batch.id, 'tanker_name', e.target.value)}
                            className="w-full px-2 py-1 border border-blue-300 rounded-md text-sm"
                          />
                        ) : (
                          <dd className="text-sm text-gray-900">
                            {batch.tanker_name || '—'}
                          </dd>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Batch Documents */}
                  {batch.documents && batch.documents.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <dt className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <DocumentTextIcon className="h-4 w-4" />
                        {t('documents.title', 'Documents')} ({batch.documents.length})
                      </dt>
                      <div className="flex flex-wrap gap-2">
                        {batch.documents.map((doc: any) => (
                          <Badge key={doc.id} color="purple" size="sm">
                            {doc.fileName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Batch Notes */}
                  {(isInlineEditing || batch.notes) && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <dt className="text-xs font-medium text-gray-500 mb-2">
                        {t('common.notes', 'Notes')}
                      </dt>
                      {isInlineEditing ? (
                        <textarea
                          value={batch.notes}
                          onChange={(e) => handleBatchFieldChange(batch.id, 'notes', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
                          placeholder="Add notes for this batch..."
                        />
                      ) : (
                        <p className="text-sm text-gray-700 italic">{batch.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Single Shipment Tracking */
          <div>
            {bolNumbers && bolNumbers.length > 0 && (
              <div className="mb-4">
                <dt className="text-sm font-medium text-gray-700 mb-2">
                  {t('shipments.wizard.bolNumbers', 'BOL Numbers')}
                </dt>
                <div className="flex flex-wrap gap-2">
                  {bolNumbers.map((bol: string, index: number) => (
                    <Badge key={index} color="blue" size="sm">
                      {bol}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(shipment.vessel_name || shipment.container_number || shipment.truck_plate_number || shipment.tanker_name) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {shipment.vessel_name && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">
                      {t('shipments.wizard.vesselName', 'Vessel Name')}
                    </dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {shipment.vessel_name} {shipment.vessel_imo && `(IMO: ${shipment.vessel_imo})`}
                    </dd>
                  </div>
                )}

                {shipment.container_number && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">
                      {t('shipments.wizard.containerNumber', 'Container Number')}
                    </dt>
                    <dd className="text-sm font-mono text-gray-900">{shipment.container_number}</dd>
                  </div>
                )}

                {shipment.truck_plate_number && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">
                      {t('shipments.wizard.truckPlate', 'Truck Plate')}
                    </dt>
                    <dd className="text-sm font-mono text-gray-900">
                      {shipment.truck_plate_number} {shipment.cmr && `(CMR: ${shipment.cmr})`}
                    </dd>
                  </div>
                )}

                {shipment.tanker_name && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">
                      {t('shipments.wizard.tankerName', 'Tanker Name')}
                    </dt>
                    <dd className="text-sm font-semibold text-gray-900">
                      {shipment.tanker_name} {shipment.tanker_imo && `(IMO: ${shipment.tanker_imo})`}
                    </dd>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Route Information */}
      <Card>
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPinIcon className="h-6 w-6 text-purple-600" />
            {t('shipments.routeInfo', 'Route Information')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* International Route */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
              🚢 {t('shipments.internationalRoute', 'International Route')}
            </h3>
            <div className="flex items-center gap-2 text-lg font-medium text-gray-900" dir="ltr">
              <span>{shipment.pol_name || t('common.notSet', 'Not set')}</span>
              <span className="text-blue-600">→</span>
              <span>{shipment.pod_name || t('common.notSet', 'Not set')}</span>
            </div>
            {shipment.pol_country && shipment.pod_country && (
              <p className="text-sm text-gray-600 mt-1">
                {shipment.pol_country} → {shipment.pod_country}
              </p>
            )}
          </div>

          {/* Internal Route */}
          <div className={`border rounded-lg p-4 ${
            shipment.is_cross_border 
              ? 'bg-amber-50 border-amber-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
              shipment.is_cross_border ? 'text-amber-800' : 'text-green-800'
            }`}>
              🚛 {t('shipments.internalRoute', 'Internal Route')}
              {shipment.is_cross_border && (
                <Badge color="amber" size="sm">{t('shipments.crossBorder', 'Cross-Border')}</Badge>
              )}
            </h3>
            <div className="flex items-center gap-2 text-lg font-medium text-gray-900 flex-wrap" dir="ltr">
              <span>{shipment.pod_name || t('common.notSet', 'Not set')}</span>
              {shipment.is_cross_border && shipment.primary_border_name && (
                <>
                  <span className="text-amber-600">→</span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm">
                    🚧 {shipment.primary_border_name}
                  </span>
                </>
              )}
              <span className={shipment.is_cross_border ? 'text-amber-600' : 'text-green-600'}>
                →
              </span>
              <span>
                {finalDestInfo.displayText || t('common.notSet', 'Not set')}
              </span>
            </div>

            {/* Border Crossing Info */}
            {shipment.is_cross_border && shipment.primary_border_name && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">{t('shipments.borderCrossing', 'Border Crossing')}:</span>{' '}
                  {isRtl && shipment.primary_border_name_ar 
                    ? shipment.primary_border_name_ar 
                    : shipment.primary_border_name}
                </p>
                {shipment.border_country_from && shipment.border_country_to && (
                  <p className="text-xs text-amber-600 mt-1">
                    {shipment.border_country_from} → {shipment.border_country_to}
                  </p>
                )}
              </div>
            )}

            {/* Transport Mode */}
            {shipment.internal_transport_mode && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">{t('shipments.transportMode', 'Transport')}:</span>{' '}
                {shipment.internal_transport_mode === 'truck' ? '🚛 Truck' :
                 shipment.internal_transport_mode === 'rail' ? '🚂 Rail' :
                 shipment.internal_transport_mode === 'sea' ? '🚢 Sea' :
                 shipment.internal_transport_mode === 'air' ? '✈️ Air' :
                 shipment.internal_transport_mode}
              </p>
            )}
          </div>
        </div>

        {/* Transit Countries (rare) */}
        {shipment.transit_countries && shipment.transit_countries.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{t('shipments.transitCountries', 'Transit Countries')}:</span>{' '}
              {shipment.transit_countries.join(' → ')}
            </p>
          </div>
        )}
      </Card>

      {/* Documents Section */}
      {shipment?.id && (
        <DocumentPanel
          entityType="shipment"
          entityId={shipment.id}
          entityRef={shipment.sn}
          readOnly={false}
        />
      )}

      {/* Financial Transactions */}
      {shipment?.id && (
        <TransactionsPanel
          entityType="shipment"
          entityId={shipment.id}
          entityRef={shipment.sn}
        />
      )}

      {/* Elleçleme History */}
      {shipment?.id && (
        <ElleclemeHistoryPanel
          shipmentId={shipment.id}
          shipmentSn={shipment.sn}
        />
      )}

      {/* Notes */}
      <Card>
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('common.notes', 'Notes')}
          </h2>
        </div>
        {isInlineEditing ? (
          <textarea
            value={editedData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
            placeholder={t('shipments.wizard.notesPlaceholder', 'Add notes...')}
          />
        ) : (
          <p className="text-gray-700 whitespace-pre-wrap">{shipment.notes || '—'}</p>
        )}
      </Card>

      {/* Audit Information */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
          <div>
            <dt className="font-medium">{t('shipments.createdAt', 'Created At')}</dt>
            <dd className="mt-1">{formatDateString(shipment.created_at)}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('shipments.updatedAt', 'Updated At')}</dt>
            <dd className="mt-1">{formatDateString(shipment.updated_at)}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('shipments.createdBy', 'Created By')}</dt>
            <dd className="mt-1">{shipment.created_by || '—'}</dd>
          </div>
        </div>
      </Card>

      {/* Edit Confirmation Dialog */}
      <Transition appear show={showConfirmEdit} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConfirmEdit(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                    </div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      {t('shipments.confirmEdit', 'Confirm Edit')}
                    </Dialog.Title>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-gray-600">
                      {t('shipments.confirmEditMessage', 'Are you sure you want to edit this shipment? You will be able to modify all details including batches, financial information, and logistics.')}
                    </p>
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-blue-900">
                        {shipment.sn}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {shipment.product_text}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setShowConfirmEdit(false)}
                      className="flex-1"
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={confirmEdit}
                      className="flex-1"
                    >
                      {t('common.confirm', 'Confirm')}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Edit Shipment Wizard */}
      {showEditWizard && (
        <EditShipmentWizard
          isOpen={showEditWizard}
          onClose={() => setShowEditWizard(false)}
          shipment={shipment}
          onSuccess={() => {
            setShowEditWizard(false);
            refetch(); // Refresh shipment data
          }}
        />
      )}

      {/* Contract Comparison Modal */}
      {shipment?.contract_id && (
        <ContractComparisonModal
          isOpen={showComparisonModal}
          onClose={() => setShowComparisonModal(false)}
          contractId={shipment.contract_id}
          shipmentId={shipment.id}
        />
      )}

      {/* Audit Log Viewer */}
      {shipment?.id && (
        <AuditLogViewer
          isOpen={showAuditLog}
          onClose={() => setShowAuditLog(false)}
          entityType="shipment"
          entityId={shipment.id}
        />
      )}

      {/* Transfer Order Modal */}
      <TransferOrderModal
        isOpen={showTransferOrderModal}
        onClose={() => setShowTransferOrderModal(false)}
        supplier={supplier}
        shipment={shipment}
      />
      </div>
  );
}

