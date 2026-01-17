/**
 * Shipment Final Report Page
 * End-to-end shipment lifecycle view with collapsible sections
 * Redesigned from ShipmentDetailPage for better information density control
 */

import { useState, Fragment, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useQuery } from '@tanstack/react-query';
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
  CurrencyDollarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ChatBubbleBottomCenterTextIcon,
  Bars3Icon,
  PrinterIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { useShipment } from '../hooks/useShipments';
import { useContract } from '../hooks/useContracts';
import { shipmentsService } from '../services/shipments';
import { Spinner } from '../components/common/Spinner';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { CollapsibleSection, useCollapsibleSections } from '../components/common/CollapsibleSection';
import { ShipmentTimeline } from '../components/shipments/ShipmentTimeline';
import { EditShipmentWizard } from '../components/shipments/EditShipmentWizard';
import { ContractComparisonModal } from '../components/shipments/ContractComparisonModal';
import { AuditLogViewer } from '../components/audit/AuditLogViewer';
import { DemurrageStatusBadge } from '../components/shipments/DemurrageStatusBadge';
import { DocumentPanel } from '../components/documents';
import { TransactionsPanel } from '../components/finance';
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
import type { Company, FieldComparison } from '../types/api';

// Section IDs for collapsible management
const SECTION_IDS = [
  'basic-info',
  'product-lines',
  'commercial-terms',
  'international-logistics',
  'domestic-logistics',
  'financial-accounting',
  'documents',
  'quality-notes',
] as const;

type SectionId = typeof SECTION_IDS[number];

