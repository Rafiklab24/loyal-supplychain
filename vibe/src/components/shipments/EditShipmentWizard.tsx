import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { ProgressStepper } from './wizard/ProgressStepper';
import { Step1BasicInfo } from './wizard/Step1BasicInfo';
import { Step2ProductLines } from './wizard/Step2ProductLines';
import { Step3DeliveryTerms } from './wizard/Step3DeliveryTerms';
import { Step4Logistics } from './wizard/Step4Logistics';
import { Step5Documents } from './wizard/Step5Documents';
import { Step6Review } from './wizard/Step6Review';
import { initialFormData, type ShipmentFormData } from './wizard/types';
import { updateShipment } from '../../services/shipments';
import contractsService from '../../services/contracts';
import { uploadDocument, type DocumentType } from '../../services/documents';
import type { Shipment } from '../../types/api';

interface EditShipmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shipment: Shipment;
}

// Helper function to convert Shipment to ShipmentFormData
const toNumberOrEmpty = (value: string | number | null | undefined): number | '' => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isNaN(parsed) ? '' : parsed;
};

// Helper function to convert ISO date string to yyyy-MM-dd format for date inputs
const formatDateForInput = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    // If already in yyyy-MM-dd format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // Handle ISO date strings like "2025-11-05T21:00:00.000Z"
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    // Use LOCAL date components to avoid timezone shift issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

const ensureDownPaymentType = (
  value: string | null | undefined
): ShipmentFormData['down_payment_type'] => {
  return value === 'percentage' || value === 'fixed_amount' || value === 'none'
    ? value
    : 'none';
};

const ensurePaymentMethod = (
  value: string | null | undefined
): ShipmentFormData['payment_method'] => {
  const allowed: ShipmentFormData['payment_method'][] = [
    'swift',
    'local_transfer',
    'letter_of_credit',
    'third_party',
    'cash',
    'multiple',
    'other',
  ];
  return allowed.includes(value as ShipmentFormData['payment_method'])
    ? (value as ShipmentFormData['payment_method'])
    : 'swift';
};

