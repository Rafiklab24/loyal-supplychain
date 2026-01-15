/**
 * BOL Upload Section Component
 * Handles Bill of Lading (BOL) and CMR document upload and OCR extraction
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CloudArrowUpIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { apiClient } from '../../../services/api';

interface BOLUploadSectionProps {
  formData: any;
  onChange: (field: any, value: any) => void;
}

export function BOLUploadSection({ formData, onChange }: BOLUploadSectionProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Handle file upload and extraction
  const handleFileUpload = async (file: File) => {
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setExtractionError(t('documents.invalidFileType', 'Invalid file type. Only PDF, JPG, and PNG allowed.'));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setExtractionError(t('documents.fileTooLarge', 'File size must be less than 10MB'));
      return;
    }

    setUploadedFile(file);
    setIsExtracting(true);
    setExtractionError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('📤 Uploading BOL document for extraction...');

      // Call backend API (apiClient automatically includes auth token)
      // Extended timeout for AI processing of multi-page PDFs (90 seconds)
      const response = await apiClient.post(
        '/shipments/extract-from-bol',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 90000, // 90 seconds for AI OCR processing
        }
      );

      if (response.data.success) {
        setExtractionResult(response.data);
        
        // Auto-fill form with extracted data
        await autoFillForm(response.data.data);

        console.log('✅ BOL Extraction complete!', response.data);
      } else {
        setExtractionError(response.data.error || 'Extraction failed');
      }
    } catch (error: any) {
      console.error('❌ BOL Extraction error:', error);
      setExtractionError(error.message || 'Failed to process document');
    } finally {
      setIsExtracting(false);
    }
  };

  // Auto-fill form with extracted data
  const autoFillForm = async (extractedData: any) => {
    console.log('🤖 Auto-filling BOL form with extracted data:', extractedData);

    // Only fill empty fields to preserve manual entries
    
    // Helper: Extract core port name for better search matching
    const extractPortName = (fullPortName: string): string => {
      // Remove common suffixes like "PORT", "INDIA", "TURKEY", etc.
      let name = fullPortName
        .replace(/,?\s*(PORT|TERMINAL|INDIA|TURKEY|CHINA|USA|UAE|SINGAPORE|MALAYSIA)\.?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      // Take just the first word if it's still complex (e.g., "MUNDRA PORT, INDIA" → "MUNDRA")
      const firstWord = name.split(/[\s,]/)[0];
      return firstWord.length >= 3 ? firstWord : name;
    };
    
    // 1. Ports - search and match by name (with smarter search)
    if (!formData.pol_id && extractedData.ports?.port_of_loading) {
      const portName = extractPortName(extractedData.ports.port_of_loading);
      console.log('  🌊 Setting POL:', extractedData.ports.port_of_loading, '→ searching:', portName);
      try {
        // Try with extracted core name first
        let polResponse = await apiClient.get(
          `/ports?search=${encodeURIComponent(portName)}&limit=5`
        );
        // If no results, try with port code if available
        if ((!polResponse.data.ports || polResponse.data.ports.length === 0) && extractedData.ports.port_of_loading_code) {
          polResponse = await apiClient.get(
            `/ports?search=${encodeURIComponent(extractedData.ports.port_of_loading_code)}&limit=5`
          );
        }
        // API returns { data: [...] } not { ports: [...] }
        const ports = polResponse.data.data || polResponse.data.ports || [];
        if (ports.length > 0) {
          onChange('pol_id', ports[0].id);
          onChange('pol_name', ports[0].name);  // Set display name
          console.log('  ✅ POL matched:', ports[0].name);
        } else {
          // Auto-create port if not found
          console.log('  🆕 Auto-creating POL:', extractedData.ports.port_of_loading);
          try {
            const createResponse = await apiClient.post('/ports', {
              name: portName,
              country: extractedData.ports.port_of_loading.includes('India') ? 'India' : 
                       extractedData.ports.port_of_loading.includes('Turkey') ? 'Turkey' :
                       extractedData.ports.port_of_loading.includes('China') ? 'China' : null,
              unlocode: extractedData.ports.port_of_loading_code || null,
            });
            if (createResponse.data.data?.id) {
              onChange('pol_id', createResponse.data.data.id);
              onChange('pol_name', createResponse.data.data.name);  // Set display name
              console.log('  ✅ POL auto-created:', createResponse.data.data.name);
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to auto-create POL:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to lookup POL:', err);
      }
    }

    if (!formData.pod_id && extractedData.ports?.port_of_discharge) {
      const portName = extractPortName(extractedData.ports.port_of_discharge);
      console.log('  🌊 Setting POD:', extractedData.ports.port_of_discharge, '→ searching:', portName);
      try {
        let podResponse = await apiClient.get(
          `/ports?search=${encodeURIComponent(portName)}&limit=5`
        );
        // If no results, try with port code if available
        if ((!podResponse.data.ports || podResponse.data.ports.length === 0) && extractedData.ports.port_of_discharge_code) {
          podResponse = await apiClient.get(
            `/ports?search=${encodeURIComponent(extractedData.ports.port_of_discharge_code)}&limit=5`
          );
        }
        // API returns { data: [...] } not { ports: [...] }
        const ports = podResponse.data.data || podResponse.data.ports || [];
        if (ports.length > 0) {
          onChange('pod_id', ports[0].id);
          onChange('pod_name', ports[0].name);  // Set display name
          console.log('  ✅ POD matched:', ports[0].name);
        } else {
          // Auto-create port if not found
          console.log('  🆕 Auto-creating POD:', extractedData.ports.port_of_discharge);
          try {
            const createResponse = await apiClient.post('/ports', {
              name: portName,
              country: extractedData.ports.port_of_discharge.includes('India') ? 'India' : 
                       extractedData.ports.port_of_discharge.includes('Turkey') ? 'Turkey' :
                       extractedData.ports.port_of_discharge.includes('China') ? 'China' : null,
              unlocode: extractedData.ports.port_of_discharge_code || null,
            });
            if (createResponse.data.data?.id) {
              onChange('pod_id', createResponse.data.data.id);
              onChange('pod_name', createResponse.data.data.name);  // Set display name
              console.log('  ✅ POD auto-created:', createResponse.data.data.name);
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to auto-create POD:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to lookup POD:', err);
      }
    }

    // 2. Dates - try multiple date fields with fallback priority
    if (!formData.etd) {
      // ETD fallback priority:
      // 1. Explicit ETD
      // 2. SHIPPED ON BOARD DATE (on_board_date)
      // 3. B/L Issue Date (bl_date) - if no shipping date found, use document issue date
      const etdDate = extractedData.dates?.etd 
        || extractedData.dates?.on_board_date 
        || extractedData.document_info?.bl_date;
      
      if (etdDate) {
        const source = extractedData.dates?.etd ? 'ETD' 
          : extractedData.dates?.on_board_date ? 'On Board Date'
          : 'B/L Issue Date';
        console.log(`  📅 Setting ETD from ${source}:`, etdDate);
        onChange('etd', etdDate);
      }
    }

    if (!formData.eta && extractedData.dates?.eta) {
      console.log('  📅 Setting ETA:', extractedData.dates.eta);
      onChange('eta', extractedData.dates.eta);
    }

    // 3. Shipping Line/Transport Company
    if (!formData.shipping_line_id && extractedData.shipping_line?.name) {
      console.log('  🚢 Setting shipping line:', extractedData.shipping_line.name);
      try {
        const shippingLineResponse = await apiClient.get(
          `/companies?search=${encodeURIComponent(extractedData.shipping_line.name)}&type=shipping_line&limit=5`
        );
        // API returns { data: [...] } not { companies: [...] }
        const companies = shippingLineResponse.data.data || shippingLineResponse.data.companies || [];
        if (companies.length > 0) {
          onChange('shipping_line_id', companies[0].id);
          onChange('shipping_line_name', companies[0].name);  // Set display name
          console.log('  ✅ Shipping line matched:', companies[0].name);
        } else {
          // Auto-create shipping line if not found
          console.log('  🆕 Auto-creating shipping line:', extractedData.shipping_line.name);
          try {
            const createResponse = await apiClient.post('/companies', {
              name: extractedData.shipping_line.name,
              is_shipping_line: true,
            });
            if (createResponse.data.data?.id) {
              onChange('shipping_line_id', createResponse.data.data.id);
              onChange('shipping_line_name', createResponse.data.data.name);  // Set display name
              console.log('  ✅ Shipping line auto-created:', createResponse.data.data.name);
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to auto-create shipping line:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to lookup shipping line:', err);
      }
    }

    // 4. Reference Numbers
    if (!formData.booking_no && extractedData.document_info?.booking_number) {
      console.log('  📋 Setting booking number:', extractedData.document_info.booking_number);
      onChange('booking_no', extractedData.document_info.booking_number);
    }

    if (!formData.bl_no && extractedData.document_info?.bl_number) {
      console.log('  📋 Setting B/L number:', extractedData.document_info.bl_number);
      onChange('bl_no', extractedData.document_info.bl_number);
    }

    // 5. Container Details (for sea freight) - NEW: Extract per-container details
    if (extractedData.cargo_details?.containers && extractedData.cargo_details.containers.length > 0) {
      console.log('  📦 Setting container details:', extractedData.cargo_details.containers);
      
      const containers = extractedData.cargo_details.containers;
      const containerCount = containers.length;
      
      // Check if individual net weights are missing but total net weight is available
      const hasIndividualNetWeights = containers.some((c: any) => c.net_weight_kg && c.net_weight_kg > 0);
      
      // Get total net weight from various sources
      let totalNetWeight = extractedData.cargo_details.total_net_weight_kg || 0;
      
      // If no total in cargo_details, try goods section (from Commercial Invoice)
      if (!totalNetWeight && extractedData.goods?.total_net_weight_kg) {
        totalNetWeight = extractedData.goods.total_net_weight_kg;
      }
      // Also check for weight in MT and convert to KG
      if (!totalNetWeight && extractedData.goods?.total_weight_mt) {
        totalNetWeight = extractedData.goods.total_weight_mt * 1000; // Convert MT to KG
      }
      // Try formData weight_ton if available
      if (!totalNetWeight && formData.weight_ton) {
        totalNetWeight = Number(formData.weight_ton) * 1000; // Convert MT to KG
      }
      
      // Calculate per-container net weight if individual weights are missing but total is available
      let calculatedNetWeightPerContainer = 0;
      if (!hasIndividualNetWeights && totalNetWeight > 0 && containerCount > 0) {
        calculatedNetWeightPerContainer = Math.round(totalNetWeight / containerCount);
        console.log('  ⚠️ Individual net weights not found - calculating from total:');
        console.log(`     Total Net Weight: ${totalNetWeight} kg ÷ ${containerCount} containers = ${calculatedNetWeightPerContainer} kg each`);
      }
      
      // Map extracted container data to form container format
      const containerDetails = containers.map((c: any, idx: number) => ({
        id: `container-${Date.now()}-${idx}`,
        container_number: c.container_number || '',
        size_code: c.size_code || '',
        gross_weight_kg: c.gross_weight_kg || '',
        // Use individual net weight if available, otherwise use calculated per-container weight
        net_weight_kg: c.net_weight_kg || calculatedNetWeightPerContainer || '',
        seal_number: c.seal_number || '',
        package_count: c.package_count || '',
      }));
      
      onChange('containers', containerDetails);
      onChange('container_count', containerDetails.length);
      
      // Set total weights if available
      if (extractedData.cargo_details.total_gross_weight_kg) {
        onChange('gross_weight_kg', extractedData.cargo_details.total_gross_weight_kg);
      }
      if (totalNetWeight > 0) {
        onChange('net_weight_kg', totalNetWeight);
      }
      
      // ALWAYS set cargo_type to 'containers' when actual containers are detected from BOL
      // This overrides any previous value (e.g., 'general_cargo' from CI) since BOL is authoritative for container info
      console.log('  📦 BOL detected containers - setting cargo_type to containers');
      onChange('cargo_type', 'containers');
    } 
    // Fallback to legacy container_numbers array for backwards compatibility
    else if (extractedData.cargo_details?.container_numbers && extractedData.cargo_details.container_numbers.length > 0) {
      console.log('  📦 Setting container numbers (legacy):', extractedData.cargo_details.container_numbers);
      
      // Convert simple container numbers to full container objects
      const containerDetails = extractedData.cargo_details.container_numbers.map((containerNo: string, idx: number) => ({
        id: `container-${Date.now()}-${idx}`,
        container_number: containerNo,
        size_code: extractedData.cargo_details.container_types?.[idx] || '',
        gross_weight_kg: '',
        net_weight_kg: '',
        seal_number: '',
        package_count: '',
      }));
      
      onChange('containers', containerDetails);
      onChange('container_count', containerDetails.length);
      
      // ALWAYS set cargo_type to 'containers' when container numbers are found
      console.log('  📦 BOL detected container numbers - setting cargo_type to containers');
      onChange('cargo_type', 'containers');
    }

    // 6. Truck info (for land freight)
    if (extractedData.truck_info?.truck_plate_number) {
      console.log('  🚚 Setting truck plate:', extractedData.truck_info.truck_plate_number);
      onChange('truck_plate_number', extractedData.truck_info.truck_plate_number);
      if (!formData.cargo_type) {
        onChange('cargo_type', 'trucks');
      }
      if (extractedData.document_info?.cmr_number) {
        onChange('cmr', extractedData.document_info.cmr_number);
      }
    }

    // 7. Vessel info (for sea freight)
    if (extractedData.vessel_info?.vessel_name && !formData.vessel_name) {
      console.log('  🛳️ Setting vessel name:', extractedData.vessel_info.vessel_name);
      onChange('vessel_name', extractedData.vessel_info.vessel_name);
      if (extractedData.vessel_info?.vessel_imo) {
        onChange('vessel_imo', extractedData.vessel_info.vessel_imo);
      }
    }

    // 8. Free time
    if (extractedData.terms?.free_time_days && !formData.free_time_days) {
      console.log('  ⏰ Setting free time:', extractedData.terms.free_time_days);
      onChange('free_time_days', extractedData.terms.free_time_days);
    }

    // 9. Shipper (Supplier) - from BOL parties - Using fuzzy matching for OCR names
    if (!formData.supplier_id && extractedData.parties?.shipper) {
      console.log('  🏢 Setting supplier from BOL shipper:', extractedData.parties.shipper);
      try {
        // First try fuzzy matching endpoint (better for OCR-extracted names)
        const fuzzyResponse = await apiClient.get(
          `/companies/fuzzy-match?name=${encodeURIComponent(extractedData.parties.shipper)}&type=supplier&threshold=0.6`
        );
        
        if (fuzzyResponse.data.hasGoodMatch && fuzzyResponse.data.bestMatch) {
          // Found a good fuzzy match (>70% similarity)
          const match = fuzzyResponse.data.bestMatch;
          onChange('supplier_id', match.id);
          onChange('supplier_name', match.name);
          console.log(`  ✅ Supplier fuzzy-matched: "${extractedData.parties.shipper}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else if (fuzzyResponse.data.matches?.length > 0) {
          // Found a match above threshold but below 70%
          const match = fuzzyResponse.data.matches[0];
          onChange('supplier_id', match.id);
          onChange('supplier_name', match.name);
          console.log(`  ✅ Supplier matched (lower confidence): "${extractedData.parties.shipper}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else {
          // No match found - use POST which will also do fuzzy matching before creating
          console.log('  🆕 Creating/matching supplier via POST:', extractedData.parties.shipper);
          try {
            const createResponse = await apiClient.post('/companies', {
              name: extractedData.parties.shipper,
              is_supplier: true,
            });
            if (createResponse.data.data?.id) {
              onChange('supplier_id', createResponse.data.data.id);
              onChange('supplier_name', createResponse.data.data.name);
              if (createResponse.data.matched) {
                console.log(`  ✅ Supplier matched via POST: "${createResponse.data.data.name}" (${createResponse.data.matchType})`);
              } else {
                console.log(`  ✅ Supplier created: "${createResponse.data.data.name}"`);
              }
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to create/match supplier:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to fuzzy-match supplier from BOL:', err);
        // Fallback to regular search
        try {
          const supplierResponse = await apiClient.get(
            `/companies?search=${encodeURIComponent(extractedData.parties.shipper)}&limit=5`
          );
          const companies = supplierResponse.data.data || supplierResponse.data.companies || [];
          if (companies.length > 0) {
            onChange('supplier_id', companies[0].id);
            onChange('supplier_name', companies[0].name);
            console.log('  ✅ Supplier found (fallback):', companies[0].name);
          }
        } catch (fallbackErr) {
          console.warn('  ⚠️ Fallback search also failed:', fallbackErr);
        }
      }
    }

    // 10. Consignee (Buyer/Importer) - from BOL parties - Using fuzzy matching
    if (!formData.buyer_id && extractedData.parties?.consignee) {
      console.log('  🏢 Setting buyer from BOL consignee:', extractedData.parties.consignee);
      try {
        // First try fuzzy matching endpoint
        const fuzzyResponse = await apiClient.get(
          `/companies/fuzzy-match?name=${encodeURIComponent(extractedData.parties.consignee)}&type=customer&threshold=0.6`
        );
        
        if (fuzzyResponse.data.hasGoodMatch && fuzzyResponse.data.bestMatch) {
          const match = fuzzyResponse.data.bestMatch;
          onChange('buyer_id', match.id);
          onChange('buyer_name', match.name);
          console.log(`  ✅ Buyer fuzzy-matched: "${extractedData.parties.consignee}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else if (fuzzyResponse.data.matches?.length > 0) {
          const match = fuzzyResponse.data.matches[0];
          onChange('buyer_id', match.id);
          onChange('buyer_name', match.name);
          console.log(`  ✅ Buyer matched (lower confidence): "${extractedData.parties.consignee}" → "${match.name}" (${(match.score * 100).toFixed(0)}% similar)`);
        } else {
          // No match found - use POST which will also do fuzzy matching
          console.log('  🆕 Creating/matching buyer via POST:', extractedData.parties.consignee);
          try {
            const createResponse = await apiClient.post('/companies', {
              name: extractedData.parties.consignee,
              is_customer: true,
            });
            if (createResponse.data.data?.id) {
              onChange('buyer_id', createResponse.data.data.id);
              onChange('buyer_name', createResponse.data.data.name);
              if (createResponse.data.matched) {
                console.log(`  ✅ Buyer matched via POST: "${createResponse.data.data.name}" (${createResponse.data.matchType})`);
              } else {
                console.log(`  ✅ Buyer created: "${createResponse.data.data.name}"`);
              }
            }
          } catch (createErr) {
            console.warn('  ⚠️ Failed to create/match buyer:', createErr);
          }
        }
      } catch (err) {
        console.warn('Failed to fuzzy-match buyer from BOL:', err);
        // Fallback to regular search
        try {
          const buyerResponse = await apiClient.get(
            `/companies?search=${encodeURIComponent(extractedData.parties.consignee)}&limit=5`
          );
          const companies = buyerResponse.data.data || buyerResponse.data.companies || [];
          if (companies.length > 0) {
            onChange('buyer_id', companies[0].id);
            onChange('buyer_name', companies[0].name);
            console.log('  ✅ Buyer found (fallback):', companies[0].name);
          }
        } catch (fallbackErr) {
          console.warn('  ⚠️ Fallback search also failed:', fallbackErr);
        }
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-2xl">📄</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            ⚡ {t('shipments.wizard.quickStartWithBOL', 'Quick Start with BOL/CMR Upload')}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {t('shipments.wizard.uploadBOLHint', 'Upload your Bill of Lading or CMR document and let AI extract shipping details automatically. Takes about 10 seconds.')}
          </p>

          {/* Upload Area */}
          {!uploadedFile && !isExtracting && !extractionResult && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <CloudArrowUpIcon className="h-12 w-12 mx-auto text-blue-400 mb-2" />
              <p className="text-sm font-medium text-gray-700">
                {t('shipments.wizard.clickToUploadBOL', 'Click to upload Bill of Lading or CMR')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF, JPG, PNG (max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          )}

          {/* Processing */}
          {isExtracting && (
            <div className="bg-white rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                🤖 {t('shipments.wizard.analyzingBOL', 'AI is analyzing your BOL document...')}
              </p>
              <p className="text-xs text-gray-500">
                {t('shipments.wizard.pleaseWait', 'This usually takes 10-15 seconds')}
              </p>
            </div>
          )}

          {/* Success */}
          {extractionResult && !isExtracting && (
            <div className={`rounded-lg p-4 border ${
              extractionResult.data?.document_info?.data_source === 'fallback'
                ? 'bg-amber-50 border-amber-300'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-start gap-3">
                <CheckCircleIcon className={`h-6 w-6 flex-shrink-0 ${
                  extractionResult.data?.document_info?.data_source === 'fallback'
                    ? 'text-amber-600'
                    : 'text-green-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium mb-2 ${
                    extractionResult.data?.document_info?.data_source === 'fallback'
                      ? 'text-amber-800'
                      : 'text-green-800'
                  }`}>
                    {extractionResult.data?.document_info?.data_source === 'fallback'
                      ? `⚠️ ${t('shipments.wizard.bolExtractionFallback', 'Data extracted from alternate source')} (${extractionResult.confidence}% confidence)`
                      : `✅ ${t('shipments.wizard.extractionComplete', 'Extraction complete!')} (${extractionResult.confidence}% confidence)`
                    }
                  </p>
                  
                  {/* Fallback Warning Banner */}
                  {extractionResult.data?.document_info?.data_source === 'fallback' && (
                    <div className="bg-amber-100 border border-amber-400 rounded-md p-3 mb-3">
                      <p className="text-sm text-amber-900 font-medium">
                        ⚠️ {t('shipments.wizard.noBOLFound', 'No Bill of Lading found in document')}
                      </p>
                      <p className="text-xs text-amber-800 mt-1">
                        {t('shipments.wizard.fallbackDataWarning', 'Data was extracted from')} {extractionResult.data?.document_info?.fallback_document_type || 'an alternate document'}. 
                        {' '}{t('shipments.wizard.pleaseVerifyBOL', 'Please verify shipping details (B/L number, ports, dates) manually.')}
                      </p>
                    </div>
                  )}
                  
                  <p className={`text-xs mb-3 ${
                    extractionResult.data?.document_info?.data_source === 'fallback'
                      ? 'text-amber-700'
                      : 'text-green-700'
                  }`}>
                    {t('shipments.wizard.fieldsAutoFilled', 'Form fields have been auto-filled. Please review and correct if needed.')}
                  </p>
                  {extractionResult.warnings && extractionResult.warnings.length > 0 && (
                    <div className="text-xs text-yellow-700 space-y-1 mb-3">
                      <p className="font-medium">⚠️ {t('shipments.wizard.warnings', 'Warnings')}:</p>
                      <ul className="list-disc list-inside ml-2">
                        {extractionResult.warnings.map((warning: string, idx: number) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFile(null);
                      setExtractionResult(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {t('shipments.wizard.uploadAnother', 'Upload another document')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {extractionError && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    ❌ {t('shipments.wizard.extractionFailed', 'Extraction failed')}
                  </p>
                  <p className="text-xs text-red-700">
                    {extractionError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFile(null);
                      setExtractionError(null);
                    }}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-800"
                  >
                    {t('shipments.wizard.tryAgain', 'Try again')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