export function ShipmentFinalReport() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: shipment, isLoading, error, refetch } = useShipment(id);
  const { data: contract } = useContract(shipment?.contract_id || '');
  
  // Fetch shipment product lines
  const { data: linesData } = useQuery({
    queryKey: ['shipment-lines', id],
    queryFn: () => shipmentsService.getLines(id!),
    enabled: !!id,
  });
  
  // Modal states
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showConfirmEdit, setShowConfirmEdit] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showTransferOrderModal, setShowTransferOrderModal] = useState(false);
  const [supplier, setSupplier] = useState<Company | null>(null);
  
  // Inline edit states
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Comparison view state - shows Contract (Planned) vs Shipment (Actual) side-by-side
  const [showComparisonView, setShowComparisonView] = useState(false);
  
  // Fetch contract comparison data when comparison view is enabled
  const { data: comparisonData, isLoading: isLoadingComparison } = useQuery({
    queryKey: ['contract-comparison', id],
    queryFn: () => shipmentsService.getContractComparison(id!),
    enabled: !!id && showComparisonView && !!shipment?.contract_id,
  });
  
  // Collapsible sections management
  const {
    toggleSection,
    expandAll,
    collapseAll,
    isSectionExpanded,
    allExpanded,
    allCollapsed,
  } = useCollapsibleSections([...SECTION_IDS], false);

  // Fetch supplier data
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

  // Parse batches and other data
  const batches = useMemo(() => {
    if (!shipment?.batches) return [];
    return typeof shipment.batches === 'string' 
      ? JSON.parse(shipment.batches) 
      : shipment.batches;
  }, [shipment?.batches]);
  
  const paymentSchedule = shipment?.payment_schedule || [];
  const additionalCosts = shipment?.additional_costs || [];
  const bolNumbers = shipment?.bol_numbers || [];
  
  // Calculate unit price from lines (or use fixed_price_usd_per_ton as fallback)
  const unitPriceDisplay = useMemo(() => {
    // First try to get from lines
    if (linesData?.lines && linesData.lines.length > 0) {
      const firstLine = linesData.lines[0];
      const unitPrice = firstLine.unit_price || firstLine.rate_usd_per_mt;
      if (unitPrice && unitPrice > 0) {
        const currency = firstLine.currency_code || 'USD';
        const pricingMethod = firstLine.pricing_method || 'per_mt';
        const unitLabel = pricingMethod === 'per_mt' ? '/MT' : 
                         pricingMethod === 'per_kg' ? '/kg' :
                         pricingMethod === 'per_package' ? '/pkg' :
                         pricingMethod === 'per_barrel' ? '/bbl' : '/unit';
        return `${currency === 'USD' ? '$' : currency + ' '}${formatNumber(unitPrice)}${unitLabel}`;
      }
    }
    // Fallback to fixed_price_usd_per_ton
    if (shipment?.fixed_price_usd_per_ton) {
      return `${formatCurrency(shipment.fixed_price_usd_per_ton)}/ton`;
    }
    return null;
  }, [linesData, shipment?.fixed_price_usd_per_ton]);

  // Calculate total value from lines (or use shipment.total_value_usd as fallback)
  const totalValueDisplay = useMemo(() => {
    // First try to get from lines data
    if (linesData?.total_value && linesData.total_value > 0) {
      return linesData.total_value;
    }
    // Calculate from individual lines if total not provided
    if (linesData?.lines && linesData.lines.length > 0) {
      const sum = linesData.lines.reduce((acc, line) => acc + (Number(line.amount_usd) || 0), 0);
      if (sum > 0) return sum;
    }
    // Fallback to shipment.total_value_usd
    if (shipment?.total_value_usd) {
      return Number(shipment.total_value_usd);
    }
    return null;
  }, [linesData, shipment?.total_value_usd]);

  // Helper to get comparison value for a field from comparisonData
  const getComparisonField = (fieldName: string): FieldComparison | undefined => {
    if (!comparisonData?.header) return undefined;
    return comparisonData.header.find(f => f.field_name === fieldName);
  };

  // Edit handlers
  const handleEditClick = () => setShowConfirmEdit(true);
  const confirmEdit = () => {
    setShowConfirmEdit(false);
    setShowEditWizard(true);
  };

  const handleInlineEditStart = () => {
    const extractDate = (dateString: string | null | undefined): string => {
      if (!dateString) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
      return dateString.split('T')[0];
    };
    
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
      batches: batches,
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
      const updateData = {
        ...editedData,
        customs_clearance_date: editedData.customs_clearance_date || null,
        etd: editedData.etd || null,
        eta: editedData.eta || null,
      };
      
      await updateShipment(id, updateData);
      setIsInlineEditing(false);
      setEditedData({});
      // Invalidate both shipment and shipment-lines queries to refresh all data
      await queryClient.invalidateQueries({ queryKey: ['shipment', id] });
      await queryClient.invalidateQueries({ queryKey: ['shipment-lines', id] });
      await queryClient.refetchQueries({ queryKey: ['shipment', id] });
      await queryClient.refetchQueries({ queryKey: ['shipment-lines', id] });
    } catch (error: any) {
      setSaveError(error.response?.data?.message || error.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedData((prev: any) => ({ ...prev, [field]: value }));
  };

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // Ensure section is expanded
      if (!isSectionExpanded(sectionId as SectionId)) {
        toggleSection(sectionId);
      }
      // Scroll with offset for sticky header
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
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

  // Summary generators for collapsed states
  const getBasicInfoSummary = () => {
    const parts = [];
    if (shipment.supplier_name) parts.push(shipment.supplier_name);
    if (shipment.customer_name) parts.push(`→ ${shipment.customer_name}`);
    if (shipment.product_text) parts.push(shipment.product_text);
    if (shipment.weight_ton) parts.push(`${formatWeight(shipment.weight_ton)} ${shipment.weight_unit || 'tons'}`);
    return parts.join(' • ') || t('shipments.noData', 'No data');
  };

  const getCommercialSummary = () => {
    const parts = [];
    if (shipment.incoterms) parts.push(shipment.incoterms);
    if (shipment.payment_terms) parts.push(shipment.payment_terms);
    if (shipment.fixed_price_usd_per_ton) parts.push(`${formatCurrency(shipment.fixed_price_usd_per_ton)}/ton`);
    return parts.join(' • ') || t('shipments.noTermsSet', 'No terms set');
  };

  const getLogisticsSummary = () => {
    const parts = [];
    if (shipment.pol_name && shipment.pod_name) {
      parts.push(`${shipment.pol_name} → ${shipment.pod_name}`);
    }
    if (shipment.eta) parts.push(`ETA: ${formatDateString(shipment.eta)}`);
    if (shipment.bl_no) parts.push(`B/L: ${shipment.bl_no}`);
    return parts.join(' • ') || t('shipments.noLogisticsData', 'No logistics data');
  };

  const getFinancialSummary = () => {
    const parts = [];
    if (totalValueDisplay) parts.push(`${t('common.total')}: ${formatCurrency(totalValueDisplay)}`);
    if (shipment.paid_value_usd) parts.push(`${t('common.paid')}: ${formatCurrency(shipment.paid_value_usd)}`);
    if (shipment.balance_value_usd) parts.push(`${t('common.balance')}: ${formatCurrency(shipment.balance_value_usd)}`);
    return parts.join(' • ') || t('shipments.noFinancialData', 'No financial data');
  };

  // ============================================
  // Section Theme Helpers - Based on Data Completeness
  // Green = Complete, Amber = Partial, Red = Missing
  // ============================================
  
  const getBasicInfoTheme = (): 'green' | 'amber' | 'red' => {
    const requiredFields = [shipment.sn, shipment.product_text];
    const optionalFields = [shipment.supplier_name || shipment.customer_name, shipment.weight_ton];
    
    const requiredComplete = requiredFields.every(f => f);
    const optionalComplete = optionalFields.filter(f => f).length;
    
    if (!requiredComplete) return 'red';
    if (optionalComplete >= optionalFields.length) return 'green';
    return 'amber';
  };

  const getProductLinesTheme = (): 'green' | 'amber' | 'red' => {
    const hasProduct = !!shipment.product_text;
    const hasQuantity = !!shipment.weight_ton;
    const hasPrice = !!shipment.fixed_price_usd_per_ton;
    
    if (!hasProduct && !hasQuantity) return 'red';
    if (hasProduct && hasQuantity && hasPrice) return 'green';
    return 'amber';
  };

  const getCommercialTheme = (): 'green' | 'amber' | 'red' => {
    const hasIncoterms = !!shipment.incoterms;
    const hasPaymentTerms = !!shipment.payment_terms;
    const hasPrice = !!shipment.fixed_price_usd_per_ton;
    
    const completedFields = [hasIncoterms, hasPaymentTerms, hasPrice].filter(Boolean).length;
    
    if (completedFields === 0) return 'red';
    if (completedFields === 3) return 'green';
    return 'amber';
  };

  const getInternationalLogisticsTheme = (): 'green' | 'amber' | 'red' => {
    const hasPOL = !!shipment.pol_name;
    const hasPOD = !!shipment.pod_name;
    const hasETD = !!shipment.etd;
    const hasETA = !!shipment.eta;
    const hasBL = !!shipment.bl_no;
    
    const completedFields = [hasPOL, hasPOD, hasETD, hasETA, hasBL].filter(Boolean).length;
    
    if (completedFields === 0) return 'red';
    if (completedFields >= 4) return 'green';
    return 'amber';
  };

  const getDomesticLogisticsTheme = (): 'green' | 'amber' | 'red' => {
    const hasFinalDestination = finalDestInfo.isSet;
    const hasInternalRoute = !!shipment.is_cross_border || hasFinalDestination;
    
    if (!hasFinalDestination && !hasInternalRoute) return 'red';
    if (hasFinalDestination) return 'green';
    return 'amber';
  };

  const getFinancialTheme = (): 'green' | 'amber' | 'red' => {
    const hasValue = !!totalValueDisplay && Number(totalValueDisplay) > 0;
    const hasPaid = !!shipment.paid_value_usd && Number(shipment.paid_value_usd) > 0;
    
    if (!hasValue) return 'red';
    if (hasValue && hasPaid) return 'green';
    return 'amber';
  };

  const getDocumentsTheme = (): 'green' | 'amber' | 'red' => {
    const docCount = shipment.document_count || 0;
    
    if (docCount === 0) return 'red';
    if (docCount >= 3) return 'green'; // Assume 3+ docs means well documented
    return 'amber';
  };

  const getQualityNotesTheme = (): 'green' | 'amber' | 'red' => {
    const hasNotes = !!shipment.notes && shipment.notes.trim().length > 0;
    
    // Notes are optional, so no notes is amber, having notes is green
    if (hasNotes) return 'green';
    return 'amber';
  };

  // ============================================
  // Internal Card Color Helpers - Based on Data Availability
  // Returns Tailwind classes for card styling
  // ============================================
  
  const getCardClasses = (hasData: boolean, variant: 'card' | 'label' | 'value' = 'card') => {
    if (variant === 'card') {
      return hasData 
        ? 'bg-green-50 border border-green-200 rounded-lg'
        : 'bg-amber-50 border border-amber-200 rounded-lg';
    }
    if (variant === 'label') {
      return hasData
        ? 'text-xs font-medium text-green-700 uppercase tracking-wide'
        : 'text-xs font-medium text-amber-700 uppercase tracking-wide';
    }
    // value
    return hasData
      ? 'text-lg font-semibold text-green-900 mt-1'
      : 'text-lg font-semibold text-amber-700 mt-1';
  };

  const getFieldBg = (hasData: boolean) => hasData 
    ? 'bg-green-50 border-green-200' 
    : 'bg-amber-50 border-amber-200';

  const getFieldText = (hasData: boolean) => hasData 
    ? 'text-green-900' 
    : 'text-amber-700';

  const getFieldLabel = (hasData: boolean) => hasData 
    ? 'text-green-700' 
    : 'text-amber-700';

  return (
    <div className="space-y-6 pb-8">
      {/* Sticky Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Back button and title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {shipment.sn}
                <Badge color={getStatusColor(shipment.status) as any} size="md">
                  {isRtl ? statusToArabic(shipment.status) : shipment.status}
                </Badge>
              </h1>
              {shipment.subject && (
                <p className="text-sm text-gray-500 mt-0.5">{shipment.subject}</p>
              )}
            </div>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Expand/Collapse All */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={expandAll}
                disabled={allExpanded}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1
                  ${allExpanded ? 'bg-gray-100 text-gray-400' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <ChevronDownIcon className="w-4 h-4" />
                {t('common.expandAll', 'Expand All')}
              </button>
              <div className="w-px h-6 bg-gray-200" />
              <button
                onClick={collapseAll}
                disabled={allCollapsed}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1
                  ${allCollapsed ? 'bg-gray-100 text-gray-400' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <ChevronUpIcon className="w-4 h-4" />
                {t('common.collapseAll', 'Collapse All')}
              </button>
            </div>

            {!isInlineEditing ? (
              <>
                {/* Comparison View Toggle - Only show if shipment has a linked contract */}
                {shipment?.contract_id && (
                  <button
                    onClick={() => setShowComparisonView(!showComparisonView)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors
                      ${showComparisonView 
                        ? 'bg-amber-100 text-amber-800 border-amber-300' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    title={t('shipments.comparisonView', 'Toggle Contract vs Shipment comparison view')}
                  >
                    <ScaleIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {showComparisonView 
                        ? t('shipments.hideComparison', 'Hide Comparison') 
                        : t('shipments.showComparison', 'Show Comparison')}
                    </span>
                  </button>
                )}
                {shipment?.contract_id && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setShowComparisonModal(true)}
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    <span className="hidden sm:inline ms-1">{t('shipments.compare', 'Compare')}</span>
                  </Button>
                )}
                <Button 
                  variant="secondary"
                  size="sm" 
                  onClick={() => setShowAuditLog(true)}
                >
                  <ClipboardDocumentListIcon className="h-4 w-4" />
                  <span className="hidden sm:inline ms-1">{t('shipments.history', 'History')}</span>
                </Button>
                {shipment?.supplier_id && (
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowTransferOrderModal(true)}
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  >
                    <CurrencyDollarIcon className="h-4 w-4" />
                    <span className="hidden sm:inline ms-1">{t('shipments.transfer', 'Transfer')}</span>
                  </Button>
                )}
                <Button 
                  variant="secondary"
                  size="sm" 
                  onClick={handleInlineEditStart}
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  <span className="hidden sm:inline ms-1">{t('shipments.quickEdit', 'Quick Edit')}</span>
                </Button>
                <Button 
                  variant="primary"
                  size="sm" 
                  onClick={handleEditClick}
                >
                  <PencilIcon className="h-4 w-4" />
                  <span className="hidden sm:inline ms-1">{t('shipments.edit', 'Edit')}</span>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="secondary"
                  size="sm" 
                  onClick={handleInlineEditCancel}
                  disabled={isSaving}
                >
                  <XMarkIcon className="h-4 w-4" />
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  variant="primary"
                  size="sm" 
                  onClick={handleInlineEditSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Spinner size="sm" className="me-1" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  {t('common.save', 'Save')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Error/Edit mode indicators */}
        {saveError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{saveError}</p>
          </div>
        )}
        {isInlineEditing && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <PencilSquareIcon className="h-4 w-4" />
              {t('shipments.editModeActive', 'Edit mode active - Click on highlighted fields to modify')}
            </p>
          </div>
        )}
      </div>

      {/* Timeline - Always visible at top */}
      <ShipmentTimeline 
        shipment={shipment} 
        onMilestoneClick={(milestone) => {
          if (milestone.sectionLink) {
            scrollToSection(milestone.sectionLink);
          }
        }}
      />

      {/* Contract Link (if applicable) */}
      {contract && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DocumentTextIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-900">
                  {t('contracts.linkedContract', 'Linked Contract')}: {contract.contract_no}
                </p>
                <p className="text-xs text-purple-700">
                  {contract.buyer_name} ← {contract.seller_name}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/contracts/${contract.id}`)}
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              {t('common.view', 'View')} →
            </Button>
          </div>
        </div>
      )}

      {/* Comparison Mode Banner - shows when comparison view is enabled */}
      {showComparisonView && comparisonData?.has_contract && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ScaleIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {t('shipments.comparisonMode', 'Comparison Mode Active')}
                </p>
                <p className="text-xs text-amber-700">
                  {t('shipments.comparisonModeDesc', 'Showing Contract (Planned) vs Shipment (Actual) values side-by-side')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-200 border border-green-400" />
                <span className="text-gray-600">{t('shipments.noVariance', 'Match')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-200 border border-amber-400" />
                <span className="text-gray-600">{t('shipments.hasVariance', 'Variance')}</span>
              </div>
            </div>
          </div>
          {/* Variance Summary */}
          {comparisonData.header && comparisonData.header.filter(f => f.has_variance).length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{comparisonData.header.filter(f => f.has_variance).length}</span>
                {' '}{t('shipments.fieldsWithVariance', 'field(s) differ from contract')}:
                {' '}<span className="font-medium">{comparisonData.header.filter(f => f.has_variance).map(f => f.field_name.replace(/_/g, ' ')).join(', ')}</span>
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Loading indicator for comparison data */}
      {showComparisonView && isLoadingComparison && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-center gap-3">
          <Spinner size="sm" />
          <span className="text-sm text-gray-600">{t('common.loading', 'Loading comparison data...')}</span>
        </div>
      )}

      {/* === BOX/GRID LAYOUT FOR SECTIONS === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Section 1: Basic Information - Full Width */}
        <CollapsibleSection
          id="basic-info"
          title={t('shipments.sections.basicInfo', 'Basic Information')}
          icon={<BuildingOfficeIcon className="w-full h-full" />}
          theme={getBasicInfoTheme()}
          summary={getBasicInfoSummary()}
          isExpanded={isSectionExpanded('basic-info')}
          onToggle={() => toggleSection('basic-info')}
          className="lg:col-span-2"
          badge={
            <Badge color={(shipment.transaction_type || shipment.direction) === 'incoming' ? 'blue' : 'green'} size="sm">
              {(shipment.transaction_type || shipment.direction) === 'incoming' 
                ? t('shipments.purchase', 'Purchase')
                : t('shipments.sale', 'Sale')
              }
          </Badge>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InfoField label={t('shipments.sn', 'Shipment Number')} value={shipment.sn} highlight />
          <InfoField 
            label={t('shipments.status', 'Status')} 
            value={
              <Badge color={getStatusColor(shipment.status) as any}>
                {isRtl ? statusToArabic(shipment.status) : shipment.status}
              </Badge>
            } 
          />
          <InfoField 
            label={t('shipments.product', 'Product')} 
            value={isInlineEditing ? (
              <input
                type="text"
                value={editedData.product_text}
                onChange={(e) => handleFieldChange('product_text', e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 text-base font-semibold"
              />
            ) : shipment.product_text}
            highlight
          />
          
          {/* Supplier - Always show */}
          {showComparisonView && comparisonData?.has_contract ? (
            <ComparisonInfoField 
              label={t('shipments.supplier', 'Supplier')} 
              shipmentValue={shipment.supplier_name}
              contractValue={getComparisonField('supplier')?.contract_value}
              hasVariance={getComparisonField('supplier')?.has_variance}
            />
          ) : (
            <InfoField 
              label={t('shipments.supplier', 'Supplier')} 
              value={shipment.supplier_name || '—'} 
            />
          )}
          
          {/* Customer - Show only for outgoing (sales) */}
          {shipment.customer_name && (
            showComparisonView && comparisonData?.has_contract ? (
              <ComparisonInfoField 
                label={t('shipments.customer', 'Customer')} 
                shipmentValue={shipment.customer_name}
                contractValue={getComparisonField('customer')?.contract_value}
                hasVariance={getComparisonField('customer')?.has_variance}
              />
            ) : (
              <InfoField 
                label={t('shipments.customer', 'Customer')} 
                value={shipment.customer_name} 
              />
            )
          )}
          
          {/* Buyer/Importer - The party receiving goods for documentation */}
          {(shipment.buyer_company_name || shipment.buyer_name) && (
            showComparisonView && comparisonData?.has_contract ? (
              <ComparisonInfoField 
                label={t('shipments.buyerImporter', 'Buyer / Importer')} 
                shipmentValue={shipment.buyer_company_name || shipment.buyer_name}
                contractValue={getComparisonField('buyer_importer')?.contract_value}
                hasVariance={getComparisonField('buyer_importer')?.has_variance}
              />
            ) : (
              <InfoField 
                label={t('shipments.buyerImporter', 'Buyer / Importer')} 
                value={shipment.buyer_company_name || shipment.buyer_name || '—'} 
              />
            )
          )}
          
          {shipment.has_broker && shipment.broker_name && (
            <InfoField label={t('shipments.broker', 'Broker')} value={shipment.broker_name} />
          )}
          
          {/* Final Destination */}
          {finalDestInfo.isSet && (
            <InfoField 
              label={t('shipments.finalOwnerDestination', 'Final Owner/Destination')} 
              value={
                <div>
                  <span className="font-medium">{finalDestInfo.ownerName}</span>
                  {finalDestInfo.deliveryPlace && (
                    <span className="text-gray-500 text-sm block">
                      → {finalDestInfo.deliveryPlace}
                    </span>
                  )}
                </div>
              }
            />
          )}
          
          {/* Customs Clearance Date - Priority Field */}
          <div className="md:col-span-2 lg:col-span-1">
            <InfoField 
              label={
                <span className="flex items-center gap-2">
                  {t('shipments.customsClearanceDate', 'Customs Clearance Date')}
                  {shipment.eta && shipment.free_time_days && shipment.customs_clearance_date && (
                    <DemurrageStatusBadge
                      eta={shipment.eta}
                      freeTimeDays={shipment.free_time_days}
                      customsClearanceDate={isInlineEditing ? editedData.customs_clearance_date : shipment.customs_clearance_date}
                      status={shipment.status}
                      size="sm"
                    />
                  )}
                </span>
              }
              value={isInlineEditing ? (
                <DateInput
                  value={editedData.customs_clearance_date || ''}
                  onChange={(val) => handleFieldChange('customs_clearance_date', val)}
                  className="w-full border-amber-300 focus:ring-amber-500 bg-amber-50"
                />
              ) : (
                formatDateString(shipment.customs_clearance_date) || '—'
              )}
              highlight={isInlineEditing}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 2: Product Line Items */}
      <CollapsibleSection
        id="product-lines"
        title={t('shipments.sections.productLines', 'Product Line Items')}
        icon={<CubeIcon className="w-full h-full" />}
        theme={getProductLinesTheme()}
        summary={`${shipment.product_text} • ${formatWeight(shipment.weight_ton)} ${shipment.weight_unit || 'tons'}`}
        isExpanded={isSectionExpanded('product-lines')}
        onToggle={() => toggleSection('product-lines')}
        badge={
          <Badge color="purple" size="sm">
            {shipment.container_count || 1} {t('shipments.units', 'units')}
          </Badge>
        }
      >
        <div className="space-y-4">
          {/* Main Product */}
          <div className={`${getCardClasses(!!shipment.product_text)} p-4`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className={getCardClasses(!!shipment.product_text, 'label')}>
                  {t('shipments.product', 'Product')}
                </label>
                <p className={getCardClasses(!!shipment.product_text, 'value')}>{shipment.product_text || '—'}</p>
              </div>
              
              <div>
                <label className={getCardClasses(!!shipment.weight_ton, 'label')}>
                  {t('shipments.quantity', 'Quantity')}
                </label>
                {isInlineEditing ? (
                  <input
                    type="number"
                    step="0.001"
                    value={editedData.weight_ton}
                    onChange={(e) => handleFieldChange('weight_ton', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-blue-300 rounded-md"
                  />
                ) : (
                  <p className={getCardClasses(!!shipment.weight_ton, 'value')}>
                    {shipment.weight_ton ? `${formatWeight(shipment.weight_ton)} ${shipment.weight_unit || 'tons'}` : '—'}
                  </p>
                )}
              </div>
              
              <div>
                <label className={getCardClasses(!!unitPriceDisplay, 'label')}>
                  {t('shipments.unitPrice', 'Unit Price')}
                </label>
                {isInlineEditing ? (
                  <div className="relative mt-1">
                    <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editedData.fixed_price_usd_per_ton}
                      onChange={(e) => handleFieldChange('fixed_price_usd_per_ton', e.target.value)}
                      className="w-full ps-8 pe-3 py-2 border border-blue-300 rounded-md"
                    />
                  </div>
                ) : (
                  <p className={getCardClasses(!!unitPriceDisplay, 'value')}>
                    {unitPriceDisplay || '—'}
                  </p>
                )}
              </div>
            </div>
            
            {/* Total Value */}
            <div className={`mt-4 pt-4 border-t ${totalValueDisplay ? 'border-green-300' : 'border-amber-300'} flex justify-between items-center`}>
              <span className={`text-sm font-medium ${getFieldLabel(!!totalValueDisplay)}`}>{t('shipments.totalValue', 'Total Value')}</span>
              <span className={`text-xl font-bold ${getFieldText(!!totalValueDisplay)}`}>{totalValueDisplay ? formatCurrency(totalValueDisplay) : '—'}</span>
            </div>
          </div>
          
          {/* Cargo Display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${getCardClasses(!!shipment.cargo_type)} p-3`}>
              <label className={getCardClasses(!!shipment.cargo_type, 'label')}>{t('shipments.cargoType', 'Cargo Type')}</label>
              <p className={`font-medium mt-1 ${getFieldText(!!shipment.cargo_type)}`}>
                {shipment.cargo_type ? t(`shipments.cargoTypes.${shipment.cargo_type}`, shipment.cargo_type) : '—'}
              </p>
            </div>
            <div className={`${getCardClasses(!!shipment.container_count)} p-3`}>
              <label className={getCardClasses(!!shipment.container_count, 'label')}>{t('shipments.containers', 'Containers')}</label>
              <p className={`font-medium mt-1 ${getFieldText(!!shipment.container_count)}`}>{shipment.container_count || '—'}</p>
            </div>
            {shipment.barrels && (
              <div className={`${getCardClasses(!!shipment.barrels)} p-3`}>
                <label className={getCardClasses(!!shipment.barrels, 'label')}>{t('shipments.barrels', 'Barrels')}</label>
                <p className={`font-medium mt-1 ${getFieldText(!!shipment.barrels)}`}>{formatNumber(shipment.barrels)}</p>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 3: Commercial Terms */}
      <CollapsibleSection
        id="commercial-terms"
        title={t('shipments.sections.commercialTerms', 'Commercial Terms, Payment & Delivery')}
        icon={<ScaleIcon className="w-full h-full" />}
        theme={getCommercialTheme()}
        summary={getCommercialSummary()}
        isExpanded={isSectionExpanded('commercial-terms')}
        onToggle={() => toggleSection('commercial-terms')}
      >
        <div className="space-y-6">
          {/* Pricing Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${getCardClasses(!!shipment.fixed_price_usd_per_ton)} p-4`}>
              <label className={getCardClasses(!!shipment.fixed_price_usd_per_ton, 'label')}>
                {(shipment.transaction_type || shipment.direction) === 'incoming' 
                  ? t('shipments.costPerTon', 'Cost per Ton')
                  : t('shipments.pricePerTon', 'Price per Ton')
                }
              </label>
              <p className={`text-2xl font-bold mt-1 ${getFieldText(!!shipment.fixed_price_usd_per_ton)}`}>
                {shipment.fixed_price_usd_per_ton ? formatCurrency(shipment.fixed_price_usd_per_ton) : '—'}
              </p>
            </div>
            
            {(shipment.transaction_type || shipment.direction) === 'outgoing' && (
              <div className={`${getCardClasses(!!shipment.selling_price_usd_per_ton)} p-4`}>
                <label className={getCardClasses(!!shipment.selling_price_usd_per_ton, 'label')}>
                  {t('shipments.sellingPrice', 'Selling Price')}
                </label>
                <p className={`text-2xl font-bold mt-1 ${getFieldText(!!shipment.selling_price_usd_per_ton)}`}>
                  {shipment.selling_price_usd_per_ton ? formatCurrency(shipment.selling_price_usd_per_ton) : '—'}
                </p>
              </div>
            )}
            
            <div className={`${getCardClasses(!!totalValueDisplay)} p-4`}>
              <label className={getCardClasses(!!totalValueDisplay, 'label')}>
                {t('shipments.totalValue', 'Total Value')}
              </label>
              <p className={`text-2xl font-bold mt-1 ${getFieldText(!!totalValueDisplay)}`}>
                {totalValueDisplay ? formatCurrency(totalValueDisplay) : '—'}
              </p>
            </div>
          </div>
          
          {/* Terms Grid - with optional comparison view */}
          {showComparisonView && comparisonData?.has_contract ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ComparisonInfoField 
                label={t('shipments.incoterms', 'Incoterms')}
                shipmentValue={shipment.incoterms ? <Badge color="green" size="md">{shipment.incoterms}</Badge> : null}
                contractValue={getComparisonField('incoterms')?.contract_value}
                hasVariance={getComparisonField('incoterms')?.has_variance}
              />
              <ComparisonInfoField 
                label={t('shipments.paymentTerms', 'Payment Terms')}
                shipmentValue={shipment.payment_terms}
                contractValue={getComparisonField('payment_terms')?.contract_value}
                hasVariance={getComparisonField('payment_terms')?.has_variance}
              />
              <ComparisonInfoField 
                label={t('shipments.paymentMethod', 'Payment Method')}
                shipmentValue={shipment.payment_method ? t(`shipments.paymentMethods.${shipment.payment_method}`, shipment.payment_method) : null}
                contractValue={getComparisonField('payment_method')?.contract_value}
                hasVariance={getComparisonField('payment_method')?.has_variance}
              />
              <ComparisonInfoField 
                label={t('shipments.currency', 'Currency')}
                shipmentValue={shipment.currency_code || 'USD'}
                contractValue={getComparisonField('currency')?.contract_value}
                hasVariance={getComparisonField('currency')?.has_variance}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`${getCardClasses(!!shipment.incoterms)} p-3`}>
                <label className={getCardClasses(!!shipment.incoterms, 'label')}>{t('shipments.incoterms', 'Incoterms')}</label>
                <p className={`font-bold mt-1 ${getFieldText(!!shipment.incoterms)}`}>
                  {shipment.incoterms ? <Badge color="green" size="md">{shipment.incoterms}</Badge> : '—'}
                </p>
              </div>
              <div className={`${getCardClasses(!!shipment.payment_terms)} p-3`}>
                <label className={getCardClasses(!!shipment.payment_terms, 'label')}>{t('shipments.paymentTerms', 'Payment Terms')}</label>
                <p className={`font-bold mt-1 ${getFieldText(!!shipment.payment_terms)}`}>{shipment.payment_terms || '—'}</p>
              </div>
              <div className={`${getCardClasses(!!shipment.payment_method)} p-3`}>
                <label className={getCardClasses(!!shipment.payment_method, 'label')}>{t('shipments.paymentMethod', 'Payment Method')}</label>
                <p className={`font-bold mt-1 ${getFieldText(!!shipment.payment_method)}`}>
                  {shipment.payment_method ? t(`shipments.paymentMethods.${shipment.payment_method}`, shipment.payment_method) : '—'}
                </p>
              </div>
              <div className={`${getCardClasses(!!shipment.currency_code)} p-3`}>
                <label className={getCardClasses(!!shipment.currency_code, 'label')}>{t('shipments.currency', 'Currency')}</label>
                <p className={`font-bold mt-1 ${getFieldText(!!shipment.currency_code)}`}>{shipment.currency_code || 'USD'}</p>
              </div>
            </div>
          )}
          
          {/* Down Payment */}
          {(shipment.down_payment_percentage || shipment.down_payment_amount) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-800 mb-3">
                {t('shipments.downPayment', 'Down Payment')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {shipment.down_payment_percentage && (
                  <div>
                    <label className="text-xs text-green-700">Percentage</label>
                    <p className="text-lg font-bold text-green-900">{shipment.down_payment_percentage}%</p>
                  </div>
                )}
                {shipment.down_payment_amount && (
                  <div>
                    <label className="text-xs text-green-700">Amount</label>
                    <p className="text-lg font-bold text-green-900">{formatCurrency(shipment.down_payment_amount)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Payment Schedule */}
          {paymentSchedule.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-3">
                {t('shipments.paymentSchedule', 'Payment Schedule')}
              </h4>
              <div className="space-y-2">
                {paymentSchedule.map((payment: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-green-50 rounded-lg p-3 border border-green-200">
                    <div>
                      <p className="font-medium text-green-900">{payment.description}</p>
                      <p className="text-xs text-green-600">{t('shipments.dueDate', 'Due')}: {formatDateString(payment.due_date)}</p>
                    </div>
                    <span className="font-bold text-green-900">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 4: International Logistics - Full Width */}
      <CollapsibleSection
        id="international-logistics"
        title={t('shipments.sections.internationalLogistics', 'International Logistics')}
        icon={<GlobeAltIcon className="w-full h-full" />}
        theme={getInternationalLogisticsTheme()}
        summary={getLogisticsSummary()}
        isExpanded={isSectionExpanded('international-logistics')}
        onToggle={() => toggleSection('international-logistics')}
        className="lg:col-span-2"
        badge={shipment.bl_no ? (
          <Badge color="indigo" size="sm">B/L: {shipment.bl_no}</Badge>
        ) : undefined}
      >
        <div className="space-y-6">
          {/* Route Visualization - with comparison view */}
          {showComparisonView && comparisonData?.has_contract ? (
            <div className="space-y-4">
              {/* Comparison header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ComparisonInfoField 
                  label={t('shipments.portOfLoading', 'Port of Loading')}
                  shipmentValue={shipment.pol_name ? `${shipment.pol_name}${shipment.pol_country ? ` (${shipment.pol_country})` : ''}` : null}
                  contractValue={getComparisonField('pol')?.contract_value}
                  hasVariance={getComparisonField('pol')?.has_variance}
                />
                <ComparisonInfoField 
                  label={t('shipments.portOfDischarge', 'Port of Discharge')}
                  shipmentValue={shipment.pod_name ? `${shipment.pod_name}${shipment.pod_country ? ` (${shipment.pod_country})` : ''}` : null}
                  contractValue={getComparisonField('pod')?.contract_value}
                  hasVariance={getComparisonField('pod')?.has_variance}
                />
                <ComparisonInfoField 
                  label={t('shipments.countryOfExport', 'Country of Export')}
                  shipmentValue={shipment.country_of_export}
                  contractValue={getComparisonField('country_of_export')?.contract_value}
                  hasVariance={getComparisonField('country_of_export')?.has_variance}
                />
                <ComparisonInfoField 
                  label="ETD"
                  shipmentValue={shipment.etd ? formatDateString(shipment.etd) : null}
                  contractValue={getComparisonField('etd')?.contract_value ? formatDateString(getComparisonField('etd')!.contract_value!) : null}
                  hasVariance={getComparisonField('etd')?.has_variance}
                />
              </div>
            </div>
          ) : (
            <div className={`rounded-lg p-4 border ${shipment.pol_name && shipment.pod_name ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-[120px]">
                  <label className={`text-xs font-medium uppercase ${shipment.pol_name ? 'text-green-700' : 'text-amber-700'}`}>
                    {t('shipments.portOfLoading', 'Port of Loading')}
                  </label>
                  <p className={`text-lg font-bold mt-1 ${shipment.pol_name ? 'text-green-900' : 'text-amber-700'}`}>{shipment.pol_name || '—'}</p>
                  {shipment.pol_country && (
                    <p className={`text-xs ${shipment.pol_name ? 'text-green-600' : 'text-amber-600'}`}>{shipment.pol_country}</p>
                  )}
                </div>
                
                <div className={`flex items-center gap-2 ${shipment.pol_name && shipment.pod_name ? 'text-green-400' : 'text-amber-400'}`}>
                  <div className={`w-8 h-0.5 ${shipment.pol_name && shipment.pod_name ? 'bg-green-300' : 'bg-amber-300'}`} />
                  <TruckIcon className="w-6 h-6" />
                  <div className={`w-8 h-0.5 ${shipment.pol_name && shipment.pod_name ? 'bg-green-300' : 'bg-amber-300'}`} />
                </div>
                
                <div className="flex-1 min-w-[120px] text-end">
                  <label className={`text-xs font-medium uppercase ${shipment.pod_name ? 'text-green-700' : 'text-amber-700'}`}>
                    {t('shipments.portOfDischarge', 'Port of Discharge')}
                  </label>
                  <p className={`text-lg font-bold mt-1 ${shipment.pod_name ? 'text-green-900' : 'text-amber-700'}`}>{shipment.pod_name || '—'}</p>
                  {shipment.pod_country && (
                    <p className={`text-xs ${shipment.pod_name ? 'text-green-600' : 'text-amber-600'}`}>{shipment.pod_country}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Key Dates */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${getCardClasses(!!shipment.etd)} p-3`}>
              <label className={`text-xs font-medium flex items-center gap-1 ${getFieldLabel(!!shipment.etd)}`}>
                <CalendarIcon className="w-3 h-3" /> ETD
              </label>
              {isInlineEditing ? (
                <DateInput
                  value={editedData.etd}
                  onChange={(val) => handleFieldChange('etd', val)}
                  className="mt-1 w-full border-blue-300"
                />
              ) : (
                <p className={`text-base font-bold mt-1 ${getFieldText(!!shipment.etd)}`}>
                  {formatDateString(shipment.etd) || '—'}
                </p>
              )}
            </div>
            
            <div className={`${getCardClasses(!!shipment.eta)} p-3`}>
              <label className={`text-xs font-medium flex items-center gap-1 ${getFieldLabel(!!shipment.eta)}`}>
                <CalendarIcon className="w-3 h-3" /> ETA
              </label>
              {isInlineEditing ? (
                <DateInput
                  value={editedData.eta}
                  onChange={(val) => handleFieldChange('eta', val)}
                  className="mt-1 w-full border-green-300"
                />
              ) : (
                <p className={`text-base font-bold mt-1 ${getFieldText(!!shipment.eta)}`}>
                  {formatDateString(shipment.eta) || '—'}
                </p>
              )}
            </div>
            
            <div className={`${getCardClasses(!!shipment.free_time_days)} p-3`}>
              <label className={getCardClasses(!!shipment.free_time_days, 'label')}>{t('shipments.freeTime', 'Free Time')}</label>
              <p className={`text-base font-bold mt-1 ${getFieldText(!!shipment.free_time_days)}`}>
                {shipment.free_time_days ? `${shipment.free_time_days} ${t('common.days', 'days')}` : '—'}
              </p>
            </div>
            
            <div className={`${getCardClasses(!!shipment.customs_clearance_date)} p-3`}>
              <label className={getCardClasses(!!shipment.customs_clearance_date, 'label')}>{t('shipments.clearanceDate', 'Clearance Date')}</label>
              <p className={`text-base font-bold mt-1 ${getFieldText(!!shipment.customs_clearance_date)}`}>
                {formatDateString(shipment.customs_clearance_date) || '—'}
              </p>
            </div>
          </div>
          
          {/* Shipping Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${getCardClasses(!!shipment.shipping_line_name)} p-3`}>
              <label className={getCardClasses(!!shipment.shipping_line_name, 'label')}>{t('shipments.shippingLine', 'Shipping Line')}</label>
              <p className={`font-medium mt-1 ${getFieldText(!!shipment.shipping_line_name)}`}>{shipment.shipping_line_name || '—'}</p>
            </div>
            <div className={`${getCardClasses(!!shipment.booking_no)} p-3`}>
              <label className={getCardClasses(!!shipment.booking_no, 'label')}>{t('shipments.bookingNo', 'Booking Number')}</label>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.booking_no}
                  onChange={(e) => handleFieldChange('booking_no', e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md font-mono mt-1"
                />
              ) : (
                <p className={`font-mono font-medium mt-1 ${getFieldText(!!shipment.booking_no)}`}>{shipment.booking_no || '—'}</p>
              )}
            </div>
            <div className={`${getCardClasses(!!shipment.bl_no)} p-3`}>
              <label className={getCardClasses(!!shipment.bl_no, 'label')}>{t('shipments.blNo', 'B/L Number')}</label>
              {isInlineEditing ? (
                <input
                  type="text"
                  value={editedData.bl_no}
                  onChange={(e) => handleFieldChange('bl_no', e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md font-mono mt-1"
                />
              ) : (
                <p className={`font-mono font-medium mt-1 ${getFieldText(!!shipment.bl_no)}`}>{shipment.bl_no || '—'}</p>
              )}
            </div>
          </div>
          
          {/* BOL Numbers */}
          {bolNumbers.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <label className="text-xs font-medium text-green-700 mb-2 block uppercase">
                {t('shipments.bolNumbers', 'BOL Numbers')}
              </label>
              <div className="flex flex-wrap gap-2">
                {bolNumbers.map((bol: string, index: number) => (
                  <Badge key={index} color="green" size="sm">{bol}</Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Vessel/Transport Info */}
          {(shipment.vessel_name || shipment.container_number || shipment.truck_plate_number || shipment.tanker_name) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-green-50 p-4 rounded-lg border border-green-200">
              {shipment.vessel_name && (
                <div>
                  <label className="text-xs font-medium text-green-700 uppercase">{t('shipments.vessel', 'Vessel')}</label>
                  <p className="font-medium text-green-900 mt-1">{`${shipment.vessel_name}${shipment.vessel_imo ? ` (IMO: ${shipment.vessel_imo})` : ''}`}</p>
                </div>
              )}
              {shipment.container_number && (
                <div>
                  <label className="text-xs font-medium text-green-700 uppercase">{t('shipments.container', 'Container')}</label>
                  <p className="font-medium text-green-900 mt-1">{shipment.container_number}</p>
                </div>
              )}
              {shipment.truck_plate_number && (
                <div>
                  <label className="text-xs font-medium text-green-700 uppercase">{t('shipments.truck', 'Truck')}</label>
                  <p className="font-medium text-green-900 mt-1">{`${shipment.truck_plate_number}${shipment.cmr ? ` (CMR: ${shipment.cmr})` : ''}`}</p>
                </div>
              )}
              {shipment.tanker_name && (
                <div>
                  <label className="text-xs font-medium text-green-700 uppercase">{t('shipments.tanker', 'Tanker')}</label>
                  <p className="font-medium text-green-900 mt-1">{`${shipment.tanker_name}${shipment.tanker_imo ? ` (IMO: ${shipment.tanker_imo})` : ''}`}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Batches for Split Shipments */}
          {shipment.is_split_shipment && batches.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                📦 {t('shipments.splitBatches', 'Split Shipment Batches')}
                <Badge color="blue" size="sm">{batches.length}</Badge>
              </h4>
              <div className="space-y-3">
                {batches.map((batch: any, index: number) => (
                  <div key={batch.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        {batch.batch_number}
                      </span>
                      <span className="font-semibold text-gray-900">{batch.batch_name || `Batch ${batch.batch_number}`}</span>
                      <Badge color={batch.status === 'delivered' ? 'green' : batch.status === 'in_transit' ? 'blue' : 'gray'} size="sm">
                        {batch.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      {batch.weight_ton && (
                        <div>
                          <span className="text-gray-500">Weight:</span>
                          <span className="ms-1 font-medium">{formatNumber(batch.weight_ton)} tons</span>
                        </div>
                      )}
                      {batch.container_count && (
                        <div>
                          <span className="text-gray-500">Containers:</span>
                          <span className="ms-1 font-medium">{batch.container_count}</span>
                        </div>
                      )}
                      {batch.eta && (
                        <div>
                          <span className="text-gray-500">ETA:</span>
                          <span className="ms-1 font-medium">{formatDateString(batch.eta)}</span>
                        </div>
                      )}
                      {batch.vessel_name && (
                        <div>
                          <span className="text-gray-500">Vessel:</span>
                          <span className="ms-1 font-medium">{batch.vessel_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 5: Domestic Logistics */}
      <CollapsibleSection
        id="domestic-logistics"
        title={t('shipments.sections.domesticLogistics', 'Domestic Logistics')}
        icon={<TruckIcon className="w-full h-full" />}
        theme={getDomesticLogisticsTheme()}
        summary={
          shipment.final_destination?.delivery_place 
            ? `${shipment.pod_name || 'POD'} → ${shipment.final_destination.delivery_place}`
            : t('shipments.noInternalRoute', 'Internal route not defined')
        }
        isExpanded={isSectionExpanded('domestic-logistics')}
        onToggle={() => toggleSection('domestic-logistics')}
        badge={shipment.is_cross_border ? (
          <Badge color="amber" size="sm">{t('shipments.crossBorder', 'Cross-Border')}</Badge>
        ) : undefined}
      >
        <div className="space-y-6">
          {/* Internal Route Display */}
          <div className={`rounded-lg p-4 border ${
            finalDestInfo.isSet
              ? 'bg-green-50 border-green-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-center">
                <p className={`text-xs font-medium uppercase ${shipment.pod_name ? 'text-green-700' : 'text-amber-700'}`}>{t('shipments.from', 'From')}</p>
                <p className={`font-bold ${shipment.pod_name ? 'text-green-900' : 'text-amber-700'}`}>{shipment.pod_name || '—'}</p>
              </div>
              
              {shipment.is_cross_border && shipment.primary_border_name && (
                <>
                  <span className="text-amber-500">→</span>
                  <div className="text-center bg-amber-100 px-3 py-1 rounded">
                    <p className="text-xs font-medium text-amber-700">🚧 {t('shipments.border', 'Border')}</p>
                    <p className="font-bold text-amber-900">{shipment.primary_border_name}</p>
                  </div>
                </>
              )}
              
              <span className={finalDestInfo.isSet ? 'text-green-500' : 'text-amber-500'}>→</span>
              
              <div className="text-center">
                <p className={`text-xs font-medium uppercase ${finalDestInfo.isSet ? 'text-green-700' : 'text-amber-700'}`}>{t('shipments.to', 'To')}</p>
                <p className={`font-bold ${finalDestInfo.isSet ? 'text-green-900' : 'text-amber-700'}`}>
                  {finalDestInfo.displayText || '—'}
                </p>
              </div>
            </div>
            
            {/* Border Info */}
            {shipment.is_cross_border && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {shipment.border_country_from && shipment.border_country_to && (
                    <div>
                      <span className="text-amber-700">Countries:</span>
                      <span className="ms-1 font-medium">{shipment.border_country_from} → {shipment.border_country_to}</span>
                    </div>
                  )}
                  {shipment.internal_transport_mode && (
                    <div>
                      <span className="text-amber-700">Transport:</span>
                      <span className="ms-1 font-medium">
                        {shipment.internal_transport_mode === 'truck' ? '🚛 Truck' :
                         shipment.internal_transport_mode === 'rail' ? '🚂 Rail' :
                         shipment.internal_transport_mode === 'sea' ? '🚢 Sea' :
                         shipment.internal_transport_mode}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Transit Countries */}
          {shipment.transit_countries && shipment.transit_countries.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <label className="text-xs font-medium text-green-700 mb-2 block uppercase">
                {t('shipments.transitCountries', 'Transit Countries')}
              </label>
              <p className="font-medium text-green-900">{shipment.transit_countries.join(' → ')}</p>
            </div>
          )}
          
          {/* Final Destination Details */}
          {finalDestInfo.isSet && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {finalDestInfo.ownerName && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <label className="text-xs font-medium text-green-700 uppercase">{t('shipments.finalOwner', 'Final Owner')}</label>
                  <p className="font-medium text-green-900 mt-1">{finalDestInfo.ownerName}</p>
                </div>
              )}
              {finalDestInfo.deliveryPlace && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <label className="text-xs font-medium text-green-700 uppercase">{t('shipments.deliveryPlace', 'Delivery Place')}</label>
                  <p className="font-medium text-green-900 mt-1">{finalDestInfo.deliveryPlace}</p>
                </div>
              )}
              {shipment.final_destination?.contact && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <label className="text-xs font-medium text-green-700 uppercase">{t('shipments.contact', 'Contact')}</label>
                  <p className="font-medium text-green-900 mt-1">{shipment.final_destination.contact}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 6: Financial & Accounting */}
      <CollapsibleSection
        id="financial-accounting"
        title={t('shipments.sections.financialAccounting', 'Financial & Accounting')}
        icon={<BanknotesIcon className="w-full h-full" />}
        theme={getFinancialTheme()}
        summary={getFinancialSummary()}
        isExpanded={isSectionExpanded('financial-accounting')}
        onToggle={() => toggleSection('financial-accounting')}
        badge={
          shipment.balance_value_usd && Number(shipment.balance_value_usd) > 0 ? (
            <Badge color="red" size="sm">
              {t('shipments.balanceDue', 'Balance Due')}: {formatCurrency(shipment.balance_value_usd)}
            </Badge>
          ) : shipment.balance_value_usd && Number(shipment.balance_value_usd) <= 0 ? (
            <Badge color="green" size="sm">{t('shipments.fullyPaid', 'Fully Paid')}</Badge>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-5 rounded-lg border ${totalValueDisplay ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'}`}>
              <label className={`text-sm font-medium ${totalValueDisplay ? 'text-green-700' : 'text-amber-700'}`}>{t('shipments.invoiceValue', 'Invoice Value')}</label>
              <p className={`text-2xl font-bold mt-1 ${totalValueDisplay ? 'text-green-900' : 'text-amber-700'}`}>{totalValueDisplay ? formatCurrency(totalValueDisplay) : '—'}</p>
            </div>
            
            <div className={`p-5 rounded-lg border ${shipment.paid_value_usd ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'}`}>
              <label className={`text-sm font-medium ${shipment.paid_value_usd ? 'text-green-700' : 'text-amber-700'}`}>{t('shipments.paidAmount', 'Paid Amount')}</label>
              <p className={`text-2xl font-bold mt-1 ${shipment.paid_value_usd ? 'text-green-900' : 'text-amber-700'}`}>{shipment.paid_value_usd ? formatCurrency(shipment.paid_value_usd) : '—'}</p>
            </div>
            
            <div className={`p-5 rounded-lg border ${
              Number(shipment.balance_value_usd) > 0 
                ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
                : shipment.balance_value_usd !== undefined
                  ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                  : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'
            }`}>
              <label className={`text-sm font-medium ${
                Number(shipment.balance_value_usd) > 0 ? 'text-red-700' : shipment.balance_value_usd !== undefined ? 'text-green-700' : 'text-amber-700'
              }`}>{t('shipments.balance', 'Balance')}</label>
              <p className={`text-2xl font-bold mt-1 ${
                Number(shipment.balance_value_usd) > 0 ? 'text-red-900' : shipment.balance_value_usd !== undefined ? 'text-green-900' : 'text-amber-700'
              }`}>{shipment.balance_value_usd !== undefined ? formatCurrency(shipment.balance_value_usd) : '—'}</p>
            </div>
          </div>
          
          {/* Additional Costs */}
          {additionalCosts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-3">
                {t('shipments.additionalCosts', 'Additional Costs')}
              </h4>
              <div className="space-y-2">
                {additionalCosts.map((cost: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-green-50 rounded-lg p-3 border border-green-200">
                    <span className="text-sm font-medium text-green-900">{cost.description}</span>
                    <span className="font-bold text-green-900">{formatCurrency(cost.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Transactions Panel */}
          {shipment?.id && (
            <div className="border-t pt-6">
              <TransactionsPanel
                entityType="shipment"
                entityId={shipment.id}
                entityRef={shipment.sn}
              />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 7: Documents - Full Width */}
      <CollapsibleSection
        id="documents"
        title={t('shipments.sections.documents', 'Documents')}
        icon={<DocumentTextIcon className="w-full h-full" />}
        theme={getDocumentsTheme()}
        summary={`${shipment.document_count || 0} ${t('documents.files', 'files')}`}
        isExpanded={isSectionExpanded('documents')}
        onToggle={() => toggleSection('documents')}
        className="lg:col-span-2"
        badge={
          <Badge color="purple" size="sm">{shipment.document_count || 0} {t('documents.documents', 'docs')}</Badge>
        }
      >
        {shipment?.id && (
          <DocumentPanel
            entityType="shipment"
            entityId={shipment.id}
            entityRef={shipment.sn}
            readOnly={false}
          />
        )}
      </CollapsibleSection>

      {/* Section 8: Quality & Notes - Full Width */}
      <CollapsibleSection
        id="quality-notes"
        title={t('shipments.sections.qualityNotes', 'Quality & Notes')}
        icon={<ChatBubbleBottomCenterTextIcon className="w-full h-full" />}
        theme={getQualityNotesTheme()}
        summary={shipment.notes ? `${shipment.notes.substring(0, 50)}...` : t('shipments.noNotes', 'No notes')}
        isExpanded={isSectionExpanded('quality-notes')}
        onToggle={() => toggleSection('quality-notes')}
        className="lg:col-span-2"
      >
        <div className="space-y-6">
          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              {t('common.notes', 'Notes')}
            </label>
            {isInlineEditing ? (
              <textarea
                value={editedData.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={6}
                className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-700"
                placeholder={t('shipments.notesPlaceholder', 'Add notes...')}
              />
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-[100px]">
                {shipment.notes || t('shipments.noNotes', 'No notes added')}
              </p>
            )}
          </div>
          
          {/* Audit Information */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              {t('shipments.auditInfo', 'Audit Information')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{t('shipments.createdAt', 'Created')}:</span>
                <span className="ms-1 font-medium">{formatDateString(shipment.created_at)}</span>
              </div>
              <div>
                <span className="text-gray-500">{t('shipments.updatedAt', 'Updated')}:</span>
                <span className="ms-1 font-medium">{formatDateString(shipment.updated_at)}</span>
              </div>
              <div>
                <span className="text-gray-500">{t('shipments.createdBy', 'By')}:</span>
                <span className="ms-1 font-medium">{shipment.created_by || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      </div>
      {/* === END BOX/GRID LAYOUT === */}

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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                    </div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      {t('shipments.confirmEdit', 'Confirm Edit')}
                    </Dialog.Title>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">
                    {t('shipments.confirmEditMessage', 'Are you sure you want to edit this shipment? You will be able to modify all details.')}
                  </p>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                    <p className="font-semibold text-blue-900">{shipment.sn}</p>
                    <p className="text-xs text-blue-700 mt-1">{shipment.product_text}</p>
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
          onSuccess={async () => {
            setShowEditWizard(false);
            // Invalidate both shipment and shipment-lines queries to refresh all data
            await queryClient.invalidateQueries({ queryKey: ['shipment', id] });
            await queryClient.invalidateQueries({ queryKey: ['shipment-lines', id] });
            refetch();
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

// Helper component for consistent field display
function InfoField({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: React.ReactNode; 
  value: React.ReactNode; 
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'bg-blue-50 p-3 rounded-lg border border-blue-200' : ''}>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </dt>
      <dd className="text-base font-semibold text-gray-900">
        {value || '—'}
      </dd>
    </div>
  );
}

/** InfoField with comparison view - shows Contract (Planned) vs Shipment (Actual) side-by-side */
function ComparisonInfoField({ 
  label, 
  shipmentValue, 
  contractValue,
  hasVariance = false,
  highlight = false 
}: { 
  label: React.ReactNode; 
  shipmentValue: React.ReactNode;
  contractValue: React.ReactNode;
  hasVariance?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`${highlight ? 'bg-blue-50 p-3 rounded-lg border border-blue-200' : ''} ${hasVariance ? 'ring-2 ring-amber-300 rounded-lg' : ''}`}>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
        {label}
        {hasVariance && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
            Variance
          </span>
        )}
      </dt>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 p-2 rounded border border-gray-200">
          <div className="text-[10px] text-gray-400 uppercase mb-0.5">Contract (Planned)</div>
          <dd className={`text-sm font-medium ${hasVariance ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
            {contractValue || '—'}
          </dd>
        </div>
        <div className={`p-2 rounded border ${hasVariance ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="text-[10px] text-gray-400 uppercase mb-0.5">Shipment (Actual)</div>
          <dd className={`text-sm font-semibold ${hasVariance ? 'text-amber-800' : 'text-green-800'}`}>
            {shipmentValue || '—'}
          </dd>
        </div>
      </div>
    </div>
  );
}

export default ShipmentFinalReport;

