/**
 * Documents Service
 * Frontend API service for document management
 */

import { apiClient } from './api';

// ========== Types ==========

export type EntityType = 'shipment' | 'contract' | 'finance' | 'customs' | 'company';

export type DocumentType =
  | 'proforma_invoice'
  | 'commercial_invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'bill_of_lading_draft'
  | 'bill_of_lading_final'
  | 'certificate_of_origin'
  | 'certificate_of_analysis'
  | 'phytosanitary_certificate'
  | 'fumigation_certificate'
  | 'health_certificate'
  | 'quality_certificate'
  | 'halal_certificate'
  | 'insurance_certificate'
  | 'purchase_order'
  | 'sales_contract'
  | 'import_license'
  | 'export_license'
  | 'customs_declaration'
  | 'goods_receipt_note'
  | 'shipping_instructions'
  | 'product_specification'
  | 'letter_of_credit'
  | 'bank_guarantee'
  | 'payment_receipt'
  | 'e_fatura'
  | 'combined_documents'  // Combined/bundled documents file
  | 'other';

export interface Document {
  id: string;
  shipment_id: string | null;
  contract_id: string | null;
  transaction_id: string | null;
  company_id: string | null;
  customs_batch_id: string | null;
  doc_type: DocumentType;
  filename: string;
  original_filename: string | null;
  file_path: string | null;
  s3_key: string | null;
  file_size: number | null;
  mime_type: string | null;
  version: number;
  is_draft: boolean;
  replaced_by: string | null;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_by_user_id: string | null;
  upload_ts: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  meta_json: Record<string, any>;
  // From view
  shipment_sn?: string;
  contract_no?: string;
  transaction_description?: string;
  customs_batch_name?: string;
  company_name?: string;
  uploaded_by_name?: string;
  permission_count?: number;
}

export interface DocumentPermission {
  id: string;
  document_id: string;
  user_id: string | null;
  branch_id: string | null;
  role: string | null;
  permission: 'view' | 'download' | 'edit' | 'delete' | 'manage';
  granted_by: string | null;
  created_at: string;
  user_name?: string;
  username?: string;
  branch_name?: string;
  granted_by_name?: string;
}

export interface DocumentListParams {
  page?: number;
  limit?: number;
  shipment_id?: string;
  contract_id?: string;
  transaction_id?: string;
  company_id?: string;
  customs_batch_id?: string;
  doc_type?: DocumentType;
  is_draft?: boolean;
  search?: string;
  sort_by?: 'upload_ts' | 'filename' | 'doc_type' | 'file_size';
  sort_dir?: 'ASC' | 'DESC';
}

export interface DocumentListResponse {
  data: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UploadDocumentParams {
  file: File;
  entity_type: EntityType;
  entity_id: string;
  doc_type: DocumentType;
  is_draft?: boolean;
  notes?: string;
}

export interface BulkUploadParams {
  files: File[];
  entity_type: EntityType;
  entity_id: string;
  doc_types: DocumentType[];
}

// ========== API Functions ==========

/**
 * List documents with filters
 */
export async function listDocuments(params: DocumentListParams = {}): Promise<DocumentListResponse> {
  const response = await apiClient.get('/documents', { params });
  return response.data;
}

/**
 * Get documents for a specific entity
 */
export async function getDocumentsForEntity(
  entityType: EntityType,
  entityId: string
): Promise<Document[]> {
  const paramMap: Record<EntityType, string> = {
    shipment: 'shipment_id',
    contract: 'contract_id',
    finance: 'transaction_id',
    customs: 'customs_batch_id',
    company: 'company_id',
  };

  const response = await apiClient.get('/documents', {
    params: { [paramMap[entityType]]: entityId, limit: 100 },
  });
  return response.data.data;
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string): Promise<Document> {
  const response = await apiClient.get(`/documents/${id}`);
  return response.data;
}

/**
 * Upload a single document
 */
export async function uploadDocument(params: UploadDocumentParams): Promise<Document> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('entity_type', params.entity_type);
  formData.append('entity_id', params.entity_id);
  formData.append('doc_type', params.doc_type);
  
  if (params.is_draft !== undefined) {
    formData.append('is_draft', String(params.is_draft));
  }
  if (params.notes) {
    formData.append('notes', params.notes);
  }

