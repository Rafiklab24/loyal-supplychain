/**
 * Antrepo Entry Modal
 * Record goods entry into the antrepo (customs warehouse)
 * 
 * Shipment info is displayed as READ-ONLY in the header for verification.
 * The only editable fields are: Lot, Beyaname number, Entry date/time, and Notes.
 * 
 * After entry is recorded, shows a quality check step where user can:
 * - Mark as "No Issues" -> automatically marks shipment as delivered
 * - Mark as "Has Issues" -> navigates to Quality Incident Wizard
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, CubeIcon, TruckIcon, ScaleIcon, MapPinIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon, CheckCircleIcon, HandThumbUpIcon, HandThumbDownIcon, DocumentArrowUpIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { useCreateInventory, useAntrepoLots, useMarkShipmentDelivered } from '../../hooks/useAntrepo';
import { uploadDocument } from '../../services/documents';
import type { PendingArrival, CreateInventoryInput } from '../../services/antrepo';

interface AntrepoEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingArrival?: PendingArrival | null;
}

// Step type for the modal flow
type ModalStep = 'entry' | 'quality-check';

export default function AntrepoEntryModal({ isOpen, onClose, pendingArrival }: AntrepoEntryModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();

  const { data: lots } = useAntrepoLots();
  const createInventory = useCreateInventory();
  const markDelivered = useMarkShipmentDelivered();

  // Get current date and time in local format
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  // Modal step state
  const [step, setStep] = useState<ModalStep>('entry');
  
  // Toggle state for container details
  const [showContainers, setShowContainers] = useState(false);

  // Beyaname file upload
  const [beyanameFile, setBeyanameFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state - only editable fields
  const [formData, setFormData] = useState({
    lot_id: '',
    entry_declaration_no: '', // Beyaname number
    entry_date: currentDate,
    entry_time: currentTime,
    notes: '',
    // Dual Stock Fields
    customs_quantity_mt: '', // Paperwork weight (auto-filled from shipment)
    customs_bags: '',        // Paperwork bags (auto-filled from shipment)
    actual_quantity_mt: '',  // Actual weight after weighing
    actual_bags: '',         // Actual bags after counting
    discrepancy_notes: '',   // Notes explaining any discrepancy
  });

  // Pre-fill lot and customs quantities from pending arrival
  useEffect(() => {
    if (pendingArrival) {
      setFormData((prev) => ({
        ...prev,
        lot_id: pendingArrival.assigned_lot_id || prev.lot_id,
        // Auto-fill customs quantities from shipment paperwork
        customs_quantity_mt: pendingArrival.weight_ton?.toString() || '',
        customs_bags: (pendingArrival.number_of_packages || pendingArrival.bags_count)?.toString() || '',
        // Pre-fill actual with same values (user can edit after weighing)
        actual_quantity_mt: pendingArrival.weight_ton?.toString() || '',
        actual_bags: (pendingArrival.number_of_packages || pendingArrival.bags_count)?.toString() || '',
      }));
    }
  }, [pendingArrival]);

  // Reset step, file, and form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('entry');
      setBeyanameFile(null);
      // Reset dual stock fields
      setFormData(prev => ({
        ...prev,
        customs_quantity_mt: '',
        customs_bags: '',
        actual_quantity_mt: '',
        actual_bags: '',
        discrepancy_notes: '',
      }));
    }
  }, [isOpen]);

  // Calculate discrepancies for display
  const weightDiscrepancy = parseFloat(formData.customs_quantity_mt || '0') - parseFloat(formData.actual_quantity_mt || '0');
  const bagsDiscrepancy = parseInt(formData.customs_bags || '0') - parseInt(formData.actual_bags || '0');
  const hasDiscrepancy = Math.abs(weightDiscrepancy) > 0.001 || Math.abs(bagsDiscrepancy) > 0;

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBeyanameFile(file);
    }
  };

  const handleRemoveFile = () => {
    setBeyanameFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.lot_id || !formData.entry_declaration_no || !pendingArrival) {
      return;
    }

    // Combine date and time
    const entryDateTime = `${formData.entry_date}T${formData.entry_time}:00`;

    try {
      // Parse dual-stock quantities
      const customsQuantityMt = parseFloat(formData.customs_quantity_mt) || 0;
      const customsBags = formData.customs_bags ? parseInt(formData.customs_bags, 10) : undefined;
      const actualQuantityMt = parseFloat(formData.actual_quantity_mt) || 0;
      const actualBags = formData.actual_bags ? parseInt(formData.actual_bags, 10) : undefined;
      
      const containersValue = pendingArrival.container_count;
      const quantityContainers = containersValue ? parseInt(String(containersValue), 10) : undefined;

      // Validate that we have positive quantities
      if (actualQuantityMt <= 0) {
        console.error('Invalid actual quantity: must be greater than 0');
        return;
      }

      await createInventory.mutateAsync({
        shipment_id: pendingArrival.id,
        lot_id: formData.lot_id,
        entry_date: entryDateTime,
        entry_declaration_no: formData.entry_declaration_no,
        // Dual Stock: Customs (paperwork) values
        customs_quantity_mt: customsQuantityMt,
        customs_bags: customsBags,
        // Dual Stock: Actual (physical) values
        actual_quantity_mt: actualQuantityMt,
        actual_bags: actualBags,
        // Legacy field (for backward compatibility)
        original_quantity_mt: customsQuantityMt,
        // Product info
        product_text: pendingArrival.product_text || '',
        origin_country: pendingArrival.origin_country || '',
        quantity_bags: actualBags, // Legacy uses actual
        quantity_containers: quantityContainers,
        is_third_party: false,
        notes: formData.notes,
        discrepancy_notes: formData.discrepancy_notes || undefined,
      } as CreateInventoryInput);
      
      // Upload beyaname document if file was selected
      if (beyanameFile && pendingArrival.id) {
        setIsUploadingFile(true);
        try {
          await uploadDocument({
            file: beyanameFile,
            entity_type: 'shipment',
            entity_id: pendingArrival.id,
            doc_type: 'beyaname',
            is_draft: false,
            notes: `Beyaname ${formData.entry_declaration_no}`,
          });
          console.log('✅ Beyaname document uploaded successfully');
        } catch (uploadError) {
          console.warn('⚠️ Failed to upload beyaname document:', uploadError);
          // Continue even if upload fails - the inventory entry was created
        } finally {
          setIsUploadingFile(false);
        }
      }
      
      // Transition to quality check step instead of closing
      setStep('quality-check');
    } catch (error) {
      console.error('Error creating inventory entry:', error);
    }
  };

  // Handle quality check response
  const handleQualityCheck = async (hasIssues: boolean) => {
    if (!pendingArrival) {
      console.error('No pending arrival found');
      return;
    }

    // Store the shipment ID before any state changes
    const shipmentId = pendingArrival.id;

    if (hasIssues) {
      // Has issues: Navigate to Quality Incident Wizard
      // Navigate first, then close to avoid state clearing issues
      const targetUrl = `/quality-incident/new?shipment_id=${shipmentId}`;
      console.log('Navigating to quality incident wizard:', targetUrl);
      navigate(targetUrl);
      onClose();
    } else {
      // No issues: Mark as delivered and close
      try {
        await markDelivered.mutateAsync({ shipmentId, hasIssues: false });
        onClose();
      } catch (error) {
        console.error('Error marking shipment as delivered:', error);
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to format numbers
  // Always use English numerals for consistency
  const formatNumber = (num?: number) => num?.toLocaleString('en-US') ?? '-';

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* ===== STEP 1: Entry Form ===== */}
          {step === 'entry' && (
            <>
              {/* Header with Title */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700">
                <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-white">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CubeIcon className="h-5 w-5 text-white" />
                  </div>
                  {t('antrepo.recordEntry', 'تسجيل دخول بضاعة')}
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Shipment Info Header - READ ONLY for verification */}
              {pendingArrival && (
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                  {/* Shipment Number & Supplier */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TruckIcon className="h-5 w-5 text-slate-400" />
                      <span className="font-mono font-bold text-lg text-slate-800">{pendingArrival.sn}</span>
                    </div>
                    <span className="text-sm text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
                      {pendingArrival.supplier_name}
                    </span>
                  </div>
                  
                  {/* Product Name */}
                  <p className="text-base font-medium text-slate-700 mb-3">{pendingArrival.product_text}</p>
                  
                  {/* Info Grid - Read Only */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {/* Quantity */}
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                      <ScaleIcon className="h-4 w-4 text-blue-500" />
                      <div>
                        <span className="text-slate-500">{t('antrepo.quantityMT', 'الكمية')}: </span>
                        <span className="font-semibold text-slate-800">{formatNumber(pendingArrival.weight_ton)} MT</span>
                      </div>
                    </div>
                    
                    {/* Origin */}
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                      <MapPinIcon className="h-4 w-4 text-green-500" />
                      <div>
                        <span className="text-slate-500">{t('antrepo.originCountry', 'المنشأ')}: </span>
                        <span className="font-semibold text-slate-800">{pendingArrival.origin_country || '-'}</span>
                      </div>
                    </div>
                    
                    {/* Bags */}
                    {(pendingArrival.number_of_packages || pendingArrival.bags_count) && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <CubeIcon className="h-4 w-4 text-amber-500" />
                        <div>
                          <span className="text-slate-500">{t('antrepo.bags', 'الأكياس')}: </span>
                          <span className="font-semibold text-slate-800">
                            {formatNumber(pendingArrival.number_of_packages || pendingArrival.bags_count)}
                            {pendingArrival.package_size && ` × ${pendingArrival.package_size} ${pendingArrival.package_size_unit || 'KG'}`}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Containers - with toggle */}
                    {(pendingArrival.container_count || (pendingArrival.containers && pendingArrival.containers.length > 0)) && (
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <TruckIcon className="h-4 w-4 text-purple-500" />
                        <div className="flex-1">
                          <span className="text-slate-500">{t('antrepo.containers', 'الحاويات')}: </span>
                          <span className="font-semibold text-slate-800">
                            {pendingArrival.containers?.length || pendingArrival.container_count || 0}
                          </span>
                        </div>
                        {/* Toggle button for container details */}
                        {pendingArrival.containers && pendingArrival.containers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowContainers(!showContainers)}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title={showContainers ? t('common.hide', 'إخفاء') : t('common.show', 'عرض')}
                          >
                            {showContainers ? (
                              <ChevronUpIcon className="h-4 w-4" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Container Numbers - Collapsible Section */}
                  {showContainers && pendingArrival.containers && pendingArrival.containers.length > 0 && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-xs font-medium text-purple-700 mb-2">
                        {t('antrepo.containerNumbers', 'أرقام الحاويات')}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {pendingArrival.containers.map((container, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-white rounded border border-purple-100 text-xs"
                          >
                            <div className="font-mono font-semibold text-slate-800">
                              {container.container_no || '-'}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              {container.size_code && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">
                                  {container.size_code}
                                </span>
                              )}
                              {container.seal_no && (
                                <span title={t('antrepo.sealNo', 'رقم الختم')}>
                                  🔒 {container.seal_no}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form - Only Editable Fields */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* ===== DUAL STOCK SECTION ===== */}
                <div className="space-y-4">
                  {/* Customs Stock (Paperwork) */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-amber-100 rounded-lg">
                        <ScaleIcon className="h-4 w-4 text-amber-600" />
                      </div>
                      <h4 className="font-semibold text-amber-800">
                        {t('antrepo.customsStock', 'المخزون الجمركي')}
                        <span className="text-xs font-normal text-amber-600 ms-2">
                          ({t('antrepo.fromPaperwork', 'من الأوراق')})
                        </span>
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-amber-700 mb-1">
                          {t('antrepo.weightMT', 'الوزن (طن)')}
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={formData.customs_quantity_mt}
                          onChange={(e) => handleChange('customs_quantity_mt', e.target.value)}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          placeholder="0.000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-amber-700 mb-1">
                          {t('antrepo.bags', 'الأكياس')}
                        </label>
                        <input
                          type="number"
                          value={formData.customs_bags}
                          onChange={(e) => handleChange('customs_bags', e.target.value)}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actual Stock (After Weighing) */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-emerald-100 rounded-lg">
                        <ScaleIcon className="h-4 w-4 text-emerald-600" />
                      </div>
                      <h4 className="font-semibold text-emerald-800">
                        {t('antrepo.actualStock', 'المخزون الفعلي')}
                        <span className="text-xs font-normal text-emerald-600 ms-2">
                          ({t('antrepo.afterWeighing', 'بعد الوزن')})
                        </span>
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-emerald-700 mb-1">
                          {t('antrepo.weightMT', 'الوزن (طن)')} *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={formData.actual_quantity_mt}
                          onChange={(e) => handleChange('actual_quantity_mt', e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="0.000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-emerald-700 mb-1">
                          {t('antrepo.bags', 'الأكياس')}
                        </label>
                        <input
                          type="number"
                          value={formData.actual_bags}
                          onChange={(e) => handleChange('actual_bags', e.target.value)}
                          className="w-full px-3 py-2 border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy Display (auto-calculated) */}
                  {hasDiscrepancy && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-red-100 rounded-lg">
                          <ScaleIcon className="h-4 w-4 text-red-600" />
                        </div>
                        <h4 className="font-semibold text-red-800">
                          {t('antrepo.discrepancy', 'الفرق')}
                          <span className="text-xs font-normal text-red-600 ms-2">
                            ({t('antrepo.autoCalculated', 'محسوب تلقائياً')})
                          </span>
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="p-2 bg-white rounded-lg border border-red-200">
                          <span className="text-xs text-red-600">{t('antrepo.weightDiff', 'فرق الوزن')}: </span>
                          <span className={`font-bold ${weightDiscrepancy > 0 ? 'text-red-700' : 'text-green-700'}`}>
                            {weightDiscrepancy > 0 ? '-' : '+'}{Math.abs(weightDiscrepancy).toFixed(3)} MT
                          </span>
                          {weightDiscrepancy > 0 && (
                            <span className="text-xs text-red-500 ms-1">({t('antrepo.shortage', 'نقص')})</span>
                          )}
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-red-200">
                          <span className="text-xs text-red-600">{t('antrepo.bagsDiff', 'فرق الأكياس')}: </span>
                          <span className={`font-bold ${bagsDiscrepancy > 0 ? 'text-red-700' : 'text-green-700'}`}>
                            {bagsDiscrepancy > 0 ? '-' : '+'}{Math.abs(bagsDiscrepancy)}
                          </span>
                        </div>
                      </div>
                      {/* Discrepancy Notes */}
                      <div>
                        <label className="block text-xs font-medium text-red-700 mb-1">
                          {t('antrepo.discrepancyNotes', 'ملاحظات الفرق')}
                        </label>
                        <textarea
                          value={formData.discrepancy_notes}
                          onChange={(e) => handleChange('discrepancy_notes', e.target.value)}
                          rows={2}
                          placeholder={t('antrepo.explainDiscrepancy', 'اشرح سبب الفرق...')}
                          className="w-full px-3 py-2 border border-red-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Lot Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.selectLot', 'اختر القسم')} *
                  </label>
                  <select
                    value={formData.lot_id}
                    onChange={(e) => handleChange('lot_id', e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="">{t('common.select', 'اختر...')}</option>
                    {lots?.filter(l => l.is_active).map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.code} - {isRtl && lot.name_ar ? lot.name_ar : lot.name}
                        {lot.capacity_mt ? ` (${Number(lot.capacity_mt).toLocaleString('en-US')} M²)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Beyaname Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.beyanameNo', 'رقم البيانامة')} *
                  </label>
                  <input
                    type="text"
                    value={formData.entry_declaration_no}
                    onChange={(e) => handleChange('entry_declaration_no', e.target.value)}
                    required
                    placeholder={t('antrepo.enterBeyaname', 'أدخل رقم البيانامة')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Beyaname Document Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('antrepo.beyanameDocument', 'مستند البيانامة')}
                    <span className="text-slate-400 text-xs ms-1">({t('common.optional', 'اختياري')})</span>
                  </label>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="beyaname-file-input"
                  />
                  
                  {!beyanameFile ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors text-slate-600 hover:text-emerald-700"
                    >
                      <DocumentArrowUpIcon className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        {t('antrepo.uploadBeyaname', 'رفع مستند البيانامة')}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <DocumentCheckIcon className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                        <span className="text-sm text-emerald-800 truncate">{beyanameFile.name}</span>
                        <span className="text-xs text-emerald-600">
                          ({(beyanameFile.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1 text-emerald-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title={t('common.remove', 'إزالة')}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Entry Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <ClockIcon className="h-4 w-4" />
                        {t('antrepo.entryDate', 'تاريخ الدخول')} *
                      </span>
                    </label>
                    <input
                      type="date"
                      value={formData.entry_date}
                      onChange={(e) => handleChange('entry_date', e.target.value)}
                      required
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('antrepo.entryTime', 'وقت الدخول')} *
                    </label>
                    <input
                      type="time"
                      value={formData.entry_time}
                      onChange={(e) => handleChange('entry_time', e.target.value)}
                      required
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Notes (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t('common.notes', 'ملاحظات')}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={2}
                    placeholder={t('antrepo.notesPlaceholder', 'ملاحظات إضافية (اختياري)')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {t('common.cancel', 'إلغاء')}
                  </button>
                  <button
                    type="submit"
                    disabled={createInventory.isPending || isUploadingFile || !formData.lot_id || !formData.entry_declaration_no}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {createInventory.isPending || isUploadingFile ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        {isUploadingFile 
                          ? t('antrepo.uploadingDocument', 'جاري رفع المستند...')
                          : t('common.saving', 'جاري الحفظ...')}
                      </>
                    ) : (
                      <>
                        <CubeIcon className="h-4 w-4" />
                        {t('antrepo.recordEntry', 'تسجيل الدخول')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ===== STEP 2: Quality Check ===== */}
          {step === 'quality-check' && pendingArrival && (
            <>
              {/* Success Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600">
                <Dialog.Title className="flex items-center gap-3 text-lg font-semibold text-white">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CheckCircleIcon className="h-5 w-5 text-white" />
                  </div>
                  {t('antrepo.qualityCheckTitle', 'فحص جودة البضاعة')}
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Success Banner */}
              <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-2 bg-emerald-100 rounded-full">
                    <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-800">
                      {t('antrepo.entryRecorded', 'تم تسجيل الدخول بنجاح')}
                    </p>
                    <p className="text-sm text-emerald-600">
                      {t('antrepo.beyanameLinked', 'تم ربط البيانامة رقم')}: <span className="font-mono font-bold">{formData.entry_declaration_no}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Shipment Summary */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-5 w-5 text-slate-400" />
                    <span className="font-mono font-bold text-slate-800">{pendingArrival.sn}</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {formatNumber(pendingArrival.weight_ton)} MT
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{pendingArrival.product_text}</p>
              </div>

              {/* Quality Check Question */}
              <div className="p-6">
                <div className="text-center mb-8">
                  <p className="text-lg text-gray-700 font-medium">
                    {t('antrepo.anyQualityIssues', 'هل توجد مشاكل في جودة البضاعة؟')}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {isRtl 
                      ? 'في حال وجود مشاكل، سيتم تفعيل نظام التقييم'
                      : 'If issues exist, the quality incident system will be activated'}
                  </p>
                </div>

                {/* Big Action Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  {/* No Issues - Green */}
                  <button
                    onClick={() => handleQualityCheck(false)}
                    disabled={markDelivered.isPending}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-300 hover:border-emerald-500 hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <HandThumbUpIcon className="h-12 w-12 text-emerald-600 mb-3" />
                    <span className="text-lg font-bold text-emerald-700">
                      {t('antrepo.noIssuesGoods', 'لا توجد مشاكل')}
                    </span>
                    <span className="text-xs text-emerald-600 mt-1">
                      {t('antrepo.goodsAreFine', 'البضاعة سليمة')}
                    </span>
                  </button>

                  {/* Has Issues - Amber */}
                  <button
                    onClick={() => handleQualityCheck(true)}
                    disabled={markDelivered.isPending}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-300 hover:border-amber-500 hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <HandThumbDownIcon className="h-12 w-12 text-amber-600 mb-3" />
                    <span className="text-lg font-bold text-amber-700">
                      {t('antrepo.hasIssues', 'توجد مشاكل')}
                    </span>
                    <span className="text-xs text-amber-600 mt-1">
                      {t('antrepo.reportProblem', 'سجل المشكلة')}
                    </span>
                  </button>
                </div>

                {markDelivered.isPending && (
                  <div className="flex justify-center mt-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                )}
              </div>

              {/* Back button */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => setStep('entry')}
                  disabled={markDelivered.isPending}
                  className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                >
                  {t('common.back', 'رجوع')}
                </button>
              </div>
            </>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
