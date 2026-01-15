import { apiClient } from './api';
import type {
  CustomsClearingBatch,
  CustomsClearingBatchDetail,
  CustomsClearingBatchSummary,
  CustomsClearingBatchFilters,
  CustomsClearingBatchesResponse,
} from '../types/api';

export const customsClearingBatchService = {
  /**
   * Create a new batch from selected customs clearing cost entries
   */
  async createBatch(
    batchNumber: string,
    costIds: string[],
    notes?: string
  ): Promise<CustomsClearingBatch> {
    const response = await apiClient.post<CustomsClearingBatch>('/customs-clearing-batches', {
      batch_number: batchNumber,
      customs_cost_ids: costIds,
      notes,
    });
    return response.data;
  },

  /**
   * Get list of batches with filters
   */
  async getBatches(filters?: CustomsClearingBatchFilters): Promise<CustomsClearingBatchesResponse> {
    const response = await apiClient.get<CustomsClearingBatchesResponse>('/customs-clearing-batches', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get batch summary statistics
   */
  async getBatchSummary(): Promise<CustomsClearingBatchSummary> {
    const response = await apiClient.get<CustomsClearingBatchSummary>('/customs-clearing-batches/summary');
    return response.data;
  },

  /**
   * Get single batch details with all items
   */
  async getBatchDetails(batchId: string): Promise<CustomsClearingBatchDetail> {
    const response = await apiClient.get<CustomsClearingBatchDetail>(`/customs-clearing-batches/${batchId}`);
    return response.data;
  },

  /**
   * Approve a batch (Accountant action)
   */
  async approveBatch(batchId: string, notes?: string): Promise<CustomsClearingBatch> {
    const response = await apiClient.put<CustomsClearingBatch>(
      `/customs-clearing-batches/${batchId}/approve`,
      { notes }
    );
    return response.data;
  },

  /**
   * Archive an approved batch
   */
  async archiveBatch(batchId: string): Promise<CustomsClearingBatch> {
    const response = await apiClient.put<CustomsClearingBatch>(
      `/customs-clearing-batches/${batchId}/archive`
    );
    return response.data;
  },

  /**
   * Export batch to Excel
   */
  async exportBatch(batchId: string, language: string = 'en'): Promise<Blob> {
    const response = await apiClient.get(`/customs-clearing-batches/${batchId}/export`, {
      params: { lang: language },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Delete a pending batch
   */
  async deleteBatch(batchId: string): Promise<void> {
    await apiClient.delete(`/customs-clearing-batches/${batchId}`);
  },
};

