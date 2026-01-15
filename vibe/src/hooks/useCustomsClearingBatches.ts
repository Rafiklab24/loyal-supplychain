import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { customsClearingBatchService } from '../services/customsClearingBatchService';
import type {
  CustomsClearingBatch,
  CustomsClearingBatchDetail,
  CustomsClearingBatchSummary,
  CustomsClearingBatchFilters,
} from '../types/api';

/**
 * Hook to fetch list of batches
 */
export function useCustomsClearingBatches(filters?: CustomsClearingBatchFilters) {
  const [data, setData] = useState<CustomsClearingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customsClearingBatchService.getBatches(filters);
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch batches');
      console.error('Error fetching batches:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, pagination, refresh: fetchData };
}

/**
 * Hook to fetch single batch details
 */
export function useCustomsClearingBatch(batchId: string | null) {
  const [data, setData] = useState<CustomsClearingBatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!batchId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await customsClearingBatchService.getBatchDetails(batchId);
      setData(response);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch batch details');
      console.error('Error fetching batch:', err);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

/**
 * Hook to fetch batch summary statistics
 */
export function useCustomsClearingBatchSummary() {
  const [data, setData] = useState<CustomsClearingBatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customsClearingBatchService.getBatchSummary();
      setData(response);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch summary');
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

/**
 * Hook for batch mutations (create, approve, archive, delete)
 */
export function useCustomsClearingBatchMutations() {
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBatch = async (batchNumber: string, costIds: string[], notes?: string) => {
    try {
      setLoading(true);
      setError(null);
      const batch = await customsClearingBatchService.createBatch(batchNumber, costIds, notes);
      return batch;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to create batch';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const approveBatch = async (batchId: string, notes?: string) => {
    try {
      setLoading(true);
      setError(null);
      const batch = await customsClearingBatchService.approveBatch(batchId, notes);
      return batch;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to approve batch';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const archiveBatch = async (batchId: string) => {
    try {
      setLoading(true);
      setError(null);
      const batch = await customsClearingBatchService.archiveBatch(batchId);
      return batch;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to archive batch';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const exportBatch = async (batchId: string, batchNumber: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current language
      const currentLanguage = i18n.language === 'ar' ? 'ar' : 'en';
      
      const blob = await customsClearingBatchService.exportBatch(batchId, currentLanguage);
      
      // Check if blob is valid
      if (!blob || blob.size === 0) {
        throw new Error('Received empty file from server');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `batch_${batchNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      
      // Try to read error message from blob if it's JSON
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const errorData = JSON.parse(text);
          const errorMessage = errorData.details || errorData.error || 'Failed to export batch';
          setError(errorMessage);
          throw new Error(errorMessage);
        } catch (parseError) {
          const errorMessage = 'Failed to export batch';
          setError(errorMessage);
          throw new Error(errorMessage);
        }
      }
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to export batch';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteBatch = async (batchId: string) => {
    try {
      setLoading(true);
      setError(null);
      await customsClearingBatchService.deleteBatch(batchId);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to delete batch';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    createBatch,
    approveBatch,
    archiveBatch,
    exportBatch,
    deleteBatch,
    loading,
    error,
  };
}

