/**
 * DocumentUploadModal Component
 * Multi-file upload modal with drag & drop, per-file type selection
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XMarkIcon,
  CloudArrowUpIcon,
  DocumentPlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { Spinner } from '../common/Spinner';
import {
  uploadDocument,
  getDocumentTypeName,
  getDocumentTypeIcon,
  isAllowedFileType,
  formatFileSize,
  type EntityType,
  type DocumentType,
} from '../../services/documents';

interface FileUploadItem {
  id: string;
  file: File;
  docType: DocumentType;
  isDraft: boolean;
  notes: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: string;
  entityRef?: string;
  onSuccess?: () => void;
}

const COMMON_DOC_TYPES: DocumentType[] = [
  'proforma_invoice',
  'commercial_invoice',
  'packing_list',
  'bill_of_lading',
  'bill_of_lading_draft',
  'bill_of_lading_final',
  'certificate_of_origin',
  'certificate_of_analysis',
  'phytosanitary_certificate',
  'fumigation_certificate',
  'health_certificate',
  'quality_certificate',
  'insurance_certificate',
  'customs_declaration',
  'payment_receipt',
  'letter_of_credit',
  'other',
];

export function DocumentUploadModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityRef,
  onSuccess,
}: DocumentUploadModalProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  // Generate unique ID
  const generateId = () => `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle file selection
  const handleFileSelect = useCallback((selectedFiles: FileList | File[]) => {
    const newFiles: FileUploadItem[] = Array.from(selectedFiles)
      .filter((file) => {
        if (!isAllowedFileType(file.name)) {
          alert(isRtl 
            ? `نوع الملف غير مسموح: ${file.name}`
            : `File type not allowed: ${file.name}`
          );
          return false;
        }
        return true;
      })
      .map((file) => ({
        id: generateId(),
        file,
        docType: guessDocType(file.name),
        isDraft: false,
        notes: '',
        status: 'pending' as const,
      }));

    setFiles((prev) => [...prev, ...newFiles]);
    setUploadComplete(false);
  }, [isRtl]);

  // Guess document type from filename
  const guessDocType = (filename: string): DocumentType => {
    const lower = filename.toLowerCase();
    if (lower.includes('proforma') || lower.includes('pi')) return 'proforma_invoice';
    if (lower.includes('invoice') || lower.includes('commercial') || lower.includes('ci')) return 'commercial_invoice';
    if (lower.includes('packing') || lower.includes('pl')) return 'packing_list';
    if (lower.includes('bl') || lower.includes('lading')) {
      if (lower.includes('draft')) return 'bill_of_lading_draft';
      if (lower.includes('final')) return 'bill_of_lading_final';
      return 'bill_of_lading';
    }
    if (lower.includes('origin') || lower.includes('coo')) return 'certificate_of_origin';
    if (lower.includes('analysis') || lower.includes('coa')) return 'certificate_of_analysis';
    if (lower.includes('phyto')) return 'phytosanitary_certificate';
    if (lower.includes('fumigation')) return 'fumigation_certificate';
    if (lower.includes('health')) return 'health_certificate';
    if (lower.includes('quality')) return 'quality_certificate';
    if (lower.includes('insurance')) return 'insurance_certificate';
    if (lower.includes('customs')) return 'customs_declaration';
    if (lower.includes('payment') || lower.includes('receipt')) return 'payment_receipt';
    if (lower.includes('lc') || lower.includes('credit')) return 'letter_of_credit';
    return 'other';
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // Update file settings
  const updateFile = (id: string, updates: Partial<FileUploadItem>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  // Remove file from list
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Upload all files
  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (const fileItem of files) {
      if (fileItem.status === 'success') continue;

      updateFile(fileItem.id, { status: 'uploading' });

      try {
        await uploadDocument({
          file: fileItem.file,
          entity_type: entityType,
          entity_id: entityId,
          doc_type: fileItem.docType,
          is_draft: fileItem.isDraft,
          notes: fileItem.notes || undefined,
        });

        updateFile(fileItem.id, { status: 'success' });
      } catch (err: any) {
        updateFile(fileItem.id, {
          status: 'error',
          error: err.response?.data?.error || err.message || 'Upload failed',
        });
      }
    }

    setIsUploading(false);
    setUploadComplete(true);

    // Check if all succeeded
    const hasErrors = files.some((f) => f.status === 'error');
    if (!hasErrors) {
      onSuccess?.();
    }
  };

  // Close and reset
  const handleClose = () => {
    setFiles([]);
    setUploadComplete(false);
    onClose();
  };

  if (!isOpen) return null;

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isRtl ? 'رفع المستندات' : 'Upload Documents'}
              </h2>
              {entityRef && (
                <p className="text-sm text-gray-500 mt-0.5">{entityRef}</p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                className="hidden"
              />
              
              <CloudArrowUpIcon className={`h-12 w-12 mx-auto mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              
              <p className="text-base font-medium text-gray-700 mb-1">
                {isDragActive
                  ? (isRtl ? 'أفلت الملفات هنا' : 'Drop files here')
                  : (isRtl ? 'اسحب وأفلت الملفات هنا' : 'Drag & drop files here')
                }
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {isRtl ? 'أو انقر للاختيار' : 'or click to select'}
              </p>
              <p className="text-xs text-gray-400">
                {isRtl
                  ? 'PDF, DOC, XLS, JPG, PNG - حتى 50 ميجابايت'
                  : 'PDF, DOC, XLS, JPG, PNG - up to 50MB'
                }
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {isRtl ? 'الملفات المحددة' : 'Selected Files'} ({files.length})
                  </h3>
                  {uploadComplete && (
                    <div className="flex items-center gap-2 text-sm">
                      {successCount > 0 && (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircleIcon className="h-4 w-4" />
                          {successCount} {isRtl ? 'نجح' : 'succeeded'}
                        </span>
                      )}
                      {errorCount > 0 && (
                        <span className="text-red-600 flex items-center gap-1">
                          <ExclamationCircleIcon className="h-4 w-4" />
                          {errorCount} {isRtl ? 'فشل' : 'failed'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className={`
                        p-4 rounded-lg border transition-colors
                        ${fileItem.status === 'success'
                          ? 'bg-green-50 border-green-200'
                          : fileItem.status === 'error'
                          ? 'bg-red-50 border-red-200'
                          : fileItem.status === 'uploading'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {fileItem.status === 'uploading' ? (
                            <Spinner size="sm" />
                          ) : fileItem.status === 'success' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          ) : fileItem.status === 'error' ? (
                            <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
                          ) : (
                            <DocumentPlusIcon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>

                        {/* File Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {fileItem.file.name}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ({formatFileSize(fileItem.file.size)})
                            </span>
                          </div>

                          {fileItem.status === 'error' && fileItem.error && (
                            <p className="text-xs text-red-600 mb-2">{fileItem.error}</p>
                          )}

                          {/* Settings (only for pending files) */}
                          {fileItem.status === 'pending' && (
                            <div className="grid grid-cols-2 gap-3">
                              {/* Document Type */}
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  {isRtl ? 'نوع المستند' : 'Document Type'}
                                </label>
                                <select
                                  value={fileItem.docType}
                                  onChange={(e) => updateFile(fileItem.id, { docType: e.target.value as DocumentType })}
                                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {COMMON_DOC_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                      {getDocumentTypeIcon(type)} {getDocumentTypeName(type, isRtl ? 'ar' : 'en')}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Draft Toggle */}
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  {isRtl ? 'الحالة' : 'Status'}
                                </label>
                                <select
                                  value={fileItem.isDraft ? 'draft' : 'final'}
                                  onChange={(e) => updateFile(fileItem.id, { isDraft: e.target.value === 'draft' })}
                                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="final">{isRtl ? 'نهائي' : 'Final'}</option>
                                  <option value="draft">{isRtl ? 'مسودة' : 'Draft'}</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Remove Button (only for pending files) */}
                        {fileItem.status === 'pending' && (
                          <button
                            onClick={() => removeFile(fileItem.id)}
                            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="text-sm text-gray-500">
              {files.length === 0
                ? (isRtl ? 'لم يتم تحديد ملفات' : 'No files selected')
                : uploadComplete
                ? (isRtl
                    ? `تم رفع ${successCount} من ${files.length} ملفات`
                    : `Uploaded ${successCount} of ${files.length} files`
                  )
                : (isRtl
                    ? `${pendingCount} ملفات جاهزة للرفع`
                    : `${pendingCount} files ready to upload`
                  )
              }
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {uploadComplete
                  ? (isRtl ? 'إغلاق' : 'Close')
                  : (isRtl ? 'إلغاء' : 'Cancel')
                }
              </button>

              {!uploadComplete && files.length > 0 && (
                <button
                  onClick={handleUpload}
                  disabled={isUploading || pendingCount === 0}
                  className={`
                    px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors
                    flex items-center gap-2
                    ${isUploading || pendingCount === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                    }
                  `}
                >
                  {isUploading ? (
                    <>
                      <Spinner size="sm" />
                      {isRtl ? 'جاري الرفع...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-5 w-5" />
                      {isRtl ? 'رفع الملفات' : 'Upload Files'}
                    </>
                  )}
                </button>
              )}

              {uploadComplete && errorCount > 0 && (
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <CloudArrowUpIcon className="h-5 w-5" />
                  {isRtl ? 'إعادة محاولة الفاشلة' : 'Retry Failed'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentUploadModal;