function convertShipmentToFormData(shipment: Shipment): ShipmentFormData {
  // Debug: Log the raw shipment data
  console.warn('🔍 Shipment ID:', shipment.id);
  console.warn('🔍 Shipment SN:', shipment.sn);
  console.warn('🔍 has_final_destination:', (shipment as any).has_final_destination);
  console.warn('🔍 final_destination raw:', JSON.stringify((shipment as any).final_destination));
  // Parse batches from JSONB if it exists
  const batches = shipment.batches ? 
    (typeof shipment.batches === 'string' ? JSON.parse(shipment.batches) : shipment.batches) 
    : [];

  const containerNumbers = shipment.container_numbers && shipment.container_numbers.length > 0
    ? shipment.container_numbers
    : shipment.container_number
      ? [shipment.container_number]
      : [];

  // Parse lines and ensure they are numbers
  // CRITICAL: Must set ALL fields needed for price calculation to work properly
  let parsedLines: any[] = [];
  const rawLines = (shipment as any).lines;
  if (rawLines) {
    parsedLines = typeof rawLines === 'string' ? JSON.parse(rawLines) : rawLines;
    // Normalize line data with all fields required for price calculation
    parsedLines = parsedLines.map((line: any) => ({
      ...line,
      // Contract line link - IMPORTANT for fulfillment tracking
      contract_line_id: line.contract_line_id || null,
      // Product identification
      type_of_goods: line.type_of_goods || line.product_name || '',
      product_name: line.product_name || line.type_of_goods || '',
      // Quantities - ensure numeric
      quantity_mt: parseFloat(line.quantity_mt) || 0,
      unit_price: parseFloat(line.unit_price) || 0,
      amount_usd: parseFloat(line.amount_usd) || 0,
      number_of_packages: parseInt(line.number_of_packages) || 0,
      // CRITICAL: Fields required for price calculation auto-calc
      pricing_method: line.pricing_method || 'per_mt',  // Default to per MT pricing
      package_size: parseFloat(line.package_size) || parseFloat(line.unit_size) || 25,
      package_size_unit: line.package_size_unit || 'KG',
      kind_of_packages: line.kind_of_packages || 'BAGS',
      rate_usd_per_mt: parseFloat(line.rate_usd_per_mt) || 0,
      // Volume/shipping fields
      number_of_barrels: parseFloat(line.number_of_barrels) || 0,
      number_of_containers: parseInt(line.number_of_containers) || 0,
      number_of_pallets: parseInt(line.number_of_pallets) || 0,
      volume_cbm: parseFloat(line.volume_cbm) || 0,
      volume_liters: parseFloat(line.volume_liters) || 0,
      // Preserve extra_json for fulfillment tracking
      extra_json: line.extra_json || {},
    }));
  }

  const base: ShipmentFormData = {
    ...initialFormData,
    transaction_type: shipment.transaction_type || shipment.direction || initialFormData.transaction_type,
    sn: shipment.sn || '',
    // Contract link
    contract_id: shipment.contract_id || '',
    has_sales_contract: !!shipment.contract_id,
    subject: shipment.subject || '',
    product_text: shipment.product_text || '',
    supplier_id: shipment.supplier_id || '',
    supplier_name: (shipment as any).supplier_name || '',
    customer_id: shipment.customer_id || '',
    customer_name: (shipment as any).customer_name || '',
    buyer_id: (shipment as any).buyer_id || '',
    buyer_name: (shipment as any).buyer_name || '',
    shipping_line_id: (shipment as any).shipping_line_id || '',
    shipping_line_name: (shipment as any).shipping_line_name || '',
    has_broker: shipment.has_broker || false,
    broker_name: shipment.broker_name || '',
    cargo_type: shipment.cargo_type || '',
    tanker_type: shipment.tanker_type || '',
    container_count: toNumberOrEmpty(shipment.container_count),
    weight_ton: toNumberOrEmpty(shipment.weight_ton),
    weight_unit: shipment.weight_unit || 'tons',
    weight_unit_custom: shipment.weight_unit_custom || '',
    barrels: toNumberOrEmpty(shipment.barrels),
    country_of_export: (shipment as any).country_of_export || '',
    fixed_price_usd_per_ton: toNumberOrEmpty(shipment.fixed_price_usd_per_ton),
    fixed_price_usd_per_barrel: toNumberOrEmpty(shipment.fixed_price_usd_per_barrel),
    selling_price_usd_per_ton: toNumberOrEmpty(shipment.selling_price_usd_per_ton),
    selling_price_usd_per_barrel: toNumberOrEmpty(shipment.selling_price_usd_per_barrel),
    currency_code: (shipment as any).currency_code || 'USD',
    usd_equivalent_rate: toNumberOrEmpty((shipment as any).usd_equivalent_rate),
    payment_terms: shipment.payment_terms || '',
    incoterms: shipment.incoterms || '',
    down_payment_type: ensureDownPaymentType(shipment.down_payment_type),
    down_payment_percentage: toNumberOrEmpty(shipment.down_payment_percentage),
    down_payment_amount: toNumberOrEmpty(shipment.down_payment_amount),
    payment_method: ensurePaymentMethod(shipment.payment_method),
    payment_method_other: shipment.payment_method_other || '',
    swift_code: shipment.swift_code || '',
    lc_number: shipment.lc_number || '',
    lc_issuing_bank: shipment.lc_issuing_bank || '',
    beneficiary_name: shipment.beneficiary_name || '',
    beneficiary_bank_name: shipment.beneficiary_bank_name || '',
    beneficiary_bank_address: shipment.beneficiary_bank_address || '',
    beneficiary_account_number: shipment.beneficiary_account_number || '',
    beneficiary_iban: shipment.beneficiary_iban || '',
    intermediary_bank: shipment.intermediary_bank || '',
    payment_schedule: shipment.payment_schedule || [],
    additional_costs: shipment.additional_costs || [],
    payment_beneficiaries: shipment.payment_beneficiaries || [],
    is_split_shipment: shipment.is_split_shipment || false,
    batches,
    pol_id: shipment.pol_id || '',
    pol_name: shipment.pol_name || '',
    pod_id: shipment.pod_id || '',
    pod_name: shipment.pod_name || '',
    etd: formatDateForInput(shipment.etd),
    eta: formatDateForInput(shipment.eta),
    free_time_days: toNumberOrEmpty(shipment.free_time_days),
    customs_clearance_date: formatDateForInput(shipment.customs_clearance_date),
    shipping_line_id: shipment.shipping_line_id || '',
    shipping_line_name: (shipment as any).shipping_line_name || '',
    booking_no: shipment.booking_no || '',
    bl_no: shipment.bl_no || '',
    transportation_cost: toNumberOrEmpty(shipment.transportation_cost),
    bol_numbers: shipment.bol_numbers || [],
    container_numbers: containerNumbers,
    container_number: shipment.container_number || '',
    vessel_name: shipment.vessel_name || '',
    vessel_imo: shipment.vessel_imo || '',
    truck_plate_number: shipment.truck_plate_number || '',
    cmr: shipment.cmr || '',
    tanker_name: shipment.tanker_name || '',
    tanker_imo: shipment.tanker_imo || '',
    documents: shipment.documents || [],
    notes: shipment.notes || '',
    // Product lines - use pre-parsed and normalized lines
    lines: parsedLines,
    // Container details - parse from JSONB if exists
    containers: (shipment as any).containers ? 
      (typeof (shipment as any).containers === 'string' ? JSON.parse((shipment as any).containers) : (shipment as any).containers) 
      : [],
    // Final Destination / Owner - parse from JSONB if exists, merge with defaults
    has_final_destination: (shipment as any).has_final_destination || false,
    final_destination: (() => {
      const shipmentFd = (shipment as any).final_destination;
      if (!shipmentFd) return initialFormData.final_destination;
      const parsed = typeof shipmentFd === 'string' ? JSON.parse(shipmentFd) : shipmentFd;
      // Merge with default structure to ensure all properties exist
      return {
        ...initialFormData.final_destination,
        ...parsed,
      };
    })(),
    // Border crossing fields
    is_cross_border: (shipment as any).is_cross_border || false,
    primary_border_crossing_id: (shipment as any).primary_border_crossing_id || '',
    primary_border_name: (shipment as any).primary_border_name || '',
  };

  return base;
}

