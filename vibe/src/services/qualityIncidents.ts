/**
 * Quality Incidents Service
 * API client for Quality Incident Wizard and Review Dashboard
 */

import { apiClient } from './api';

// ============================================================
// TYPES
// ============================================================

export type IssueType = 'broken' | 'mold' | 'moisture' | 'foreign_matter' | 'wrong_spec' | 'damaged';
export type IssueSubtype = 'torn_bag' | 'crushed' | 'wet_external' | 'dirty' | 'pest_signs';
export type IncidentStatus = 'draft' | 'submitted' | 'under_review' | 'action_set' | 'closed';
export type ActionType = 'request_resample' | 'keep_hold' | 'clear_hold' | 'close' | 'add_note';
export type MediaSlot = 'stack_context' | 'opened_bag' | 'defects_separated' | 'container_condition' | 'other';

export interface SampleCard {
  id: string;
  sample_id: string;
  sample_group: 'front' | 'middle' | 'back';
  sample_weight_g: number;
  broken_g: number;
  mold_g: number;
  foreign_g: number;
  other_g: number;
  broken_pct: number;
  mold_pct: number;
  foreign_pct: number;
  other_pct: number;
  total_defect_pct: number;
  is_complete: boolean;
  weighing_required: boolean;
}

export interface QualityMedia {
  id: string;
  sample_card_id: string | null;
  media_type: 'photo' | 'video';
  slot: MediaSlot;
  file_path: string;
  file_url: string | null;
  file_name: string;
  watermark_text: string | null;
  created_at: string;
}

export interface ReviewAction {
  id: string;
  by_user_id: string;
  by_role: string;
  action_type: ActionType;
  notes: string | null;
  target_sample_ids: string[] | null;
  created_at: string;
  reviewer_name: string;
}

export interface QualityIncident {
  id: string;
  shipment_id: string;
  branch_id: string | null;
  created_by_user_id: string;
  status: IncidentStatus;
  issue_type: IssueType;
  issue_subtype: IssueSubtype | null;
  description_short: string | null;
  affected_estimate_min: number | null;
  affected_estimate_max: number | null;
  affected_estimate_mode: 'calculated' | 'slider' | 'manual' | null;
  container_moisture_seen: boolean;
  container_bad_smell: boolean;
  container_torn_bags: boolean;
  container_torn_bags_count: number | null;
  container_condensation: boolean;
  
  // Measurement fields
  sample_weight_g: number | null;
  broken_g: number | null;
  mold_g: number | null;
  foreign_g: number | null;
  other_g: number | null;
  moisture_pct: number | null;
  
  // Calculated stats
  avg_defect_pct: number | null;
  min_defect_pct: number | null;
  max_defect_pct: number | null;
  worst_sample_id: string | null;
  samples_completed: number;
  samples_required: number;
  
  // Hold status
  hold_status: boolean;
  hold_reason: string | null;
  
  hold_applied_at: string | null;
  submitted_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined data
  shipment_sn: string;
  shipment_status: string;
  supplier_id: string | null;
  supplier_name: string | null;
  product_text: string | null;
  weight_ton: number | null;
  container_count: number | null;
  bags_count: number | null;
  reporter_name: string | null;
  reporter_username: string | null;
  branch_name: string | null;
  
  // Nested arrays
  sample_cards: SampleCard[];
  media: QualityMedia[];
  review_actions: ReviewAction[];
}

export interface IncidentStats {
  draft: number;
  submitted: number;
  under_review: number;
  action_set: number;
  closed: number;
  total: number;
  overall_avg_defect_pct: number | null;
}

export interface CreateIncidentData {
  shipment_id: string;
  issue_type: IssueType;
  issue_subtype?: IssueSubtype;
  description_short?: string;
  branch_id?: string;
}

export interface UpdateIncidentData {
  issue_type?: IssueType;
  issue_subtype?: IssueSubtype;
  description_short?: string;
  container_moisture_seen?: boolean;
  container_bad_smell?: boolean;
  container_torn_bags?: boolean;
  container_torn_bags_count?: number;
  container_condensation?: boolean;
  affected_estimate_min?: number;
  affected_estimate_max?: number;
  affected_estimate_mode?: 'calculated' | 'slider' | 'manual';
}

export interface UpdateSampleData {
  sample_id: string;
  sample_weight_g?: number;
  broken_g?: number;
  mold_g?: number;
  foreign_g?: number;
  other_g?: number;
  is_complete?: boolean;
  notes?: string;
}

export interface ReviewActionData {
  action_type: ActionType;
  notes?: string;
  target_sample_ids?: string[];
}

// ============================================================
// ISSUE TYPE METADATA
// ============================================================

