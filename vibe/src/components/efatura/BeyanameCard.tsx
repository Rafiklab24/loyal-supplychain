/**
 * BeyanameCard Component
 * Displays a shipment's Beyaname (customs declaration) information
 * For incoming shipments destined to Antrepo warehouse
 */

import { useState, useRef } from 'react';
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  BuildingOfficeIcon,
  TruckIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { CopyableField } from './CopyableField';
import type { BeyanameShipment } from '../../services/efatura';
import { useToast } from '../common/Toast';

interface BeyanameCardProps {
  shipment: BeyanameShipment;
  onSaveBeyaname: (shipmentId: string, beyanameNumber: string, beyanameDate?: string, file?: File) => Promise<void>;
  onMarkComplete: (shipmentId: string) => Promise<void>;
  isRtl?: boolean;
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

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function BeyanameCard({ shipment, onSaveBeyaname, onMarkComplete, isRtl = true }: BeyanameCardProps) {
  const [beyanameNumber, setBeyanameNumber] = useState(shipment.beyaname_number || '');
  const [beyanameDate, setBeyanameDate] = useState(shipment.beyaname_date || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const isPending = shipment.beyaname_status === 'pending' || !shipment.beyaname_number;
  const isIssued = shipment.beyaname_status === 'issued';
  const isCompleted = shipment.beyaname_status === 'completed';
  const hasDocument = shipment.beyaname_documents && shipment.beyaname_documents.length > 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.warning(isRtl ? 'يرجى اختيار ملف PDF أو صورة' : 'Please select a PDF or image file');
        return;
      }
      setSelectedFile(file);
      toast.success(isRtl ? `تم اختيار: ${file.name}` : `Selected: ${file.name}`, 2000);
    }
  };

  const handleSave = async () => {
    if (!beyanameNumber.trim()) {
      toast.warning(isRtl ? 'الرجاء إدخال رقم البيانامة' : 'Please enter Beyaname number');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveBeyaname(shipment.id, beyanameNumber.trim(), beyanameDate || undefined, selectedFile || undefined);
      toast.success(isRtl ? 'تم حفظ البيانامة بنجاح ✓' : 'Beyaname saved successfully ✓');
      setSelectedFile(null);
    } catch (error) {
      toast.error(isRtl ? 'فشل في حفظ البيانامة' : 'Failed to save Beyaname');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkComplete = async () => {
    setIsSubmitting(true);
    try {
      await onMarkComplete(shipment.id);
      toast.success(isRtl ? 'تم تحديث الحالة بنجاح ✓' : 'Status updated successfully ✓');
    } catch (error) {
      toast.error(isRtl ? 'فشل في تحديث الحالة' : 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = () => {
    if (isCompleted) return 'border-green-200 bg-green-50/30';
    if (isIssued) return 'border-blue-200 bg-blue-50/30';
    return 'border-amber-200 bg-amber-50/30';
  };

  const getHeaderColor = () => {
    if (isCompleted) return 'bg-green-50 border-green-200';
    if (isIssued) return 'bg-blue-50 border-blue-200';
    return 'bg-amber-50 border-amber-200';
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${getStatusColor()}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${getHeaderColor()}`}>
        <div className="flex items-center gap-2">
          <DocumentTextIcon className={`h-5 w-5 ${isCompleted ? 'text-green-600' : isIssued ? 'text-blue-600' : 'text-amber-600'}`} />
          <span className={`font-bold text-base ${isCompleted ? 'text-green-800' : 'text-gray-900'}`}>
            {shipment.commercial_invoice_number}
          </span>
          {/* Antrepo badge */}
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
            {isRtl ? shipment.antrepo_name_ar || 'أنتريبو' : shipment.antrepo_name || 'Antrepo'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badges */}
          {isPending && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              {isRtl ? 'معلق' : 'Pending'}
            </span>
          )}
          {isIssued && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
              <DocumentTextIcon className="h-3.5 w-3.5" />
              {isRtl ? 'صدرت' : 'Issued'}
            </span>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <CheckCircleIcon className="h-5 w-5" />
              <span>{isRtl ? 'مكتمل' : 'Done'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Body - Shipment Fields */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <CopyableField
            label="CI Number"
            labelAr="رقم الفاتورة"
            value={shipment.commercial_invoice_number}
            isRtl={isRtl}
          />
          <CopyableField
            label="Product"
            labelAr="المنتج"
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
            label="Weight"
            labelAr="الوزن"
            value={shipment.weight_ton}
            formatValue={(v) => `${formatNumber(Number(v), 3)} MT`}
            copyValue={shipment.weight_ton?.toString()}
            isRtl={isRtl}
          />
          <CopyableField
            label="POL"
            labelAr="ميناء التحميل"
            value={shipment.pol_name}
            isRtl={isRtl}
          />
          <CopyableField
            label="POD"
            labelAr="ميناء الوصول"
            value={shipment.pod_name}
            isRtl={isRtl}
          />
          <CopyableField
            label="Containers"
            labelAr="الحاويات"
            value={shipment.container_count}
            formatValue={(v) => formatNumber(Number(v), 0)}
            isRtl={isRtl}
          />
          <CopyableField
            label="Value"
            labelAr="القيمة"
            value={shipment.total_value_usd}
            formatValue={(v) => formatCurrency(Number(v), shipment.currency_code || 'USD')}
            copyValue={shipment.total_value_usd?.toString()}
            isRtl={isRtl}
          />
        </div>

        {/* Destination Info */}
        <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-purple-700 mb-1">
            <BuildingOfficeIcon className="h-4 w-4" />
            <span className="font-medium">{isRtl ? 'الوجهة النهائية' : 'Final Destination'}</span>
          </div>
          <div className="text-base font-medium text-purple-900">
            {isRtl 
              ? shipment.antrepo_name_ar || shipment.final_destination_name || 'أنتريبو'
              : shipment.antrepo_name || shipment.final_destination_name || 'Antrepo'
            }
          </div>
        </div>

        {/* Beyaname Section */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-gray-900">
              {isRtl ? 'معلومات البيانامة' : 'Beyaname Information'}
            </span>
          </div>

          {/* If already issued/completed - show display */}
          {(isIssued || isCompleted) && shipment.beyaname_number && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <div className="text-xs text-indigo-600 mb-0.5">{isRtl ? 'رقم البيانامة' : 'Beyaname Number'}</div>
                  <div className="font-medium text-indigo-900">{shipment.beyaname_number}</div>
                </div>
                {shipment.beyaname_date && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <div className="text-xs text-indigo-600 mb-0.5">{isRtl ? 'تاريخ الإصدار' : 'Issue Date'}</div>
                    <div className="font-medium text-indigo-900">{formatDate(shipment.beyaname_date)}</div>
                  </div>
                )}
              </div>

              {/* Documents attached */}
              {hasDocument && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <DocumentArrowUpIcon className="h-4 w-4 text-green-600" />
                  {shipment.beyaname_documents.length} {isRtl ? 'مستند مرفق' : 'document(s) attached'}
                </div>
              )}

              {/* Mark as complete button (if issued but not completed) */}
              {isIssued && !isCompleted && (
                <button
                  type="button"
                  onClick={handleMarkComplete}
                  disabled={isSubmitting}
                  className="w-full mt-2 px-4 py-2 rounded-lg font-medium text-sm bg-green-600 text-white hover:bg-green-700 transition-colors disabled:bg-gray-300"
                >
                  {isSubmitting ? '...' : (isRtl ? 'تحديد كمكتمل ✓' : 'Mark as Complete ✓')}
                </button>
              )}
            </div>
          )}

          {/* Input mode - for pending */}
          {isPending && (
            <div className="space-y-3">
              {/* Beyaname Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'رقم البيانامة' : 'Beyaname Number'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={beyanameNumber}
                  onChange={(e) => setBeyanameNumber(e.target.value)}
                  placeholder={isRtl ? 'أدخل رقم البيانامة...' : 'Enter Beyaname number...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isSubmitting}
                />
              </div>

              {/* Beyaname Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'تاريخ الإصدار' : 'Issue Date'}
                </label>
                <div className="relative">
                  <CalendarDaysIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={beyanameDate}
                    onChange={(e) => setBeyanameDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* File Upload + Save */}
              <div className="flex items-center gap-2">
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
                    flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2
                    ${selectedFile 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }
                  `}
                >
                  {selectedFile ? (
                    <>
                      <DocumentArrowUpIcon className="h-5 w-5" />
                      <span className="text-sm truncate max-w-[150px]">{selectedFile.name}</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="h-5 w-5" />
                      <span className="text-sm">{isRtl ? 'رفع المستند' : 'Upload Document'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting || !beyanameNumber.trim()}
                  className={`
                    px-6 py-2 rounded-lg font-medium text-sm transition-colors
                    ${isSubmitting || !beyanameNumber.trim()
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }
                  `}
                >
                  {isSubmitting ? '...' : (isRtl ? 'حفظ' : 'Save')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BeyanameCard;