export function EditShipmentWizard({ isOpen, onClose, onSuccess, shipment }: EditShipmentWizardProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ShipmentFormData>(() => convertShipmentToFormData(shipment));
  const [errors, setErrors] = useState<Partial<Record<keyof ShipmentFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewValidationErrors, setReviewValidationErrors] = useState<string[]>([]);
  const [initializedForShipment, setInitializedForShipment] = useState(shipment.id);
  const [isLoadingContract, setIsLoadingContract] = useState(false);
  const [contractLines, setContractLines] = useState<any[]>([]);

  // Update formData when shipment ID changes OR when dialog opens
  // This ensures we always have fresh data when the wizard is shown
  useEffect(() => {
    if (isOpen && (shipment.id !== initializedForShipment || !initializedForShipment)) {
      console.log('🔄 Re-initializing formData from shipment:', shipment.id);
      setFormData(convertShipmentToFormData(shipment));
      setInitializedForShipment(shipment.id);
    }
  }, [shipment.id, initializedForShipment, isOpen]);
  
  // Force re-sync when dialog opens (critical for final_destination and other JSONB fields)
  useEffect(() => {
    if (isOpen && shipment.id) {
      console.log('🔄 Dialog opened - syncing formData with shipment');
      setFormData(convertShipmentToFormData(shipment));
    }
  }, [isOpen]);

  // Fetch contract data ONLY as fallback when shipment has empty lines
  // The shipment data should always be the primary source of truth
  useEffect(() => {
    async function fetchContractDataIfNeeded() {
      // Only fetch contract data if:
      // 1. Shipment has a contract_id
      // 2. Shipment has NO product lines (lines are empty)
      // 3. Dialog is open
      const shipmentLines = (shipment as any).lines || [];
      const parsedLines = typeof shipmentLines === 'string' ? JSON.parse(shipmentLines) : shipmentLines;
      
      // If shipment has lines, DON'T fetch from contract - use shipment data as-is
      if (parsedLines && parsedLines.length > 0) {
        console.log('📦 Shipment has', parsedLines.length, 'lines - using shipment data as-is');
        return;
      }
      
      // Only fetch contract if shipment has contract_id but no lines
      if (shipment.contract_id && isOpen) {
        setIsLoadingContract(true);
        try {
          const contract = await contractsService.getContract(shipment.contract_id);
          console.log('📦 Fetched contract for edit wizard (fallback for empty lines):', contract.contract_no);
          
          // Get contract lines from lines array or legacy fields (product_lines, contract_lines)
          const contractData = contract as any;
          const lines = contract.lines || contractData.product_lines || contractData.contract_lines || [];
          setContractLines(lines);
          
          if (lines.length > 0) {
            // Normalize product lines
            const normalizedLines = lines.map((line: any) => ({
              ...line,
              id: line.id || `imported-${Date.now()}-${Math.random()}`,
              product_name: line.product_name || line.type_of_goods || line.product_description || '',
              type_of_goods: line.type_of_goods || line.product_name || '',
              quantity_mt: parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || parseFloat(line.quantity) || 0,
              quantity: parseFloat(line.quantity_mt) || parseFloat(line.planned_qty) || parseFloat(line.quantity) || 0,
              unit_price: parseFloat(line.unit_price) || 0,
              rate_usd_per_mt: parseFloat(line.rate_usd_per_mt) || parseFloat(line.unit_price) * 1000 || 0,
              amount_usd: parseFloat(line.amount_usd) || 0,
              number_of_packages: parseInt(line.number_of_packages) || 0,
              kind_of_packages: line.kind_of_packages || '',
              package_size: parseFloat(line.package_size) || 0,
              package_size_unit: line.package_size_unit || 'KG',
              pricing_method: line.pricing_method || 'per_mt',
              uom: line.uom || line.extra_json?.uom || 'MT',
            }));
            
            console.log('  ✅ Imported', normalizedLines.length, 'lines from contract as fallback');
            
            // ONLY update the lines - don't override other shipment data!
            setFormData(prev => ({
              ...prev,
              lines: normalizedLines,
            }));
          }
        } catch (error) {
          console.error('Error fetching contract for shipment:', error);
        } finally {
          setIsLoadingContract(false);
        }
      }
    }
    
    fetchContractDataIfNeeded();
  }, [shipment.contract_id, shipment.id, isOpen]);

  // Fetch and apply contract fulfillment data to lines for the improved UX
  useEffect(() => {
    async function fetchFulfillmentData() {
      // Only proceed if shipment has a contract_id and lines with contract_line_id
      if (!shipment.contract_id || !isOpen) return;
      
      const hasLinkedLines = formData.lines.some((line: any) => line.contract_line_id);
      if (!hasLinkedLines) {
        console.log('📊 No lines with contract_line_id - skipping fulfillment fetch');
        return;
      }

      try {
        console.log('📊 Fetching contract fulfillment data for edit wizard...');
        const fulfillmentStatus = await contractsService.getFulfillmentStatus(shipment.contract_id);
        
        if (fulfillmentStatus && fulfillmentStatus.lines) {
          // Create a map of contract line fulfillment data
          const fulfillmentMap = new Map(
            fulfillmentStatus.lines.map((line: any) => [line.id, {
              contract_quantity_mt: parseFloat(line.contracted_quantity_mt) || 0,
              shipped_quantity_mt: parseFloat(line.shipped_quantity_mt) || 0,
              pending_quantity_mt: parseFloat(line.pending_quantity_mt) || 0,
            }])
          );

          // Update form data lines with fulfillment information
          setFormData(prev => ({
            ...prev,
            lines: prev.lines.map((line: any) => {
              if (line.contract_line_id && fulfillmentMap.has(line.contract_line_id)) {
                const fulfillment = fulfillmentMap.get(line.contract_line_id);
                // Subtract this shipment's current quantity from shipped to get "other shipments" total
                // This prevents double-counting when editing an existing shipment
                const currentLineQty = parseFloat(line.quantity_mt) || 0;
                const otherShipmentsQty = Math.max(0, (fulfillment?.shipped_quantity_mt || 0) - currentLineQty);
                
                return {
                  ...line,
                  extra_json: {
                    ...(line.extra_json || {}),
                    contract_quantity_mt: fulfillment?.contract_quantity_mt || 0,
                    shipped_quantity_mt: otherShipmentsQty, // Shipped by OTHER shipments (not this one)
                  },
                };
              }
              return line;
            }),
          }));
          console.log('✅ Applied fulfillment data to', fulfillmentStatus.lines.length, 'lines');
        }
      } catch (error) {
        console.error('Error fetching fulfillment data:', error);
      }
    }

    // Delay slightly to ensure formData is initialized
    const timeoutId = setTimeout(fetchFulfillmentData, 100);
    return () => clearTimeout(timeoutId);
  }, [shipment.contract_id, shipment.id, isOpen, formData.lines.length]);

  const totalSteps = 6;
  const stepTitles = [
    t('shipments.wizard.step1Title', 'Basic Info'),
    t('shipments.wizard.step2ProductLinesTitle', 'Product Lines'),
    t('shipments.wizard.step3CommercialTitle', 'Commercial'),
    t('shipments.wizard.step4LogisticsTitle', 'Logistics'),
    t('shipments.wizard.step5DocumentsTitle', 'Documents'),
    t('shipments.wizard.step6ReviewTitle', 'Review'),
  ];

  const handleChange = (field: keyof ShipmentFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user makes changes
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof ShipmentFormData, string>> = {};

    if (step === 1) {
      if (!formData.sn.trim()) {
        newErrors.sn = t('validation.required', 'This field is required');
      }
      if (!formData.product_text.trim()) {
        newErrors.product_text = t('validation.required', 'This field is required');
      }
      
      // Validate final destination based on type
      if (formData.final_destination?.type === 'customer') {
        // External customer: require company name and delivery place
        if (!formData.final_destination?.name?.trim()) {
          newErrors.final_destination = t('validation.customerNameRequired', 'Customer name is required');
        } else if (!formData.final_destination?.delivery_place?.trim()) {
          newErrors.final_destination = t('validation.deliveryPlaceRequired', 'Delivery place is required');
        }
      } else if (formData.final_destination?.type === 'branch') {
        // Branch type: require branch selection
        if (!formData.final_destination?.branch_id) {
          newErrors.final_destination = t('validation.required', 'Please select a branch');
        }
      }
      // Note: consignment type has no special validation - name and delivery_place are optional
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setSubmitError(null);
  };

  const handleStepClick = (step: number) => {
    // In edit mode, allow jumping to any step (all data is pre-filled)
    setCurrentStep(step);
    setSubmitError(null);
    setReviewValidationErrors([]);
  };

  // Navigate directly to a specific step (used by Review step edit links)
  const handleNavigateToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
      setSubmitError(null);
      setReviewValidationErrors([]);
    }
  };

  // Validate commercial & ownership fields required for submission
  const validateReviewFields = (): string[] => {
    const validationErrors: string[] = [];

    // 1. Supplier (for incoming) or Customer (for outgoing) - required
    if (formData.transaction_type === 'incoming') {
      if (!formData.supplier_name && !formData.supplier_id && !formData.supplier_company_id) {
        validationErrors.push(t('shipments.wizard.review.missingSupplier', 'المورد: غير محدد - يرجى تحديد المورد'));
      }
    } else {
      if (!formData.customer_name && !formData.customer_id && !formData.customer_company_id) {
        validationErrors.push(t('shipments.wizard.review.missingCustomer', 'المشتري: غير محدد - يرجى تحديد المشتري'));
      }
    }

    // 2. Final Destination type - required
    if (!formData.final_destination?.type) {
      validationErrors.push(t('shipments.wizard.review.missingFinalDestinationType', 'الوجهة النهائية: لم يتم تحديد نوع الوجهة'));
    } else {
      // 3. Final Owner / Name - required based on type
      if (formData.final_destination.type === 'branch') {
        if (!formData.final_destination.branch_id) {
          validationErrors.push(t('shipments.wizard.review.missingBranch', 'المالك النهائي: لم يتم تحديد الفرع'));
        }
      } else if (formData.final_destination.type === 'customer') {
        if (!formData.final_destination.name?.trim()) {
          validationErrors.push(t('shipments.wizard.review.missingCustomerName', 'المالك النهائي: لم يتم تحديد اسم العميل'));
        }
        if (!formData.final_destination.delivery_place?.trim()) {
          validationErrors.push(t('shipments.wizard.review.missingDeliveryPlace', 'الوجهة النهائية: لم يتم تحديد مكان التسليم'));
        }
      }
      // Consignment type doesn't require name (it's optional)
    }

    return validationErrors;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    // Validate commercial & ownership fields before submission
    const reviewErrors = validateReviewFields();
    if (reviewErrors.length > 0) {
      setReviewValidationErrors(reviewErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setReviewValidationErrors([]);

    try {
      // Prepare data for API (exclude documents as they need separate file upload)
      const shipmentData = {
        transaction_type: formData.transaction_type,
        sn: formData.sn,
        subject: formData.subject,
        product_text: formData.product_text,
        supplier_id: formData.transaction_type === 'incoming' ? (formData.supplier_id || null) : null,
        customer_id: formData.transaction_type === 'outgoing' ? (formData.customer_id || null) : null,
        buyer_id: formData.buyer_id || null,
        buyer_name: formData.buyer_name || null,
        has_broker: formData.has_broker,
        broker_name: formData.broker_name || null,
        cargo_type: formData.cargo_type || null,
        tanker_type: formData.tanker_type || null,
        container_count: formData.container_count || null,
        weight_ton: formData.weight_ton || null,
        weight_unit: formData.weight_unit || 'tons',
        weight_unit_custom: formData.weight_unit_custom || null,
        barrels: formData.barrels || null,
        country_of_export: formData.country_of_export || null,
        fixed_price_usd_per_ton: formData.fixed_price_usd_per_ton || null,
        fixed_price_usd_per_barrel: formData.fixed_price_usd_per_barrel || null,
        selling_price_usd_per_ton: formData.selling_price_usd_per_ton || null,
        selling_price_usd_per_barrel: formData.selling_price_usd_per_barrel || null,
        currency_code: formData.currency_code || 'USD',
        usd_equivalent_rate: formData.usd_equivalent_rate || null,
        payment_terms: formData.payment_terms || null,
        incoterms: formData.incoterms || null,
        // Financial details
        down_payment_type: formData.down_payment_type || null,
        down_payment_percentage: formData.down_payment_percentage || null,
        down_payment_amount: formData.down_payment_amount || null,
        payment_method: formData.payment_method || null,
        payment_method_other: formData.payment_method_other || null,
        swift_code: formData.swift_code || null,
        lc_number: formData.lc_number || null,
        lc_issuing_bank: formData.lc_issuing_bank || null,
        beneficiary_name: formData.beneficiary_name || null,
        beneficiary_bank_name: formData.beneficiary_bank_name || null,
        beneficiary_bank_address: formData.beneficiary_bank_address || null,
        beneficiary_account_number: formData.beneficiary_account_number || null,
        beneficiary_iban: formData.beneficiary_iban || null,
        intermediary_bank: formData.intermediary_bank || null,
        payment_schedule: formData.payment_schedule || [],
        additional_costs: formData.additional_costs || [],
        payment_beneficiaries: formData.payment_beneficiaries || [],
        // Logistics
        is_split_shipment: formData.is_split_shipment,
        batches: formData.batches,
        // Send port IDs - can be UUID, "new:PortName", or port name to be created
        // Backend will resolve/create ports as needed
        pol_id: formData.pol_id || null,
        pod_id: formData.pod_id || null,
        shipping_line_id: formData.shipping_line_id || null,
        // Internal Route (POD → Final Destination)
        is_cross_border: formData.is_cross_border || false,
        primary_border_crossing_id: formData.primary_border_crossing_id || null,
        internal_transport_mode: formData.internal_transport_mode || 'truck',
        etd: formData.etd || null,
        eta: formData.eta || null,
        free_time_days: formData.free_time_days || null,
        customs_clearance_date: formData.customs_clearance_date || null,
        booking_no: formData.booking_no || null,
        bl_no: formData.bl_no || null,
        transportation_cost: formData.transportation_cost || null,
        bol_numbers: formData.bol_numbers || [],
        container_number: formData.container_number || null,
        vessel_name: formData.vessel_name || null,
        vessel_imo: formData.vessel_imo || null,
        truck_plate_number: formData.truck_plate_number || null,
        cmr: formData.cmr || null,
        tanker_name: formData.tanker_name || null,
        tanker_imo: formData.tanker_imo || null,
        notes: formData.notes || null,
        // Product lines - CRITICAL: Must be included for product data to save
        lines: formData.lines || [],
        // Container details - CRITICAL: Must be included for container data to save
        containers: formData.containers || [],
        // Final Destination / Owner
        has_final_destination: formData.has_final_destination || false,
        final_destination: formData.has_final_destination ? formData.final_destination : null,
        // Note: Documents will be uploaded separately after shipment update
        document_count: formData.documents.length, // Just send the count for now
      };

      await updateShipment(shipment.id, shipmentData);
      
      // Upload documents based on upload mode
      const uploadMode = formData.documentUploadMode || 'separate';
      
      // Upload combined document bundle if present and new
      if (uploadMode === 'combined' && formData.combinedDocumentBundle?.file) {
        console.log(`📚 Uploading combined document bundle for shipment ${shipment.id}`);
        try {
          await uploadDocument({
            file: formData.combinedDocumentBundle.file,
            entity_type: 'shipment',
            entity_id: shipment.id,
            doc_type: 'combined_documents' as DocumentType,
            is_draft: false,
            notes: formData.combinedDocumentBundle.containedDocTypes.length > 0
              ? `Contains: ${formData.combinedDocumentBundle.containedDocTypes.join(', ')}`
              : undefined,
          });
          console.log('✅ Combined document bundle uploaded successfully');
        } catch (err) {
          console.warn('⚠️ Failed to upload combined document bundle:', err);
        }
      }
      
      // Upload any new individual documents (documents with File objects are new uploads)
      const newDocuments = formData.documents.filter(doc => doc.file instanceof File);
      if (newDocuments.length > 0) {
        console.log(`📄 Uploading ${newDocuments.length} new documents for shipment ${shipment.id}`);
        
        const uploadResults = await Promise.allSettled(
          newDocuments.map(async (doc) => {
            return uploadDocument({
              file: doc.file as File,
              entity_type: 'shipment',
              entity_id: shipment.id,
              doc_type: doc.type as DocumentType,
              is_draft: false,
              notes: doc.notes || undefined,
            });
          })
        );
        
        // Log any upload errors but don't fail the update
        const uploadErrors = uploadResults.filter(r => r.status === 'rejected');
        if (uploadErrors.length > 0) {
          console.warn(`⚠️ ${uploadErrors.length} document(s) failed to upload:`, uploadErrors);
        }
        
        const successCount = uploadResults.filter(r => r.status === 'fulfilled' && r.value).length;
        console.log(`✅ Successfully uploaded ${successCount} of ${newDocuments.length} documents`);
      }

      // Success!
      setCurrentStep(1);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update shipment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setSubmitError(
        `${t('shipments.wizard.updateError', 'Failed to update shipment')}: ${errorMessage}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData(convertShipmentToFormData(shipment));
      setCurrentStep(1);
      setErrors({});
      setSubmitError(null);
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-xl font-semibold text-gray-900">
                      {t('shipments.editShipment', 'Edit Shipment')} - {shipment.sn}
                    </Dialog.Title>
                    <button
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Progress Stepper */}
                  <div className="mt-6">
                    <ProgressStepper
                      currentStep={currentStep}
                      totalSteps={totalSteps}
                      stepTitles={stepTitles}
                      onStepClick={handleStepClick}
                      allowSkipToAll={true}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
                  {submitError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{submitError}</p>
                    </div>
                  )}

                  {isLoadingContract && (
                    <div className="flex items-center justify-center p-8">
                      <Spinner size="lg" />
                      <span className="ml-3 text-gray-600">{t('common.loadingContractData', 'Loading contract data...')}</span>
                    </div>
                  )}
                  {currentStep === 1 && !isLoadingContract && (
                    <Step1BasicInfo 
                      key={`step1-${shipment.id}`}
                      formData={formData} 
                      onChange={handleChange} 
                      errors={errors} 
                      contractLines={contractLines.length > 0 ? contractLines : formData.lines}
                    />
                  )}
                  {currentStep === 2 && (
                    <Step2ProductLines formData={formData} onChange={handleChange} />
                  )}
                  {currentStep === 3 && (
                    <Step3DeliveryTerms 
                      formData={formData} 
                      onChange={handleChange} 
                      errors={errors} 
                    />
                  )}
                  {currentStep === 4 && (
                    <Step4Logistics formData={formData} onChange={handleChange} errors={errors} />
                  )}
                  {currentStep === 5 && (
                    <Step5Documents formData={formData} onChange={handleChange} errors={errors} />
                  )}
                  {currentStep === 6 && (
                    <Step6Review 
                      formData={formData} 
                      onChange={handleChange} 
                      errors={errors}
                      onNavigateToStep={handleNavigateToStep}
                      validationErrors={reviewValidationErrors}
                    />
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                  <div className="flex justify-between">
                    <div>
                      {currentStep > 1 && (
                        <Button
                          variant="secondary"
                          onClick={handlePrevious}
                          disabled={isSubmitting}
                        >
                          {t('common.previous', 'Previous')}
                        </Button>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={isSubmitting}
                      >
                        {t('common.cancel', 'Cancel')}
                      </Button>

                      {currentStep < totalSteps ? (
                        <Button
                          variant="primary"
                          onClick={handleNext}
                          disabled={isSubmitting}
                        >
                          {t('common.next', 'Next')}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="min-w-[120px]"
                        >
                          {isSubmitting ? (
                            <>
                              <Spinner size="sm" className="me-2" />
                              {t('common.saving', 'Saving...')}
                            </>
                          ) : (
                            t('shipments.wizard.updateShipment', 'Update Shipment')
                          )}
                        </Button>
                      )}
                    </div>
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

