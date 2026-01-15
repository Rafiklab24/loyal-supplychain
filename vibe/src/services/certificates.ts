/**
 * Certificates Service
 * Handles certificate templates, sale certificates, and sale-import linkages
 * Part of the selling workflow system
 */

import { apiClient } from './api';

// ============================================
// Types
// ============================================

export interface CertificateTemplate {
  id: string;
  name: string;
  name_ar?: string;
  certificate_type: 'quality' | 'origin' | 'health' | 'analysis' | 'phytosanitary' | 'weight' | 'fumigation' | 'other';
  description?: string;
  template_content: string;
  template_variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaleCertificate {
  id: string;
  shipment_id: string;
  template_id?: string;
  certificate_type: string;
  certificate_number?: string;
  content?: string;
  issued_date?: string;
  expiry_date?: string;
  issued_by?: string;
  s3_key?: string;
  status: 'draft' | 'final' | 'superseded';
  template_name?: string;
  template_name_ar?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleImportLink {
  id: string;
  sale_shipment_id: string;
  source_shipment_id: string;
  source_ci_number?: string;
  quantity_sold: number;
  quantity_unit: string;
  notes?: string;
  // Joined fields
  source_sn?: string;
  source_subject?: string;
  source_product?: string;
  source_total_quantity?: number;
  created_at: string;
}

export interface SourceImportAvailable {
  shipment_id: string;
  sn?: string;
  subject?: string;
  booking_no?: string;
  bl_no?: string;
  product_text?: string;
  total_quantity: number;
  weight_unit?: string;
  supplier_id?: string;
  supplier_name?: string;
  quantity_sold: number;
  quantity_remaining: number;
  created_at: string;
  eta?: string;
  etd?: string;
  display_label?: string; // Combined display label for search results
}

export interface BeyanameInfo {
  beyaname_number?: string;
  beyaname_date?: string;
  beyaname_status?: 'pending' | 'issued' | 'cancelled';
  sn?: string;
  subject?: string;
  source_imports?: Array<{
    source_ci: string;
    quantity_sold: number;
    source_shipment_id: string;
  }>;
}

// ============================================
// Certificate Templates API
// ============================================

export async function getCertificateTemplates(params?: { type?: string; active_only?: boolean }) {
  const response = await apiClient.get('/certificates/templates', { params });
  return response.data;
}

export async function getCertificateTemplate(id: string) {
  const response = await apiClient.get(`/certificates/templates/${id}`);
  return response.data;
}

export async function createCertificateTemplate(data: Partial<CertificateTemplate>) {
  const response = await apiClient.post('/certificates/templates', data);
  return response.data;
}

export async function updateCertificateTemplate(id: string, data: Partial<CertificateTemplate>) {
  const response = await apiClient.put(`/certificates/templates/${id}`, data);
  return response.data;
}

export async function deleteCertificateTemplate(id: string) {
  const response = await apiClient.delete(`/certificates/templates/${id}`);
  return response.data;
}

// ============================================
// Sale Certificates API
// ============================================

export async function getShipmentCertificates(shipmentId: string) {
  const response = await apiClient.get(`/certificates/shipment/${shipmentId}`);
  return response.data;
}

export async function generateCertificate(data: {
  shipment_id: string;
  template_id?: string;
  certificate_type: string;
  certificate_number?: string;
  variables?: Record<string, string | number>;
  issued_date?: string;
  expiry_date?: string;
  issued_by?: string;
}) {
  const response = await apiClient.post('/certificates/generate', data);
  return response.data;
}

export async function updateCertificate(id: string, data: Partial<SaleCertificate>) {
  const response = await apiClient.put(`/certificates/${id}`, data);
  return response.data;
}

export async function deleteCertificate(id: string) {
  const response = await apiClient.delete(`/certificates/${id}`);
  return response.data;
}

// ============================================
// Source Imports API (for sale linking)
// ============================================

export async function getSourceImports(params?: { search?: string; min_remaining?: number }) {
  const response = await apiClient.get('/certificates/source-imports', { params });
  return response.data;
}

export async function getSaleImportLinks(saleShipmentId: string) {
  const response = await apiClient.get(`/certificates/sale-links/${saleShipmentId}`);
  return response.data;
}

export async function getSourceSales(sourceShipmentId: string) {
  const response = await apiClient.get(`/certificates/source-sales/${sourceShipmentId}`);
  return response.data;
}

export async function createSaleImportLink(data: {
  sale_shipment_id: string;
  source_shipment_id: string;
  quantity_sold: number;
  quantity_unit?: string;
  notes?: string;
}) {
  const response = await apiClient.post('/certificates/sale-links', data);
  return response.data;
}

export async function updateSaleImportLink(id: string, data: Partial<SaleImportLink>) {
  const response = await apiClient.put(`/certificates/sale-links/${id}`, data);
  return response.data;
}

export async function deleteSaleImportLink(id: string) {
  const response = await apiClient.delete(`/certificates/sale-links/${id}`);
  return response.data;
}

// ============================================
// Beyaname API
// ============================================

export async function getBeyanameInfo(shipmentId: string): Promise<BeyanameInfo> {
  const response = await apiClient.get(`/certificates/beyaname/${shipmentId}`);
  return response.data;
}

export async function updateBeyaname(shipmentId: string, data: {
  beyaname_number?: string;
  beyaname_date?: string;
  beyaname_status?: 'pending' | 'issued' | 'cancelled';
}) {
  const response = await apiClient.put(`/certificates/beyaname/${shipmentId}`, data);
  return response.data;
}