export const ISSUE_TYPES: Record<IssueType, { label: string; labelAr: string; icon: string }> = {
  broken: { label: 'Broken', labelAr: 'كسر', icon: '💔' },
  mold: { label: 'Mold/Rot', labelAr: 'عفن', icon: '🦠' },
  moisture: { label: 'Moisture', labelAr: 'رطوبة', icon: '💧' },
  foreign_matter: { label: 'Foreign Matter', labelAr: 'شوائب', icon: '🪨' },
  wrong_spec: { label: 'Wrong Spec', labelAr: 'غير مطابق', icon: '❌' },
  damaged: { label: 'Damaged', labelAr: 'تالف', icon: '📦' },
};

export const ISSUE_SUBTYPES: Record<IssueSubtype, { label: string; labelAr: string }> = {
  torn_bag: { label: 'Torn/Open Bag', labelAr: 'كيس ممزق' },
  crushed: { label: 'Crushed Bags', labelAr: 'أكياس مضغوطة' },
  wet_external: { label: 'Wet Bags (external)', labelAr: 'أكياس مبلولة' },
  dirty: { label: 'Dirty/Contaminated', labelAr: 'أكياس متسخة' },
  pest_signs: { label: 'Pest Signs', labelAr: 'آثار حشرات' },
};

export const SAMPLE_IDS = ['F1', 'F2', 'F3', 'M1', 'M2', 'M3', 'B1', 'B2', 'B3'] as const;

export const SAMPLE_GROUPS: Record<string, 'front' | 'middle' | 'back'> = {
  F1: 'front', F2: 'front', F3: 'front',
  M1: 'middle', M2: 'middle', M3: 'middle',
  B1: 'back', B2: 'back', B3: 'back',
};

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Get list of quality incidents
 */
export async function getQualityIncidents(params?: {
  status?: IncidentStatus;
  branch_id?: string;
  shipment_id?: string;
  created_by?: string;
}): Promise<{ incidents: QualityIncident[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.branch_id) queryParams.append('branch_id', params.branch_id);
  if (params?.shipment_id) queryParams.append('shipment_id', params.shipment_id);
  if (params?.created_by) queryParams.append('created_by', params.created_by);
  
  const queryString = queryParams.toString();
  const url = `/quality-incidents${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get(url);
  return response.data;
}

/**
 * Get single quality incident with full details
 */
export async function getQualityIncident(id: string): Promise<{ incident: QualityIncident }> {
  const response = await apiClient.get(`/quality-incidents/${id}`);
  return response.data;
}

/**
 * Create a new quality incident
 */
export async function createQualityIncident(
  data: CreateIncidentData
): Promise<{ success: boolean; message: string; incident: QualityIncident }> {
  const response = await apiClient.post('/quality-incidents', data);
  return response.data;
}

/**
 * Update an existing quality incident
 */
export async function updateQualityIncident(
  id: string,
  data: UpdateIncidentData
): Promise<{ success: boolean; incident: QualityIncident }> {
  const response = await apiClient.put(`/quality-incidents/${id}`, data);
  return response.data;
}

/**
 * Update a sample card
 */
export async function updateSampleCard(
  incidentId: string,
  data: UpdateSampleData
): Promise<{ success: boolean; incident: QualityIncident }> {
  const response = await apiClient.post(`/quality-incidents/${incidentId}/samples`, data);
  return response.data;
}

/**
 * Upload media for an incident
 * @param incidentId - The incident ID
 * @param file - The file to upload
 * @param mediaType - 'photo' or 'video'
 * @param slot - The media slot type
 * @param sampleId - Optional: F, M, B for location-based photos
 */
export async function uploadMedia(
  incidentId: string,
  file: File,
  mediaType: 'photo' | 'video',
  slot: MediaSlot,
  sampleId?: string
): Promise<{ success: boolean; media: { id: string; file_path: string; file_url: string; file_name: string; media_type: string; slot: string; sample_id?: string } }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', mediaType);
  formData.append('slot', slot);
  if (sampleId) formData.append('sample_id', sampleId);
  
  const response = await apiClient.post(`/quality-incidents/${incidentId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

/**
 * Delete media from an incident
 */
export async function deleteMedia(
  incidentId: string,
  mediaId: string
): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`/quality-incidents/${incidentId}/media/${mediaId}`);
  return response.data;
}

/**
 * Submit incident for review
 */
export async function submitIncident(
  id: string
): Promise<{ success: boolean; message: string; incident: QualityIncident }> {
  const response = await apiClient.post(`/quality-incidents/${id}/submit`);
  return response.data;
}

/**
 * Add a review action to an incident
 */
export async function addReviewAction(
  incidentId: string,
  data: ReviewActionData
): Promise<{ success: boolean; message: string; incident: QualityIncident }> {
  const response = await apiClient.post(`/quality-incidents/${incidentId}/review`, data);
  return response.data;
}

/**
 * Get summary statistics for incidents
 */
export async function getIncidentStats(branchId?: string): Promise<IncidentStats> {
  const url = branchId 
    ? `/quality-incidents/stats/summary?branch_id=${branchId}`
    : '/quality-incidents/stats/summary';
  const response = await apiClient.get(url);
  return response.data;
}

