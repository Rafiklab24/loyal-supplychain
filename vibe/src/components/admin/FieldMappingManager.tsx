/**
 * Field Mapping Manager Component
 * Interactive UI for managing and approving field mappings between frontend, API, and database
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  CircleStackIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../../services/api';
import { getFieldPrerequisites } from '../common/FieldHighlighter';

// ============================================================
// Types
// ============================================================

interface FieldMapping {
  id: string;
  module: string;
  component: string;
  frontend_field: string;
  api_field: string;
  db_table: string;
  db_column: string;
  data_type: string;
  required: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'deprecated' | 'mismatch';
  notes: string;
}

interface AuditReport {
  generated_at: string;
  version: string;
  summary: {
    total_components: number;
    total_fields: number;
    by_status: Record<string, number>;
    by_module: Record<string, number>;
  };
  components: {
    component: string;
    path: string;
    module: string;
    fields: FieldMapping[];
    total_fields: number;
  }[];
  mismatches: FieldMapping[];
  deprecated_fields: FieldMapping[];
}

interface FieldMappingManagerProps {
  initialData?: AuditReport;
}

// ============================================================
// Status Badge Component
// ============================================================

const StatusBadge: React.FC<{ status: FieldMapping['status'] }> = ({ status }) => {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
    deprecated: 'bg-gray-100 text-gray-600 border-gray-300',
    mismatch: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  const icons: Record<string, React.ReactNode> = {
    pending: <ExclamationTriangleIcon className="w-3.5 h-3.5" />,
    approved: <CheckCircleIcon className="w-3.5 h-3.5" />,
    rejected: <XCircleIcon className="w-3.5 h-3.5" />,
    deprecated: <DocumentTextIcon className="w-3.5 h-3.5" />,
    mismatch: <ExclamationTriangleIcon className="w-3.5 h-3.5" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ============================================================
// Component Display Names - Maps filenames to user-friendly names
// ============================================================

const COMPONENT_DISPLAY_NAMES: Record<string, string> = {
  // Shipment Wizard Steps
  'Step1BasicInfo.tsx': 'Step 1: Basic Information',
  'Step2ProductLines.tsx': 'Step 2: Product Lines',
  'Step3DeliveryTerms.tsx': 'Step 3: Delivery & Payment Terms',
  'Step4Logistics.tsx': 'Step 4: Logistics & Shipping',
  'Step5Documents.tsx': 'Step 5: Documents',
  'Step6Review.tsx': 'Step 6: Review & Submit',
  'BatchManagement.tsx': 'Batch Management',
  'BOLUploadSection.tsx': 'BOL Upload Section',
  // Legacy shipment wizard files (deleted but may still be in cached mapping data)
  'Step2Financial.tsx': 'Step 2: Financial (Legacy)',
  
  // Contract Wizard Steps
  'Step1CommercialParties.tsx': 'Step 1: Commercial Parties',
  'Step2ShippingGeography.tsx': 'Step 2: Shipping Geography',
  'Step3TermsPayment.tsx': 'Step 3: Terms & Payment',
  'Step4ProductLines.tsx': 'Step 4: Product Lines',
  'Step5BankingDocs.tsx': 'Step 5: Banking & Documents',
  // Legacy V2 names (for backward compatibility with cached data)
  'Step1CommercialPartiesV2.tsx': 'Step 1: Commercial Parties',
  'Step2ShippingGeographyV2.tsx': 'Step 2: Shipping Geography',
  'Step3TermsPaymentV2.tsx': 'Step 3: Terms & Payment',
  'Step4ProductLinesV2.tsx': 'Step 4: Product Lines',
  'Step5BankingDocsV2.tsx': 'Step 5: Banking & Documents',
  
  // Finance
  'NewTransactionWizard.tsx': 'New Transaction Form',
  'FinancialWizard.tsx': 'Financial Wizard',
  
  // Products
  'ProductFormModal.tsx': 'Product Form',
  'PriceBenchmarkModal.tsx': 'Price Benchmark Form',
  'SeasonFormModal.tsx': 'Season Form',
  
  // Companies
  'BankingInfoForm.tsx': 'Banking Information Form',
  
  // Customs
  'CustomsClearingCostModal.tsx': 'Customs Clearing Cost Form',
  'FileFirstCostEntry.tsx': 'First Cost Entry Form',
  'CreateBatchModal.tsx': 'Create Batch Form',
  
  // Land Transport
  'DeliveryFormModal.tsx': 'Delivery Form',
  
  // Common/Shared
  'DeliveryPaymentTerms.tsx': 'Delivery & Payment Terms (Shared)',
};

// Helper function to get display name
const getComponentDisplayName = (filename: string): string => {
  return COMPONENT_DISPLAY_NAMES[filename] || filename;
};

// ============================================================
// Main Component
// ============================================================

export function FieldMappingManager({ initialData }: FieldMappingManagerProps) {
  useTranslation(); // Hook called for potential future translations
  
  // State
  const [data, setData] = useState<AuditReport | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [selectedMappings, setSelectedMappings] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  
  // Load data from API
  useEffect(() => {
    if (!initialData) {
      loadData();
    }
  }, [initialData]);
  
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/field-mappings');
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  // Refresh data (re-run audit)
  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/field-mappings/refresh');
      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  };
  
  // Get all fields flattened
  const allFields = useMemo(() => {
    if (!data) return [];
    return data.components.flatMap(comp => comp.fields);
  }, [data]);
  
  // Get unique modules
  const modules = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.summary.by_module);
  }, [data]);
  
  // Filter fields
  const filteredFields = useMemo(() => {
    return allFields.filter(field => {
      const matchesSearch = 
        searchTerm === '' ||
        field.frontend_field.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.api_field.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.db_table.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.component.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesModule = selectedModule === 'all' || field.module === selectedModule;
      const matchesStatus = selectedStatus === 'all' || field.status === selectedStatus;
      
      return matchesSearch && matchesModule && matchesStatus;
    });
  }, [allFields, searchTerm, selectedModule, selectedStatus]);
  
  // Group filtered fields by component
  const groupedFields = useMemo(() => {
    const groups: Record<string, FieldMapping[]> = {};
    filteredFields.forEach(field => {
      const key = `${field.module}:${field.component}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(field);
    });
    return groups;
  }, [filteredFields]);
  
  // Toggle component expansion
  const toggleComponent = (key: string) => {
    setExpandedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };
  
  // Expand/collapse all
  const expandAll = () => {
    setExpandedComponents(new Set(Object.keys(groupedFields)));
  };
  
  const collapseAll = () => {
    setExpandedComponents(new Set());
  };
  
  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedMappings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  // Select all visible
  const selectAllVisible = () => {
    setSelectedMappings(new Set(filteredFields.map(f => f.id)));
  };
  
  // Clear selection
  const clearSelection = () => {
    setSelectedMappings(new Set());
  };
  
  // Update field status
  const updateStatus = async (ids: string[], newStatus: FieldMapping['status']) => {
    try {
      await apiClient.put('/field-mappings/bulk-update', { ids, status: newStatus });
      
      // Update local state
      if (data) {
        const updatedComponents = data.components.map(comp => ({
          ...comp,
          fields: comp.fields.map(field => 
            ids.includes(field.id) ? { ...field, status: newStatus } : field
          ),
        }));
        
        setData({
          ...data,
          components: updatedComponents,
        });
      }
      
      clearSelection();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update');
    }
  };
  
  // Update field note
  const updateNote = async (id: string, note: string) => {
    try {
      await apiClient.put(`/field-mappings/${id}`, { notes: note });
      
      // Update local state
      if (data) {
        const updatedComponents = data.components.map(comp => ({
          ...comp,
          fields: comp.fields.map(field => 
            field.id === id ? { ...field, notes: note } : field
          ),
        }));
        
        setData({
          ...data,
          components: updatedComponents,
        });
      }
      
      setEditingNote(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update note');
    }
  };
  
  // Export to JSON
  const exportToJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field-mappings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Helper function to get the URL for showing a field in the UI
  const getShowInUIUrl = (field: FieldMapping): string | null => {
    // Module-specific field mappings (Module:FieldName -> Route)
    // This allows the same field name to map to different routes based on module
    const moduleFieldMappings: Record<string, { route: string; step: number; fieldAlias?: string }> = {
      // ============================================================
      // CONTRACT MODULE FIELDS
      // ============================================================
      // Section-level JSONB fields
      'Contracts:commercial_parties': { route: '/contracts/new', step: 1 }, // Highlights section header
      'Contracts:shipping': { route: '/contracts/new', step: 3 }, // Highlights the section header
      'Contracts:terms': { route: '/contracts/new', step: 4 }, // Highlights section header
      'Contracts:banking_docs': { route: '/contracts/new', step: 5 }, // Highlights section header
      'Contracts:direction': { route: '/contracts/new', step: 1 },
      // Step 1 - Commercial Parties
      'Contracts:proforma_number': { route: '/contracts/new', step: 1 },
      'Contracts:invoice_date': { route: '/contracts/new', step: 1 },
      'Contracts:other_reference': { route: '/contracts/new', step: 1 },
      'Contracts:exporter_company_id': { route: '/contracts/new', step: 1 },
      'Contracts:exporter_name': { route: '/contracts/new', step: 1 },
      'Contracts:buyer_company_id': { route: '/contracts/new', step: 1 },
      'Contracts:buyer_name': { route: '/contracts/new', step: 1 },
      'Contracts:consignee_same_as_buyer': { route: '/contracts/new', step: 1 },
      'Contracts:consignee_company_id': { route: '/contracts/new', step: 1 },
      'Contracts:consignee_name': { route: '/contracts/new', step: 1 },
      'Contracts:broker_buying_name': { route: '/contracts/new', step: 1 },
      'Contracts:broker_selling_name': { route: '/contracts/new', step: 1 },
      // Step 2 - Product Lines (individual line items)
      'Contracts:lines': { route: '/contracts/new', step: 2 },
      'Contracts:type': { route: '/contracts/new', step: 2, fieldAlias: 'type_of_goods' },
      'Contracts:type_of_goods': { route: '/contracts/new', step: 2 },
      'Contracts:brand': { route: '/contracts/new', step: 2 },
      'Contracts:kind_of_packages': { route: '/contracts/new', step: 2 },
      'Contracts:number_of_packages': { route: '/contracts/new', step: 2 },
      'Contracts:package_size': { route: '/contracts/new', step: 2 },
      'Contracts:package_size_unit': { route: '/contracts/new', step: 2 },
      'Contracts:unit_size': { route: '/contracts/new', step: 2, fieldAlias: 'package_size' },
      // Product line fields (hidden markers in empty state for fallback)
      'Contracts:quantity_mt': { route: '/contracts/new', step: 2 },
      'Contracts:pricing_method': { route: '/contracts/new', step: 2 },
      'Contracts:unit_price': { route: '/contracts/new', step: 2 },
      'Contracts:rate_usd_per_mt': { route: '/contracts/new', step: 2 },
      'Contracts:amount_usd': { route: '/contracts/new', step: 2 },
      'Contracts:number_of_pallets': { route: '/contracts/new', step: 2 },
      'Contracts:volume_cbm': { route: '/contracts/new', step: 2 },
      'Contracts:volume_liters': { route: '/contracts/new', step: 2 },
      'Contracts:product_id': { route: '/contracts/new', step: 2, fieldAlias: 'type_of_goods' },
      'Contracts:product_name': { route: '/contracts/new', step: 2, fieldAlias: 'type_of_goods' },
      'Contracts:tolerance_percentage': { route: '/contracts/new', step: 4, fieldAlias: 'special_clauses' },
      'Contracts:description': { route: '/contracts/new', step: 4, fieldAlias: 'special_clauses' },
      'Contracts:special_clauses': { route: '/contracts/new', step: 4 },
      // Step 3 - Shipping Geography
      'Contracts:country_of_origin': { route: '/contracts/new', step: 3 },
      'Contracts:country_of_final_destination': { route: '/contracts/new', step: 3 },
      'Contracts:port_of_loading_id': { route: '/contracts/new', step: 3 },
      'Contracts:port_of_loading_name': { route: '/contracts/new', step: 3 },
      'Contracts:final_destination_id': { route: '/contracts/new', step: 3 },
      'Contracts:final_destination_name': { route: '/contracts/new', step: 3 },
      'Contracts:estimated_shipment_date': { route: '/contracts/new', step: 3 },
      // Step 4 - Terms & Payment
      'Contracts:cargo_type': { route: '/contracts/new', step: 4 },
      'Contracts:incoterm': { route: '/contracts/new', step: 4 },
      'Contracts:delivery_terms_detail': { route: '/contracts/new', step: 4 },
      'Contracts:payment_terms': { route: '/contracts/new', step: 4 },
      'Contracts:payment_method': { route: '/contracts/new', step: 4 },
      'Contracts:currency_code': { route: '/contracts/new', step: 4 },
      // Step 5 - Banking & Documents
      'Contracts:beneficiary_name': { route: '/contracts/new', step: 5 },
      'Contracts:beneficiary_address': { route: '/contracts/new', step: 5 },
      'Contracts:beneficiary_account_no': { route: '/contracts/new', step: 5 },
      'Contracts:beneficiary_bank_name': { route: '/contracts/new', step: 5 },
      'Contracts:beneficiary_bank_address': { route: '/contracts/new', step: 5 },
      'Contracts:beneficiary_swift_code': { route: '/contracts/new', step: 5 },
      'Contracts:correspondent_bank': { route: '/contracts/new', step: 5 },
      'Contracts:documentation_responsibility': { route: '/contracts/new', step: 5 },
      'Contracts:documentation_notes': { route: '/contracts/new', step: 5 },
      
      // ============================================================
      // PRODUCTS MODULE FIELDS (ProductFormModal.tsx)
      // ============================================================
      'Products:name': { route: '/products', step: 1 },
      'Products:sku': { route: '/products', step: 1 },
      'Products:hs_code': { route: '/products', step: 1 },
      'Products:category_type': { route: '/products', step: 1 },
      'Products:brand': { route: '/products', step: 1 },
      'Products:uom': { route: '/products', step: 1 },
      'Products:pack_type': { route: '/products', step: 1 },
      'Products:is_seasonal': { route: '/products', step: 1 },
      'Products:description': { route: '/products', step: 1 },
      // Price Benchmark Form (PriceBenchmarkModal.tsx)
      'Products:price_usd_per_mt': { route: '/products', step: 2 },
      'Products:price_date': { route: '/products', step: 2 },
      'Products:price_source': { route: '/products', step: 2 },
      'Products:incoterm': { route: '/products', step: 2 },
      'Products:product_id': { route: '/products', step: 2 },
      'Products:product_name': { route: '/products', step: 2 },
      // Season Form (SeasonFormModal.tsx)
      'Products:origin_country': { route: '/products', step: 3 },
      'Products:planting_start_month': { route: '/products', step: 3 },
      'Products:planting_end_month': { route: '/products', step: 3 },
      'Products:harvest_start_month': { route: '/products', step: 3 },
      'Products:harvest_end_month': { route: '/products', step: 3 },
      'Products:peak_start_month': { route: '/products', step: 3 },
      'Products:peak_end_month': { route: '/products', step: 3 },
      'Products:off_season_start_month': { route: '/products', step: 3 },
      'Products:off_season_end_month': { route: '/products', step: 3 },
      'Products:notes': { route: '/products', step: 3 },
      
      // ============================================================
      // COMPANIES MODULE FIELDS (BankingInfoForm.tsx)
      // ============================================================
      'Companies:bank_name': { route: '/companies', step: 1 },
      'Companies:bank_branch': { route: '/companies', step: 1 },
      'Companies:branch': { route: '/companies', step: 1 },
      'Companies:account_number': { route: '/companies', step: 1 },
      'Companies:account_holder_name': { route: '/companies', step: 1 },
      'Companies:iban': { route: '/companies', step: 1 },
      'Companies:swift_code': { route: '/companies', step: 1 },
      'Companies:currency': { route: '/companies', step: 1 },
      'Companies:bank_address': { route: '/companies', step: 1 },
      'Companies:intermediary_bank': { route: '/companies', step: 1 },
      
      // ============================================================
      // FINANCE MODULE FIELDS (FinancialWizard.tsx & NewTransactionWizard.tsx)
      // ============================================================
      'Finance:transaction_date': { route: '/finance', step: 1 },
      'Finance:amount_usd': { route: '/finance', step: 1 },
      'Finance:amount_other': { route: '/finance', step: 1 },
      'Finance:currency': { route: '/finance', step: 1 },
      'Finance:transaction_type': { route: '/finance', step: 1 },
      'Finance:direction': { route: '/finance', step: 1 },
      'Finance:fund_source': { route: '/finance', step: 1 },
      'Finance:party_name': { route: '/finance', step: 1 },
      'Finance:description': { route: '/finance', step: 1 },
      'Finance:contract_id': { route: '/finance', step: 1 },
      'Finance:shipment_id': { route: '/finance', step: 1 },
      
      // ============================================================
      // CUSTOMS CLEARANCE MODULE FIELDS (CustomsClearingCostModal.tsx)
      // ============================================================
      'CustomsClearance:file_number': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:shipment_id': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:transaction_type': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:goods_type': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:containers_cars_count': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:goods_weight': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:cost_description': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:clearance_type': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:payment_status': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:currency': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:total_clearing_cost': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:original_clearing_amount': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:extra_cost_amount': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:extra_cost_description': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:cost_responsibility': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:destination_final_beneficiary': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:bol_number': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:car_plate': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:client_name': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:invoice_number': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:invoice_amount': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:invoice_date': { route: '/customs-clearing-costs', step: 1 },
      'CustomsClearance:notes': { route: '/customs-clearing-costs', step: 1 },
      
      // ============================================================
      // LAND TRANSPORT MODULE FIELDS (DeliveryFormModal.tsx)
      // ============================================================
      'LandTransport:shipment_id': { route: '/land-transport', step: 1 },
      'LandTransport:delivery_date': { route: '/land-transport', step: 1 },
      'LandTransport:delivery_type': { route: '/land-transport', step: 1 },
      'LandTransport:status': { route: '/land-transport', step: 1 },
      'LandTransport:driver_name': { route: '/land-transport', step: 1 },
      'LandTransport:vehicle_number': { route: '/land-transport', step: 1 },
      'LandTransport:notes': { route: '/land-transport', step: 1 },
      'LandTransport:destination': { route: '/land-transport', step: 1 },
      'LandTransport:origin': { route: '/land-transport', step: 1 },
      'LandTransport:transport_company_id': { route: '/land-transport', step: 1 },
      'LandTransport:vehicle_type': { route: '/land-transport', step: 1 },
      'LandTransport:truck_plate_number': { route: '/land-transport', step: 1 },
      'LandTransport:driver_phone': { route: '/land-transport', step: 1 },
      'LandTransport:goods_description': { route: '/land-transport', step: 1 },
      'LandTransport:container_id': { route: '/land-transport', step: 1 },
      'LandTransport:package_count': { route: '/land-transport', step: 1 },
      'LandTransport:weight_kg': { route: '/land-transport', step: 1 },
      'LandTransport:customer_name': { route: '/land-transport', step: 1 },
      'LandTransport:customer_phone': { route: '/land-transport', step: 1 },
      'LandTransport:transport_cost': { route: '/land-transport', step: 1 },
      'LandTransport:selling_price': { route: '/land-transport', step: 1 },
    };
    
    // Generic field mappings (for fields not duplicated across modules)
    const fieldToStepOverrides: Record<string, { route: string; step: number; fieldAlias?: string }> = {
      // ============================================================
      // SHIPMENT WIZARD - Step 1 - Basic Info
      // ============================================================
      'transaction_type': { route: '/shipments', step: 1 },
      'customer_id': { route: '/shipments', step: 1 },
      'supplier_id': { route: '/shipments', step: 1 },
      'shipment_number': { route: '/shipments', step: 1 },
      'sn': { route: '/shipments', step: 1 },
      'subject': { route: '/shipments', step: 1 },
      'has_sales_contract': { route: '/shipments', step: 1 },
      'contract_id': { route: '/shipments', step: 1 },
      'has_broker': { route: '/contracts/new', step: 1 },
      'broker_name': { route: '/contracts/new', step: 1 },
      'final_destination': { route: '/shipments', step: 1 },
      
      // ============================================================
      // SHIPMENT WIZARD - Step 2 - Product Lines
      // ============================================================
      'lines': { route: '/shipments', step: 2 },
      'product_id': { route: '/shipments', step: 2 },
      'product_name': { route: '/shipments', step: 2 },
      'type_of_goods': { route: '/shipments', step: 2 },
      'brand': { route: '/shipments', step: 2 },
      'kind_of_packages': { route: '/shipments', step: 2 },
      'number_of_packages': { route: '/shipments', step: 2 },
      'package_size': { route: '/shipments', step: 2 },
      'package_size_unit': { route: '/shipments', step: 2 },
      'unit_size': { route: '/shipments', step: 2 },
      'pricing_method': { route: '/shipments', step: 2 },
      'number_of_barrels': { route: '/shipments', step: 2 },
      'quantity_mt': { route: '/shipments', step: 2 },
      'unit_price': { route: '/shipments', step: 2 },
      'amount_usd': { route: '/shipments', step: 2 },
      
      // ============================================================
      // SHIPMENT WIZARD - Step 3 - Delivery/Payment Terms
      // ============================================================
      'cargo_type': { route: '/shipments', step: 3 },
      'tanker_type': { route: '/shipments', step: 3 },
      'container_count': { route: '/shipments', step: 3 },
      'weight_ton': { route: '/shipments', step: 3 },
      'weight_unit': { route: '/shipments', step: 3 },
      'weight_unit_custom': { route: '/shipments', step: 3 },
      'barrels': { route: '/shipments', step: 3 },
      'bags_count': { route: '/shipments', step: 3 },
      'incoterms': { route: '/shipments', step: 3 },
      'incoterm': { route: '/shipments', step: 3 },
      'payment_terms': { route: '/shipments', step: 3 },
      'terms': { route: '/shipments', step: 3 },
      'down_payment_type': { route: '/shipments', step: 3 },
      'down_payment_percentage': { route: '/shipments', step: 3 },
      'down_payment_amount': { route: '/shipments', step: 3 },
      'payment_method': { route: '/shipments', step: 3 },
      
      // ============================================================
      // SHIPMENT WIZARD - Step 4 - Logistics
      // ============================================================
      'container_number': { route: '/shipments', step: 4, fieldAlias: 'containers' },
      'containers': { route: '/shipments', step: 4 },
      'bol_numbers': { route: '/shipments', step: 4 },
      'net_weight_kg': { route: '/shipments', step: 4 },
      'gross_weight_kg': { route: '/shipments', step: 4 },
      'package_count': { route: '/shipments', step: 4 },
      'seal_number': { route: '/shipments', step: 4 },
      'pol_id': { route: '/shipments', step: 4 },
      'pol_name': { route: '/shipments', step: 4 },
      'pod_id': { route: '/shipments', step: 4 },
      'pod_name': { route: '/shipments', step: 4 },
      'shipping_line_id': { route: '/shipments', step: 4 },
      'transportation_cost': { route: '/shipments', step: 4 },
      'etd': { route: '/shipments', step: 4 },
      'eta': { route: '/shipments', step: 4 },
      'free_time_days': { route: '/shipments', step: 4 },
      'customs_clearance_date': { route: '/shipments', step: 4 },
      'booking_no': { route: '/shipments', step: 4 },
      'bl_no': { route: '/shipments', step: 4 },
      'vessel_name': { route: '/shipments', step: 4 },
      'vessel_imo': { route: '/shipments', step: 4 },
      'tanker_name': { route: '/shipments', step: 4 },
      'tanker_imo': { route: '/shipments', step: 4 },
      'truck_plate_number': { route: '/shipments', step: 4 },
      'cmr': { route: '/shipments', step: 4 },
      'is_split_shipment': { route: '/shipments', step: 4 },
      'batches': { route: '/shipments', step: 4 },
      'notes': { route: '/shipments', step: 4 },
      
      // ============================================================
      // SHIPMENT WIZARD - Step 5 - Documents
      // ============================================================
      'documents': { route: '/shipments', step: 5 },
      
      // ============================================================
      // FINANCE TRANSACTION FIELDS
      // ============================================================
      'shipment_id': { route: '/finance', step: 1 },
      'transaction_date': { route: '/finance', step: 1 },
      'description': { route: '/finance', step: 1 },
      'party_name': { route: '/finance', step: 1 },
      'currency': { route: '/finance', step: 1 },
      'amount_other': { route: '/finance', step: 1 },
      'fund_source': { route: '/finance', step: 1 },
    };
    
    const componentRouteMap: Record<string, { route: string; step: number }> = {
      // Shipment wizard steps (modal on /shipments page)
      // Note: Component names don't match step numbers due to refactoring
      'Step1BasicInfo.tsx': { route: '/shipments', step: 1 },
      'Step2ProductLines.tsx': { route: '/shipments', step: 2 }, // Product Lines
      'Step3DeliveryTerms.tsx': { route: '/shipments', step: 3 }, // Delivery/Payment Terms
      'DeliveryPaymentTerms.tsx': { route: '/shipments', step: 3 }, // Shared component (legacy mapping)
      'Step4Logistics.tsx': { route: '/shipments', step: 4 }, // Logistics
      'Step3Logistics.tsx': { route: '/shipments', step: 4 }, // Legacy alias
      'Step5Documents.tsx': { route: '/shipments', step: 5 }, // Documents
      'Step6Review.tsx': { route: '/shipments', step: 6 }, // Review
      'Step4Review.tsx': { route: '/shipments', step: 6 }, // Legacy alias
      // Contract wizard steps (on /contracts/new page)
      'Step1CommercialParties.tsx': { route: '/contracts/new', step: 1 },
      'Step2ShippingGeography.tsx': { route: '/contracts/new', step: 3 }, // Step 3 in UI
      'Step3TermsPayment.tsx': { route: '/contracts/new', step: 4 }, // Step 4 in UI (DeliveryPaymentTerms)
      'Step4ProductLines.tsx': { route: '/contracts/new', step: 2 }, // Step 2 in UI
      'Step5BankingDocs.tsx': { route: '/contracts/new', step: 5 },
      // Finance
      'NewTransactionWizard.tsx': { route: '/finance', step: 1 },
      'FinancialWizard.tsx': { route: '/finance', step: 1 },
      // Products
      'ProductFormModal.tsx': { route: '/products', step: 1 },
      'PriceBenchmarkModal.tsx': { route: '/products', step: 2 },
      'SeasonFormModal.tsx': { route: '/products', step: 3 },
      // Companies
      'BankingInfoForm.tsx': { route: '/companies', step: 1 },
      // Customs Clearance
      'CustomsClearingCostModal.tsx': { route: '/customs-clearing-costs', step: 1 },
      'FileFirstCostEntry.tsx': { route: '/customs-clearing-costs', step: 1 },
      'CreateBatchModal.tsx': { route: '/customs-clearing-batches', step: 1 },
      // Land Transport
      'DeliveryFormModal.tsx': { route: '/land-transport', step: 1 },
    };
    
    // Extract the actual field name from array notation (e.g., "lines[].product_id" -> "product_id")
    let fieldName = field.frontend_field;
    if (fieldName.includes('[].')) {
      fieldName = fieldName.split('[].').pop() || fieldName;
    }
    // Also handle array index notation (e.g., "lines[0].product_id" -> "product_id")
    if (fieldName.includes('[')) {
      const match = fieldName.match(/\[.*?\]\.?(.+)$/);
      if (match) {
        fieldName = match[1];
      }
    }
    
    // 1. First check module-specific field mapping (handles fields that exist in multiple modules)
    const moduleFieldKey = `${field.module}:${fieldName}`;
    const moduleFieldOverride = moduleFieldMappings[moduleFieldKey];
    if (moduleFieldOverride) {
      const highlightField = moduleFieldOverride.fieldAlias || fieldName;
      return `${moduleFieldOverride.route}?highlight=${encodeURIComponent(highlightField)}&step=${moduleFieldOverride.step}`;
    }
    
    // 2. Check for generic field-specific override (for fields unique to one module)
    const fieldOverride = fieldToStepOverrides[fieldName];
    if (fieldOverride) {
      const highlightField = fieldOverride.fieldAlias || fieldName;
      return `${fieldOverride.route}?highlight=${encodeURIComponent(highlightField)}&step=${fieldOverride.step}`;
    }
    
    // 3. Fall back to component-based mapping
    const mapping = componentRouteMap[field.component];
    if (!mapping) return null;
    
    return `${mapping.route}?highlight=${encodeURIComponent(fieldName)}&step=${mapping.step}`;
  };
  
  // Open field in UI in a new tab
  const showFieldInUI = (field: FieldMapping) => {
    const url = getShowInUIUrl(field);
    if (url) {
      window.open(url, '_blank');
    }
  };
  
  // Render loading state
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <ArrowPathIcon className="w-6 h-6 animate-spin" />
          <span>Loading field mappings...</span>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-6 h-6" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (!data) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <CircleStackIcon className="w-8 h-8 text-indigo-600" />
                Field Mapping Manager
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Manage mappings between frontend fields, API endpoints, and database columns
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={exportToJson}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{data.summary.total_fields}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Total Fields</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-amber-600">{data.summary.by_status.pending || 0}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Pending</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-emerald-600">{data.summary.by_status.approved || 0}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Approved</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-red-600">{data.summary.by_status.rejected || 0}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Rejected</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-rose-600">{data.summary.by_status.mismatch || 0}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Mismatches</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-600">{data.summary.total_components}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Components</div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search fields, components, tables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Module Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-slate-400" />
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">All Modules</option>
                {modules.map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
            </div>
            
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="mismatch">Mismatch</option>
              <option value="deprecated">Deprecated</option>
            </select>
            
            {/* Expand/Collapse */}
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
          
          {/* Selection Actions */}
          {selectedMappings.size > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {selectedMappings.size} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateStatus(Array.from(selectedMappings), 'approved')}
                  className="px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-1"
                >
                  <CheckCircleIcon className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => updateStatus(Array.from(selectedMappings), 'rejected')}
                  className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => updateStatus(Array.from(selectedMappings), 'deprecated')}
                  className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Mark Deprecated
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Results Info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Showing {filteredFields.length} of {allFields.length} fields
          </p>
          <button
            onClick={selectAllVisible}
            className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Select all visible
          </button>
        </div>
        
        {/* Field Groups */}
        <div className="space-y-4">
          {Object.entries(groupedFields).map(([key, fields]) => {
            const [module, component] = key.split(':');
            const isExpanded = expandedComponents.has(key);
            
            return (
              <div
                key={key}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleComponent(key)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-slate-400" />
                    )}
                    <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                      {module}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <CodeBracketIcon className="w-4 h-4 text-slate-400" />
                      {getComponentDisplayName(component)}
                    </span>
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {fields.length} fields
                  </span>
                </button>
                
                {/* Field Table */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left w-10">
                            <input
                              type="checkbox"
                              checked={fields.every(f => selectedMappings.has(f.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMappings(prev => {
                                    const newSet = new Set(prev);
                                    fields.forEach(f => newSet.add(f.id));
                                    return newSet;
                                  });
                                } else {
                                  setSelectedMappings(prev => {
                                    const newSet = new Set(prev);
                                    fields.forEach(f => newSet.delete(f.id));
                                    return newSet;
                                  });
                                }
                              }}
                              className="rounded border-slate-300"
                            />
                          </th>
                          <th className="px-4 py-2 text-center text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-700/50">
                            Actions
                          </th>
                          <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-300 font-medium">
                            Frontend Field
                          </th>
                          <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-300 font-medium">
                            API Field
                          </th>
                          <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-300 font-medium">
                            DB Table
                          </th>
                          <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-300 font-medium">
                            Column
                          </th>
                          <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-300 font-medium">
                            Type
                          </th>
                          <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-300 font-medium">
                            Status
                          </th>
                          <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-300 font-medium">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {fields.map((field) => (
                          <tr
                            key={field.id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                              field.status === 'mismatch' ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''
                            }`}
                          >
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedMappings.has(field.id)}
                                onChange={() => toggleSelection(field.id)}
                                className="rounded border-slate-300"
                              />
                            </td>
                            <td className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50">
                              <div className="flex items-center justify-center gap-1">
                                {getShowInUIUrl(field) && (
                                  <button
                                    onClick={() => showFieldInUI(field)}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors group relative"
                                    title={(() => {
                                      const prereq = getFieldPrerequisites(field.frontend_field);
                                      if (prereq && prereq.triggers.length > 0) {
                                        return `Show in UI (Auto-triggers: ${prereq.description})`;
                                      }
                                      return 'Show in UI';
                                    })()}
                                  >
                                    <EyeIcon className="w-4 h-4" />
                                    {/* Show indicator if field has prerequisites */}
                                    {getFieldPrerequisites(field.frontend_field)?.triggers.length ? (
                                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" title="Has auto-triggers" />
                                    ) : null}
                                  </button>
                                )}
                                {field.status !== 'approved' && (
                                  <button
                                    onClick={() => updateStatus([field.id], 'approved')}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors"
                                    title="Approve"
                                  >
                                    <CheckCircleIcon className="w-4 h-4" />
                                  </button>
                                )}
                                {field.status !== 'rejected' && (
                                  <button
                                    onClick={() => updateStatus([field.id], 'rejected')}
                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                                    title="Reject"
                                  >
                                    <XCircleIcon className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono text-slate-800 dark:text-slate-200">
                                {field.frontend_field}
                              </code>
                            </td>
                            <td className="px-4 py-2">
                              <code className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded text-xs font-mono text-blue-700 dark:text-blue-300">
                                {field.api_field}
                              </code>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs ${
                                field.db_table === 'UNKNOWN' 
                                  ? 'text-red-500' 
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}>
                                {field.db_table}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <code className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                {field.db_column}
                              </code>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {field.data_type}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <StatusBadge status={field.status} />
                            </td>
                            <td className="px-4 py-2 max-w-xs">
                              {editingNote === field.id ? (
                                <input
                                  type="text"
                                  value={noteValue}
                                  onChange={(e) => setNoteValue(e.target.value)}
                                  onBlur={() => updateNote(field.id, noteValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateNote(field.id, noteValue);
                                    } else if (e.key === 'Escape') {
                                      setEditingNote(null);
                                    }
                                  }}
                                  autoFocus
                                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                                />
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingNote(field.id);
                                    setNoteValue(field.notes);
                                  }}
                                  className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 truncate block"
                                  title={field.notes || 'Click to add note'}
                                >
                                  {field.notes || '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Footer Info */}
        <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm text-slate-600 dark:text-slate-400">
          <p className="flex items-center gap-2">
            <DocumentTextIcon className="w-4 h-4" />
            Report generated: {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default FieldMappingManager;

