/**
 * FieldHighlighter Component
 * Reads URL parameters to highlight specific form fields in the wizard
 * Used by the Field Mapping Manager to show users where fields are located
 * 
 * Enhanced: Automatically triggers prerequisite conditions for conditional fields
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XMarkIcon, CogIcon } from '@heroicons/react/24/outline';

interface FieldHighlighterProps {
  /** Current step number in the wizard */
  currentStep: number;
  /** Callback to navigate to a specific step */
  onStepChange?: (step: number) => void;
}

/**
 * Field Prerequisites Configuration
 * Maps field names to the conditions that must be triggered to make them visible
 */
interface FieldPrerequisite {
  /** Sequence of triggers to execute before highlighting */
  triggers: Array<{
    /** Type of trigger: select, click, input */
    type: 'select' | 'click' | 'input';
    /** Selector to find the element */
    selector: string;
    /** Value to set (for select/input) */
    value?: string;
    /** Delay after trigger (ms) */
    delay?: number;
  }>;
  /** Human-readable description of what needs to happen */
  description: string;
}

const FIELD_PREREQUISITES: Record<string, FieldPrerequisite> = {
  // ============================================================
  // STEP 1 - Basic Info Fields
  // ============================================================
  
  // Transaction type (always visible, no prerequisites)
  'transaction_type': {
    triggers: [],
    description: 'Transaction type is always visible'
  },
  
  // Contract-related fields
  'has_sales_contract': {
    triggers: [],
    description: 'Contract selection is always visible'
  },
  'contract_id': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="has_sales_contract"][value="true"]', delay: 300 }
    ],
    description: 'Selecting "Yes" for has_sales_contract'
  },
  'sn': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="has_sales_contract"][value="true"]', delay: 300 }
    ],
    description: 'SN field shows when contract is selected'
  },
  
  // Broker fields
  'has_broker': {
    triggers: [],
    description: 'Has broker checkbox is always visible'
  },
  'broker_name': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="has_broker"], #has_broker', delay: 300 }
    ],
    description: 'Enabling "Has Broker" checkbox'
  },
  
  // Dual-purpose supplier/customer fields
  'supplier_id': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="transaction_type"][value="incoming"]', delay: 300 }
    ],
    description: 'Selecting "Incoming" (Buyer/Purchase) transaction type'
  },
  'customer_id': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="transaction_type"][value="outgoing"]', delay: 300 }
    ],
    description: 'Selecting "Outgoing" (Seller/Sale) transaction type'
  },
  
  // Final destination - needs to select a destination type first to show the delivery place input
  'final_destination': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="final_destination_type"][value="customer"]', delay: 400 }
    ],
    description: 'Selecting "External Client" destination type to show final destination field'
  },
  'final_destination_type': {
    triggers: [],
    description: 'Destination type options are always visible'
  },
  
  // ============================================================
  // STEP 2 - Product Lines (Step2ProductLines.tsx)
  // ============================================================
  
  // Adding a product line first - use data-action attribute for reliable selection
  'pricing_method': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'unit_price': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'number_of_packages': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'package_type': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'type_of_goods': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'product_id': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'product_name': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'brand': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'kind_of_packages': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'package_size': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'package_size_unit': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'quantity_mt': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line (auto-calculated field)'
  },
  'unit_size': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line (size/weight of one package unit)'
  },
  'amount_usd': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line (auto-calculated field)'
  },
  
  // Pricing method specific fields
  'number_of_barrels': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 },
      { type: 'select', selector: '[data-field-name="pricing_method"]', value: 'per_barrel', delay: 400 }
    ],
    description: 'Adding product line → Selecting "Price per Barrel"'
  },
  'per_barrel_pricing': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 },
      { type: 'select', selector: '[data-field-name="pricing_method"]', value: 'per_barrel', delay: 400 }
    ],
    description: 'Adding product line → Selecting "Price per Barrel"'
  },
  'number_of_pallets': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 },
      { type: 'select', selector: '[data-field-name="pricing_method"]', value: 'per_pallet', delay: 400 }
    ],
    description: 'Adding product line → Selecting "Price per Pallet"'
  },
  // number_of_containers is a logistics field (Step 4 in Shipments), not a product line field
  'number_of_containers': {
    triggers: [],
    description: 'Container count is a logistics field in Shipment Step 4'
  },
  'volume_cbm': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 },
      { type: 'select', selector: '[data-field-name="pricing_method"]', value: 'per_cbm', delay: 400 }
    ],
    description: 'Adding product line → Selecting "Price per CBM"'
  },
  'volume_liters': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 },
      { type: 'select', selector: '[data-field-name="pricing_method"]', value: 'per_liter', delay: 400 }
    ],
    description: 'Adding product line → Selecting "Price per Liter"'
  },
  
  // ============================================================
  // STEP 3 - Delivery & Payment Terms (Cargo type dependent)
  // ============================================================
  
  // Cargo type always visible
  'cargo_type': {
    triggers: [],
    description: 'Cargo type dropdown is always visible'
  },
  
  // Tanker-specific fields
  'tanker_type': {
    triggers: [
      { type: 'select', selector: '[data-field-name="cargo_type"]', value: 'tankers', delay: 400 }
    ],
    description: 'Selecting "Tankers" cargo type'
  },
  'barrels': {
    triggers: [
      { type: 'select', selector: '[data-field-name="cargo_type"]', value: 'tankers', delay: 400 },
      { type: 'select', selector: '[data-field-name="tanker_type"]', value: 'crude_oil', delay: 300 }
    ],
    description: 'Selecting Tankers → Crude Oil'
  },
  
  // Weight fields (for LPG tankers or general cargo)
  'weight_ton': {
    triggers: [
      { type: 'select', selector: '[data-field-name="cargo_type"]', value: 'general_cargo', delay: 400 }
    ],
    description: 'Selecting "General Cargo" type'
  },
  'weight_unit': {
    triggers: [
      { type: 'select', selector: '[data-field-name="cargo_type"]', value: 'general_cargo', delay: 400 }
    ],
    description: 'Selecting "General Cargo" type'
  },
  'weight_unit_custom': {
    triggers: [
      { type: 'select', selector: '[data-field-name="cargo_type"]', value: 'general_cargo', delay: 400 },
      { type: 'select', selector: '[data-field-name="weight_unit"]', value: 'other', delay: 300 }
    ],
    description: 'Selecting General Cargo → Custom weight unit'
  },
  
  // Container fields
  'container_count': {
    triggers: [
      { type: 'select', selector: '[data-field-name="cargo_type"]', value: 'containers', delay: 400 }
    ],
    description: 'Selecting "Freight Containers" cargo type'
  },
  
  // Incoterms always visible
  'incoterms': {
    triggers: [],
    description: 'Incoterms dropdown is always visible'
  },
  'incoterm': {
    triggers: [],
    description: 'Incoterm dropdown is always visible'
  },
  
  // ============================================================
  // STEP 4 - Logistics Details (Cargo type dependent)
  // ============================================================
  
  // Common logistics fields (always visible)
  'pol_id': {
    triggers: [],
    description: 'Port of Loading is always visible'
  },
  'pod_id': {
    triggers: [],
    description: 'Port of Discharge is always visible'
  },
  'etd': {
    triggers: [],
    description: 'ETD (Estimated Time of Departure) is always visible'
  },
  'eta': {
    triggers: [],
    description: 'ETA (Estimated Time of Arrival) is always visible'
  },
  'free_time_days': {
    triggers: [],
    description: 'Free Time Days is always visible'
  },
  'customs_clearance_date': {
    triggers: [],
    description: 'Customs Clearance Date is always visible'
  },
  'shipping_line_id': {
    triggers: [],
    description: 'Shipping Line is always visible'
  },
  'transportation_cost': {
    triggers: [],
    description: 'Transportation Cost is always visible'
  },
  'booking_no': {
    triggers: [],
    description: 'Booking Number is always visible'
  },
  'bl_no': {
    triggers: [],
    description: 'Bill of Lading Number is always visible'
  },
  
  // Vessel fields (General Cargo ships) - CROSS-STEP: cargo_type is on Step 3
  'vessel_name': {
    triggers: [],
    description: 'CROSS-STEP: First select cargo_type="general_cargo" on Step 3, then navigate to Step 4 to see vessel fields'
  },
  'vessel_imo': {
    triggers: [],
    description: 'CROSS-STEP: First select cargo_type="general_cargo" on Step 3, then navigate to Step 4 to see vessel fields'
  },
  
  // Truck fields - CROSS-STEP: cargo_type is on Step 3
  'truck_plate_number': {
    triggers: [],
    description: 'CROSS-STEP: First select cargo_type="trucks" on Step 3, then navigate to Step 4 to see truck fields'
  },
  'cmr': {
    triggers: [],
    description: 'CROSS-STEP: First select cargo_type="trucks" on Step 3, then navigate to Step 4 to see CMR field'
  },
  
  // Tanker vessel fields - CROSS-STEP: cargo_type is on Step 3
  'tanker_name': {
    triggers: [],
    description: 'CROSS-STEP: First select cargo_type="tankers" on Step 3, then navigate to Step 4 to see tanker fields'
  },
  'tanker_imo': {
    triggers: [],
    description: 'CROSS-STEP: First select cargo_type="tankers" on Step 3, then navigate to Step 4 to see tanker fields'
  },
  
  // Container details (Freight Containers)
  'containers': {
    triggers: [
      // Note: cargo_type is selected on Step 3, then containers section appears on Step 4
      // Auto-trigger only works if containers section is already visible
      { type: 'click', selector: 'button[data-action="add-container"]', delay: 600 }
    ],
    description: 'CROSS-STEP: First select cargo_type="containers" and set container_count on Step 3, then this field appears on Step 4'
  },
  'bol_numbers': {
    triggers: [
      // Note: BOL section only visible when cargo_type='containers' is selected on Step 3
      { type: 'click', selector: 'button[data-action="add-bol"]', delay: 600 }
    ],
    description: 'CROSS-STEP: First select cargo_type="containers" on Step 3, then BOL section appears on Step 4'
  },
  
  // Split shipment and related
  'is_split_shipment': {
    triggers: [],
    description: 'Split shipment toggle is always visible'
  },
  'batches': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="is_split_shipment"]', delay: 400 }
    ],
    description: 'Enabling "Split Shipment" toggle to show batches'
  },
  'notes': {
    triggers: [],
    description: 'Notes field is always visible'
  },
  
  // Product lines (JSONB array)
  'lines': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  
  // Port name fields (derived from ID lookups)
  'pol_name': {
    triggers: [],
    description: 'Port of Loading name (derived from pol_id)'
  },
  'pod_name': {
    triggers: [],
    description: 'Port of Discharge name (derived from pod_id)'
  },
  
  // ============================================================
  // STEP 5 - Documents (always visible, no prerequisites)
  // ============================================================
  
  'documents': {
    triggers: [],
    description: 'Documents section is always visible'
  },
  
  // ============================================================
  // Financial/Payment Fields (Step 2 Financial)
  // ============================================================
  
  // Down payment fields
  'down_payment_type': {
    triggers: [],
    description: 'Down payment type is always visible'
  },
  'down_payment_percentage': {
    triggers: [
      { type: 'select', selector: '[data-field-name="down_payment_type"], select:has-text("Percentage")', value: 'percentage', delay: 300 }
    ],
    description: 'Selecting "Percentage" down payment type'
  },
  'down_payment_amount': {
    triggers: [
      { type: 'select', selector: '[data-field-name="down_payment_type"]', value: 'fixed_amount', delay: 300 }
    ],
    description: 'Selecting "Fixed Amount" down payment type'
  },
  
  // Payment method specific fields
  'payment_method': {
    triggers: [],
    description: 'Payment method is always visible'
  },
  'swift_code': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'swift', delay: 300 }
    ],
    description: 'Selecting "SWIFT Transfer" payment method'
  },
  'beneficiary_bank_name': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'swift', delay: 300 }
    ],
    description: 'Selecting "SWIFT Transfer" payment method'
  },
  'beneficiary_account_number': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'swift', delay: 300 }
    ],
    description: 'Selecting "SWIFT Transfer" payment method'
  },
  'beneficiary_iban': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'swift', delay: 300 }
    ],
    description: 'Selecting "SWIFT Transfer" payment method'
  },
  
  // Letter of Credit fields
  'lc_number': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'letter_of_credit', delay: 300 }
    ],
    description: 'Selecting "Letter of Credit" payment method'
  },
  'lc_amount': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'letter_of_credit', delay: 300 }
    ],
    description: 'Selecting "Letter of Credit" payment method'
  },
  'lc_issuing_bank': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'letter_of_credit', delay: 300 }
    ],
    description: 'Selecting "Letter of Credit" payment method'
  },
  'lc_expiry_date': {
    triggers: [
      { type: 'select', selector: '[data-field-name="payment_method"]', value: 'letter_of_credit', delay: 300 }
    ],
    description: 'Selecting "Letter of Credit" payment method'
  },
  
  // Selling price fields (only for outgoing/seller transactions)
  'selling_price_usd_per_barrel': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="transaction_type"][value="outgoing"]', delay: 300 },
      { type: 'select', selector: '[data-field-name="cargo_type"]', value: 'tankers', delay: 400 },
      { type: 'select', selector: '[data-field-name="tanker_type"]', value: 'crude_oil', delay: 300 }
    ],
    description: 'Selecting Outgoing → Tankers → Crude Oil'
  },
  'selling_price_usd_per_ton': {
    triggers: [
      { type: 'click', selector: 'input[data-field-name="transaction_type"][value="outgoing"]', delay: 300 }
    ],
    description: 'Selecting "Outgoing" (Seller) transaction type'
  },
  
  // ============================================================
  // CONTRACT FIELDS (JSONB sections in extra_json)
  // ============================================================
  
  'commercial_parties': {
    triggers: [],
    description: 'Commercial parties section (Contract Step 1)'
  },
  'shipping': {
    triggers: [],
    description: 'Shipping/Geography section (Contract Step 2)'
  },
  'terms': {
    triggers: [],
    description: 'Payment & delivery terms section'
  },
  'banking_docs': {
    triggers: [],
    description: 'Banking documents section (Contract Step 5)'
  },
  
  // ============================================================
  // FINANCE TRANSACTION FIELDS (NewTransactionWizard.tsx)
  // ============================================================
  
  // Contract/Shipment association
  'shipment_id': {
    triggers: [],
    description: 'Shipment selector is always visible'
  },
  
  // Transaction details
  'transaction_date': {
    triggers: [],
    description: 'Transaction date is always visible'
  },
  'description': {
    triggers: [],
    description: 'Description field is always visible'
  },
  'party_name': {
    triggers: [],
    description: 'Party name is always visible'
  },
  
  // Rate per MT - only in product lines
  'rate_usd_per_mt': {
    triggers: [
      { type: 'click', selector: 'button[data-action="add-product-line"]', delay: 600 }
    ],
    description: 'Adding a product line'
  },
  'amount_other': {
    triggers: [
      { type: 'select', selector: '[data-field-name="currency"]', value: '!USD', delay: 300 }
    ],
    description: 'Selecting a non-USD currency shows other amount field'
  },
  'currency': {
    triggers: [],
    description: 'Currency selector is always visible'
  },
  
  // Direction and fund source
  'direction': {
    triggers: [],
    description: 'Direction (incoming/outgoing) is always visible'
  },
  'fund_source': {
    triggers: [],
    description: 'Fund source is always visible'
  },
  
  // Subject field (always visible)
  'subject': {
    triggers: [],
    description: 'Subject/title is always visible'
  }
};

