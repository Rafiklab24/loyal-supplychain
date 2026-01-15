/**
 * EFaturaCard Component
 * Displays a shipment's E-Fatura information with copyable fields
 */

import { useState, useRef } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TruckIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  DocumentArrowUpIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { CopyableField, CopyableFieldCompact } from './CopyableField';
import type { EFaturaShipment, EFaturaDelivery, EFaturaContainer } from '../../services/efatura';
import { downloadDocument } from '../../services/documents';
import { useToast } from '../common/Toast';

interface EFaturaCardProps {
  shipment: EFaturaShipment;
  onMarkComplete: (shipmentId: string, eFaturaNumber: string, file?: File) => Promise<void>;
  isRtl?: boolean;
  isArchiveView?: boolean;
}

function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCurrency(value: number | null | undefined, currency: string = 'USD'): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(value);
}

function DeliveryCard({ delivery, index, isRtl }: { delivery: EFaturaDelivery; index: number; isRtl: boolean }) {
  return (
    <div className="border border-blue-200 rounded-lg p-3 bg-white/80">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-100">
        <TruckIcon className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          #{index + 1}
          {delivery.container_number && (
            <span className="text-blue-600 font-normal ms-1">[{delivery.container_number}]</span>
          )}
        </span>
        {delivery.status && (
          <span className={`
            ms-auto text-xs px-2 py-0.5 rounded-full
            ${delivery.status === 'completed' ? 'bg-green-100 text-green-700' : 
              delivery.status === 'in_transit' ? 'bg-blue-100 text-blue-700' : 
              'bg-amber-100 text-amber-700'}
          `}>
            {delivery.status}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <CopyableFieldCompact
          label="Plate"
          labelAr="اللوحة"
          value={delivery.truck_plate_number}
          isRtl={isRtl}
        />
        <CopyableFieldCompact
          label="Route"
          labelAr="المسار"
          value={delivery.route}
          isRtl={isRtl}
        />
        <CopyableFieldCompact
          label="Gross"
          labelAr="إجمالي"
          value={delivery.gross_weight_kg ? `${formatNumber(delivery.gross_weight_kg, 0)} kg` : null}
          isRtl={isRtl}
        />
        <CopyableFieldCompact
          label="Net"
          labelAr="صافي"
          value={delivery.net_weight_kg ? `${formatNumber(delivery.net_weight_kg, 0)} kg` : null}
          isRtl={isRtl}
        />
      </div>
    </div>
  );
}

function ContainerCard({ container, index, isRtl }: { container: EFaturaContainer; index: number; isRtl: boolean }) {
  return (
    <div className="border border-amber-200 rounded-lg p-3 bg-white/80">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-100">
        <span className="text-sm font-medium text-amber-800">
          #{index + 1}
          {container.container_number && (
            <span className="text-amber-600 font-normal ms-1">[{container.container_number}]</span>
          )}
        </span>
        <span className="ms-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {isRtl ? 'بانتظار التعيين' : 'Pending Assignment'}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <CopyableFieldCompact
          label="Gross"
          labelAr="إجمالي"
          value={container.gross_weight_kg ? `${formatNumber(container.gross_weight_kg, 0)} kg` : null}
          isRtl={isRtl}
        />
        <CopyableFieldCompact
          label="Net"
          labelAr="صافي"
          value={container.net_weight_kg ? `${formatNumber(container.net_weight_kg, 0)} kg` : null}
          isRtl={isRtl}
        />
        <CopyableFieldCompact
          label="Packages"
          labelAr="طرود"
          value={container.package_count ? formatNumber(container.package_count, 0) : null}
          isRtl={isRtl}
        />
        <CopyableFieldCompact
          label="Seal"
          labelAr="رقم الختم"
          value={container.seal_number}
          isRtl={isRtl}
        />
      </div>
    </div>
  );
}

export function EFaturaCard({ shipment, onMarkComplete, isRtl = true, isArchiveView = false }: EFaturaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [eFaturaNumber, setEFaturaNumber] = useState(shipment.e_fatura_number || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const isCompleted = !!shipment.e_fatura_number;
  const hasDocuments = (shipment.e_fatura_documents?.length ?? 0) > 0;
  const isCrossBorder = shipment.is_cross_border;
  const eFaturaRequired = shipment.e_fatura_required;
  const hasDeliveries = shipment.delivery_count > 0;
  const hasContainers = (shipment.container_count || 0) > 0;
  const hasNoTransport = !hasDeliveries && !hasContainers;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (PDF, images)
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.warning(isRtl ? 'يرجى اختيار ملف PDF أو صورة' : 'Please select a PDF or image file');
        return;
      }
      setSelectedFile(file);
      toast.success(isRtl ? `تم اختيار: ${file.name}` : `Selected: ${file.name}`, 2000);
    }
  };

  const handleSubmit = async () => {
    if (!eFaturaNumber.trim()) {
      toast.warning(isRtl ? 'الرجاء إدخال رقم الفاتورة الإلكترونية' : 'Please enter E-Fatura number');
      return;
    }

    setIsSubmitting(true);
    try {
      await onMarkComplete(shipment.id, eFaturaNumber.trim(), selectedFile || undefined);
      toast.success(isRtl ? 'تم حفظ رقم الفاتورة بنجاح ✓' : 'E-Fatura number saved successfully ✓');
      setSelectedFile(null);
    } catch (error) {
      toast.error(isRtl ? 'فشل في حفظ رقم الفاتورة' : 'Failed to save E-Fatura number');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (documentId: string, filename: string) => {
    setIsDownloading(true);
    try {
      await downloadDocument(documentId, filename);
      toast.success(isRtl ? 'تم بدء التحميل' : 'Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(isRtl ? 'فشل في تحميل الملف' : 'Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={`
      bg-white rounded-xl shadow-sm border overflow-hidden
      ${isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}
    `}>
      {/* Header */}
      <div className={`
        px-4 py-3 border-b flex items-center justify-between
        ${isCompleted ? 'bg-green-50 border-green-200' : 
          !eFaturaRequired ? 'bg-gray-50 border-gray-200' : 
          'bg-amber-50 border-amber-200'}
      `}>
        <div className="flex items-center gap-2">
          <DocumentTextIcon className={`h-5 w-5 ${isCompleted ? 'text-green-600' : !eFaturaRequired ? 'text-gray-500' : 'text-amber-600'}`} />
          <span className={`font-bold text-base ${isCompleted ? 'text-green-800' : 'text-gray-900'}`}>
            {shipment.commercial_invoice_number}
          </span>
          {/* Cross-border badge */}
          {isCrossBorder && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
              {isRtl ? 'عابر للحدود' : 'Cross-Border'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Status badges */}
          {isArchiveView && !eFaturaRequired && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
              {isRtl ? 'غير مطلوب' : 'Not Required'}
            </span>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <CheckCircleIcon className="h-5 w-5" />
              <span>{isRtl ? 'مكتمل' : 'Done'}</span>
            </div>
          )}
          {!isCompleted && eFaturaRequired && !isArchiveView && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
              {isRtl ? 'إلزامي' : 'Required'}
            </span>
          )}
        </div>
      </div>

      {/* Body - Shipment Fields */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <CopyableField
            label="Invoice #"
            labelAr="رقم الفاتورة"
            value={shipment.commercial_invoice_number}
            isRtl={isRtl}
          />
          <CopyableField
            label="Product Type"
            labelAr="نوع البضاعة"
            value={shipment.product_text}
            isRtl={isRtl}
          />
          <CopyableField
            label="Supplier"
            labelAr="المورد"
            value={shipment.supplier_name}
            isRtl={isRtl}
          />
          <CopyableField
            label="Buyer"
            labelAr="المشتري"
            value={shipment.buyer_name}
            isRtl={isRtl}
          />
          <CopyableField
            label="Net Weight"
            labelAr="الوزن الصافي"
            value={shipment.net_weight_kg}
            formatValue={(v) => `${formatNumber(Number(v), 0)} kg`}
            copyValue={shipment.net_weight_kg?.toString()}
            isRtl={isRtl}
          />
          <CopyableField
            label="Gross Weight"
            labelAr="الوزن الإجمالي"
            value={shipment.gross_weight_kg}
            formatValue={(v) => `${formatNumber(Number(v), 0)} kg`}
            copyValue={shipment.gross_weight_kg?.toString()}
            isRtl={isRtl}
          />
          <CopyableField
            label="Total Value"
            labelAr="القيمة"
            value={shipment.total_value_usd}
            formatValue={(v) => formatCurrency(Number(v), shipment.currency_code || 'USD')}
            copyValue={shipment.total_value_usd?.toString()}
            isRtl={isRtl}
          />
          <CopyableField
            label="Origin (COG)"
            labelAr="بلد المنشأ"
            value={shipment.country_of_origin}
            isRtl={isRtl}
          />
          <CopyableField
            label="Packages"
            labelAr="العبوات"
            value={shipment.package_count}
            formatValue={(v) => formatNumber(Number(v), 0)}
            copyValue={shipment.package_count?.toString()}
            isRtl={isRtl}
          />
          <CopyableField
            label="Final Weight"
            labelAr="الوزن النهائي"
            value={shipment.weight_ton}
            formatValue={(v) => `${formatNumber(Number(v), 3)} MT`}
            copyValue={shipment.weight_ton?.toString()}
            isRtl={isRtl}
          />
        </div>

        {/* Internal Route Display (POD → Final Destination) */}
        {(shipment.pod_name || shipment.final_destination_place) && (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-indigo-700 mb-1">
              <MapPinIcon className="h-4 w-4" />
              <span className="font-medium">{isRtl ? 'المسار الداخلي' : 'Internal Route'}</span>
            </div>
            <div className="flex items-center gap-2 text-base font-medium text-indigo-900" dir="ltr">
              <span>{shipment.pod_name || '—'}</span>
              <span className="text-indigo-500">→</span>
              <span>{shipment.final_destination_place || '—'}</span>
            </div>
          </div>
        )}

        {/* No Internal Transportation Warning */}
        {hasNoTransport && (
          <div className="mt-3 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
            <span className="text-sm font-medium text-red-700">
              {isRtl ? 'لا يوجد نقل داخلي بعد' : 'No internal transportation yet'}
            </span>
          </div>
        )}

        {/* Internal Transportation Section - Highlighted */}
        {hasDeliveries && (
          <div className="mt-3 rounded-lg border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between w-full text-start px-4 py-3 hover:bg-blue-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-sm text-blue-800">
                  {isRtl ? 'النقل الداخلي' : 'Internal Transport'}
                  <span className="text-blue-600 ms-2 font-normal">
                    ({shipment.delivery_count} {isRtl ? 'توصيل' : 'deliveries'})
                  </span>
                </span>
              </div>
              {isExpanded ? (
                <ChevronUpIcon className="h-5 w-5 text-blue-700" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-blue-600" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {shipment.deliveries.map((delivery, index) => (
                  <DeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    index={index}
                    isRtl={isRtl}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Containers Section - Show when no deliveries but containers exist */}
        {!hasDeliveries && hasContainers && (
          <div className="mt-3 rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between w-full text-start px-4 py-3 hover:bg-amber-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-sm text-amber-800">
                  {isRtl ? 'النقل الداخلي' : 'Internal Transport'}
                  <span className="text-amber-600 ms-2 font-normal">
                    ({shipment.container_count} {isRtl ? 'حاويات - بانتظار التعيين' : 'containers - pending'})
                  </span>
                </span>
              </div>
              {isExpanded ? (
                <ChevronUpIcon className="h-5 w-5 text-amber-700" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-amber-600" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
                  {isRtl 
                    ? 'هذه الحاويات لم يتم تعيينها للنقل بعد. قم بتعيينها من صفحة النقل البري.'
                    : 'These containers have not been assigned for transport yet. Assign them from the Land Transport page.'}
                </p>
                {shipment.containers?.map((container, index) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    index={index}
                    isRtl={isRtl}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* E-Fatura Number Section */}
        {/* Show input for pending view OR when editing in archive view */}
        {/* For archive view with non-required shipments, show read-only display */}
        {(!isArchiveView || isEditing || (isArchiveView && eFaturaRequired)) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isRtl ? 'رقم الفاتورة الإلكترونية (E-Fatura)' : 'E-Fatura Number'}
              {!eFaturaRequired && (
                <span className="text-gray-400 font-normal ms-2">
                  ({isRtl ? 'اختياري' : 'Optional'})
                </span>
              )}
            </label>
            
            {/* Archive view with completed E-Fatura - show display mode */}
            {isArchiveView && isCompleted && !isEditing ? (
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-300 rounded-lg text-sm font-medium text-green-800">
                    {shipment.e_fatura_number}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    {isRtl ? 'تعديل' : 'Edit'}
                  </button>
                </div>
                
                {/* E-Fatura Documents Download Section (Archive View) */}
                {hasDocuments && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {isRtl ? 'المستندات المرفقة:' : 'Attached Documents:'}
                    </p>
                    <div className="space-y-2">
                      {shipment.e_fatura_documents?.map((doc) => (
                        <div 
                          key={doc.id} 
                          className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">
                              {doc.original_filename || doc.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              {doc.uploaded_by && (
                                <span>{isRtl ? 'بواسطة' : 'by'} {doc.uploaded_by} • </span>
                              )}
                              {new Date(doc.upload_ts).toLocaleDateString()}
                              {doc.file_size && (
                                <span> • {(doc.file_size / 1024).toFixed(0)} KB</span>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id, doc.original_filename || doc.filename)}
                            disabled={isDownloading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            <span>{isRtl ? 'تحميل' : 'Download'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Input mode */
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={eFaturaNumber}
                    onChange={(e) => setEFaturaNumber(e.target.value)}
                    placeholder={isRtl ? 'أدخل رقم E-Fatura...' : 'Enter E-Fatura #...'}
                    className={`
                      flex-1 px-3 py-2 border rounded-lg text-sm
                      focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                      ${isCompleted ? 'bg-green-50 border-green-300' : 'border-gray-300'}
                    `}
                    disabled={isSubmitting}
                  />
                  
                  {/* Upload Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5
                      ${selectedFile 
                        ? 'bg-blue-50 border-blue-300 text-blue-700' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }
                    `}
                    title={selectedFile ? selectedFile.name : (isRtl ? 'رفع ملف' : 'Upload file')}
                  >
                    {selectedFile ? (
                      <DocumentArrowUpIcon className="h-5 w-5" />
                    ) : (
                      <ArrowUpTrayIcon className="h-5 w-5" />
                    )}
                    <span className="text-sm hidden sm:inline">
                      {selectedFile 
                        ? (isRtl ? 'تم الاختيار' : 'Selected') 
                        : (isRtl ? 'رفع' : 'Upload')
                      }
                    </span>
                  </button>
                  
                  {/* Cancel button (only in edit mode) */}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEFaturaNumber(shipment.e_fatura_number || '');
                        setSelectedFile(null);
                      }}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm transition-colors"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                  )}
                  
                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSubmit();
                      if (isEditing) setIsEditing(false);
                    }}
                    disabled={isSubmitting || !eFaturaNumber.trim()}
                    className={`
                      px-4 py-2 rounded-lg font-medium text-sm transition-colors
                      ${isSubmitting || !eFaturaNumber.trim()
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }
                    `}
                  >
                    {isSubmitting ? '...' : (isRtl ? 'حفظ' : 'Save')}
                  </button>
                </div>
                {selectedFile && (
                  <p className="text-xs text-blue-600 mt-1">
                    📎 {selectedFile.name}
                  </p>
                )}
                
                {/* E-Fatura Documents Download Section */}
                {hasDocuments && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      {isRtl ? 'المستندات المرفقة:' : 'Attached Documents:'}
                    </p>
                    <div className="space-y-2">
                      {shipment.e_fatura_documents?.map((doc) => (
                        <div 
                          key={doc.id} 
                          className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">
                              {doc.original_filename || doc.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              {doc.uploaded_by && (
                                <span>{isRtl ? 'بواسطة' : 'by'} {doc.uploaded_by} • </span>
                              )}
                              {new Date(doc.upload_ts).toLocaleDateString()}
                              {doc.file_size && (
                                <span> • {(doc.file_size / 1024).toFixed(0)} KB</span>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id, doc.original_filename || doc.filename)}
                            disabled={isDownloading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            <span>{isRtl ? 'تحميل' : 'Download'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Archive view for non-required shipments - simplified display */}
        {isArchiveView && !eFaturaRequired && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <CheckCircleIcon className="h-5 w-5 text-gray-400" />
              <span>
                {isRtl 
                  ? 'هذه الشحنة لا تتطلب فاتورة إلكترونية (ليست عابرة للحدود)'
                  : 'This shipment does not require E-Fatura (not cross-border)'
                }
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EFaturaCard;