  const response = await apiClient.post('/documents', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.document;
}

/**
 * Upload multiple documents at once
 */
export async function uploadDocumentsBulk(params: BulkUploadParams): Promise<{
  documents: Document[];
  errors?: Array<{ filename: string; error: string }>;
}> {
  const formData = new FormData();
  
  params.files.forEach((file) => {
    formData.append('files', file);
  });
  
  formData.append('entity_type', params.entity_type);
  formData.append('entity_id', params.entity_id);
  formData.append('doc_types', JSON.stringify(params.doc_types));

  const response = await apiClient.post('/documents/bulk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Download a document
 */
export async function downloadDocument(id: string, filename?: string): Promise<void> {
  const response = await apiClient.get(`/documents/${id}/download`, {
    responseType: 'blob',
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || 'document');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Update document metadata or replace file
 */
export async function updateDocument(
  id: string,
  updates: {
    doc_type?: DocumentType;
    is_draft?: boolean;
    notes?: string;
    file?: File;
  }
): Promise<Document> {
  const formData = new FormData();
  
  if (updates.file) {
    formData.append('file', updates.file);
  }
  if (updates.doc_type) {
    formData.append('doc_type', updates.doc_type);
  }
  if (updates.is_draft !== undefined) {
    formData.append('is_draft', String(updates.is_draft));
  }
  if (updates.notes !== undefined) {
    formData.append('notes', updates.notes);
  }

  const response = await apiClient.put(`/documents/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.document;
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

/**
 * Get document permissions
 */
export async function getDocumentPermissions(documentId: string): Promise<DocumentPermission[]> {
  const response = await apiClient.get(`/documents/${documentId}/permissions`);
  return response.data.permissions;
}

/**
 * Add permission to a document
 */
export async function addDocumentPermission(
  documentId: string,
  permission: {
    user_id?: string;
    branch_id?: string;
    role?: string;
    permission: 'view' | 'download' | 'edit' | 'delete' | 'manage';
  }
): Promise<DocumentPermission> {
  const response = await apiClient.post(`/documents/${documentId}/permissions`, permission);
  return response.data.permission;
}

/**
 * Remove permission from a document
 */
export async function removeDocumentPermission(
  documentId: string,
  permissionId: string
): Promise<void> {
  await apiClient.delete(`/documents/${documentId}/permissions/${permissionId}`);
}

// ========== Helper Functions ==========

/**
 * Get human-readable document type name
 */
export function getDocumentTypeName(docType: DocumentType, language: 'en' | 'ar' = 'en'): string {
  const names: Record<DocumentType, { en: string; ar: string }> = {
    proforma_invoice: { en: 'Proforma Invoice', ar: 'الفاتورة الأولية' },
    commercial_invoice: { en: 'Commercial Invoice', ar: 'الفاتورة التجارية' },
    packing_list: { en: 'Packing List', ar: 'قائمة التعبئة' },
    bill_of_lading: { en: 'Bill of Lading', ar: 'بوليصة الشحن' },
    bill_of_lading_draft: { en: 'Bill of Lading (Draft)', ar: 'بوليصة الشحن (مسودة)' },
    bill_of_lading_final: { en: 'Bill of Lading (Final)', ar: 'بوليصة الشحن (نهائية)' },
    certificate_of_origin: { en: 'Certificate of Origin', ar: 'شهادة المنشأ' },
    certificate_of_analysis: { en: 'Certificate of Analysis', ar: 'شهادة التحليل' },
    phytosanitary_certificate: { en: 'Phytosanitary Certificate', ar: 'الشهادة الصحية النباتية' },
    fumigation_certificate: { en: 'Fumigation Certificate', ar: 'شهادة التبخير' },
    health_certificate: { en: 'Health Certificate', ar: 'الشهادة الصحية' },
    quality_certificate: { en: 'Quality Certificate', ar: 'شهادة الجودة' },
    halal_certificate: { en: 'Halal Certificate', ar: 'شهادة الحلال' },
    insurance_certificate: { en: 'Insurance Certificate', ar: 'شهادة التأمين' },
    purchase_order: { en: 'Purchase Order', ar: 'أمر الشراء' },
    sales_contract: { en: 'Sales Contract', ar: 'عقد البيع' },
    import_license: { en: 'Import License', ar: 'رخصة الاستيراد' },
    export_license: { en: 'Export License', ar: 'رخصة التصدير' },
    customs_declaration: { en: 'Customs Declaration', ar: 'البيان الجمركي' },
    goods_receipt_note: { en: 'Goods Receipt Note', ar: 'مذكرة استلام البضائع' },
    shipping_instructions: { en: 'Shipping Instructions', ar: 'تعليمات الشحن' },
    product_specification: { en: 'Product Specification', ar: 'مواصفات المنتج' },
    letter_of_credit: { en: 'Letter of Credit', ar: 'خطاب الاعتماد' },
    bank_guarantee: { en: 'Bank Guarantee', ar: 'ضمان بنكي' },
    payment_receipt: { en: 'Payment Receipt', ar: 'إيصال الدفع' },
    e_fatura: { en: 'E-Fatura', ar: 'الفاتورة الإلكترونية' },
    combined_documents: { en: 'Combined Documents Bundle', ar: 'ملف المستندات الكامل' },
    other: { en: 'Other', ar: 'أخرى' },
  };

  return names[docType]?.[language] || docType;
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get icon for document type
 */
export function getDocumentTypeIcon(docType: DocumentType): string {
  const icons: Record<DocumentType, string> = {
    proforma_invoice: '📄',
    commercial_invoice: '🧾',
    packing_list: '📦',
    bill_of_lading: '🚢',
    bill_of_lading_draft: '📝',
    bill_of_lading_final: '🚢',
    certificate_of_origin: '🌍',
    certificate_of_analysis: '🔬',
    phytosanitary_certificate: '🌿',
    fumigation_certificate: '💨',
    health_certificate: '🏥',
    quality_certificate: '✅',
    halal_certificate: '☪️',
    insurance_certificate: '🛡️',
    purchase_order: '📝',
    sales_contract: '📋',
    import_license: '📑',
    export_license: '📜',
    customs_declaration: '🛃',
    goods_receipt_note: '📥',
    shipping_instructions: '📨',
    product_specification: '📊',
    letter_of_credit: '💳',
    bank_guarantee: '🏦',
    payment_receipt: '💰',
    e_fatura: '🧾',
    combined_documents: '📚',
    other: '📁',
  };

  return icons[docType] || '📁';
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(filename: string): boolean {
  const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif'];
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return allowedExtensions.includes(ext);
}

/**
 * Get MIME type from filename
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