export function FieldHighlighter({ currentStep, onStepChange }: FieldHighlighterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  
  const highlightField = searchParams.get('highlight');
  const targetStep = searchParams.get('step');
  
  /**
   * Execute a single trigger action
   */
  const executeTrigger = useCallback(async (trigger: FieldPrerequisite['triggers'][0]): Promise<boolean> => {
    const { type, selector, value, delay = 100 } = trigger;
    
    // Try to find the element using multiple selector strategies
    let element: Element | null = null;
    const selectors = selector.split(', ');
    
    for (const sel of selectors) {
      try {
        // Handle special selectors
        if (sel.includes(':has-text(')) {
          // Custom text-based selector
          const match = sel.match(/(.*?):has-text\("(.+?)"\)/);
          if (match) {
            const [, baseSelector, text] = match;
            const candidates = document.querySelectorAll(baseSelector || 'button');
            for (const candidate of candidates) {
              if (candidate.textContent?.includes(text)) {
                element = candidate;
                break;
              }
            }
          }
        } else {
          element = document.querySelector(sel);
        }
        if (element) break;
      } catch {
        // Invalid selector, try next
      }
    }
    
    if (!element) {
      console.log(`[FieldHighlighter] Element not found for selector: ${selector}`);
      return false;
    }
    
    console.log(`[FieldHighlighter] Found element, triggering ${type}`, element);
    
    switch (type) {
      case 'select':
        if (element instanceof HTMLSelectElement && value) {
          element.value = value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
        
      case 'click':
        if (element instanceof HTMLElement) {
          element.click();
        }
        break;
        
      case 'input':
        if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && value) {
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
    }
    
    // Wait for UI to update
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }, []);
  
  /**
   * Execute all prerequisite triggers for a field
   */
  const executePrerequisites = useCallback(async (fieldName: string): Promise<boolean> => {
    const prereq = FIELD_PREREQUISITES[fieldName];
    if (!prereq || prereq.triggers.length === 0) {
      return true; // No prerequisites needed
    }
    
    setIsTriggering(true);
    setTriggerStatus(prereq.description);
    
    console.log(`[FieldHighlighter] Executing prerequisites for ${fieldName}:`, prereq.description);
    
    for (const trigger of prereq.triggers) {
      const success = await executeTrigger(trigger);
      if (!success) {
        console.warn(`[FieldHighlighter] Failed to execute trigger:`, trigger);
        // Continue anyway - element might already be in the right state
      }
    }
    
    // Wait a bit more for DOM to fully update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsTriggering(false);
    setTriggerStatus(null);
    return true;
  }, [executeTrigger]);
  
  useEffect(() => {
    if (!highlightField) return;
    
    // Navigate to the correct step if needed
    const stepNum = targetStep ? parseInt(targetStep) : null;
    if (stepNum && stepNum !== currentStep && onStepChange) {
      onStepChange(stepNum);
      return; // Wait for step change before highlighting
    }
    
    // Find and highlight the field
    const highlightElement = async () => {
      // First, execute any prerequisites
      await executePrerequisites(highlightField);
      
      // Try multiple selectors to find the element
      // Include various data attribute patterns for aliased fields
      const selectors = [
        `[data-field-name="${highlightField}"]`,
        `[data-field-supplier="${highlightField}"]`,
        `[data-field-customer="${highlightField}"]`,
        `[data-field-name-alt="${highlightField}"]`,
        // Product line specific aliases
        `[data-field-product-id="${highlightField}"]`,
        `[data-field-product-name="${highlightField}"]`,
        `[data-field-unit-size="${highlightField}"]`,
        // Port name aliases
        `[data-field-pol-name="${highlightField}"]`,
        `[data-field-pod-name="${highlightField}"]`,
        // Generic fallback for any data-field-* attribute containing the field name
        `[data-field-${highlightField}]`,
      ];
      
      let element: Element | null = null;
      
      // Retry a few times in case element takes time to appear
      for (let attempt = 0; attempt < 3; attempt++) {
        for (const selector of selectors) {
          element = document.querySelector(selector);
          if (element) break;
        }
        if (element) break;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      if (element) {
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight attribute
        element.setAttribute('data-highlighted', 'true');
        
        // Get position for tooltip
        const rect = element.getBoundingClientRect();
        setTooltipPosition({
          top: rect.top + window.scrollY - 50,
          left: rect.left + window.scrollX + rect.width / 2,
        });
        setShowTooltip(true);
        
        // Focus the element if it's an input
        if (element instanceof HTMLInputElement || 
            element instanceof HTMLSelectElement || 
            element instanceof HTMLTextAreaElement) {
          element.focus();
        }
      } else {
        // Show a message that field couldn't be found
        setTriggerStatus(`Field "${highlightField}" not found. It may require additional setup.`);
        setShowTooltip(true);
        setTooltipPosition({ top: 200, left: window.innerWidth / 2 });
      }
    };
    
    // Delay to allow DOM to render
    const timer = setTimeout(highlightElement, 500);
    
    return () => {
      clearTimeout(timer);
      // Clean up highlight from any element that has it
      const highlightedElement = document.querySelector('[data-highlighted="true"]');
      if (highlightedElement) {
        highlightedElement.removeAttribute('data-highlighted');
      }
    };
  }, [highlightField, targetStep, currentStep, onStepChange, executePrerequisites]);
  
  const clearHighlight = () => {
    // Remove highlight param from URL
    searchParams.delete('highlight');
    searchParams.delete('step');
    setSearchParams(searchParams);
    setShowTooltip(false);
    setTriggerStatus(null);
    
    // Remove highlight attribute
    const element = document.querySelector(`[data-highlighted="true"]`);
    if (element) {
      element.removeAttribute('data-highlighted');
    }
  };
  
  if (!highlightField) return null;
  
  // Show loading state while triggering prerequisites
  if (isTriggering) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 pointer-events-none">
        <div className="bg-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 pointer-events-auto">
          <CogIcon className="h-6 w-6 text-blue-600 animate-spin" />
          <div>
            <p className="font-medium text-gray-900">Preparing field view...</p>
            <p className="text-sm text-gray-500">{triggerStatus}</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!showTooltip) return null;
  
  return (
    <>
      {/* Floating tooltip showing field name */}
      <div
        className="fixed z-50 transform -translate-x-1/2 pointer-events-auto"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
          <span className="text-sm font-medium">
            {triggerStatus ? (
              <span className="text-yellow-200">{triggerStatus}</span>
            ) : (
              <>Field: <code className="bg-blue-700 px-1 rounded">{highlightField}</code></>
            )}
          </span>
          <button
            onClick={clearHighlight}
            className="p-1 hover:bg-blue-700 rounded transition-colors"
            title="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        {/* Arrow pointing down */}
        {!triggerStatus && (
          <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-blue-600 mx-auto" />
        )}
      </div>
      
      {/* Global styles for highlighted elements */}
      <style>{`
        [data-highlighted="true"] {
          animation: field-pulse 2s ease-in-out infinite;
          outline: 3px solid #3b82f6 !important;
          outline-offset: 4px !important;
          border-radius: 4px;
        }
        
        @keyframes field-pulse {
          0%, 100% {
            outline-color: #3b82f6;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% {
            outline-color: #60a5fa;
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
        }
      `}</style>
    </>
  );
}

export default FieldHighlighter;

/**
 * Export the prerequisites for use in the Field Mapping Manager
 * This allows showing prerequisites in the UI
 */
export const getFieldPrerequisites = (fieldName: string): FieldPrerequisite | null => {
  return FIELD_PREREQUISITES[fieldName] || null;
};

export type { FieldPrerequisite };
