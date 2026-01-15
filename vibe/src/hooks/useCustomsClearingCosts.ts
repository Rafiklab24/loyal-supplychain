import { useState, useEffect, useCallback } from 'react';
import {
  fetchCustomsClearingCosts,
  fetchCustomsClearingCostById,
  createCustomsClearingCost,
  updateCustomsClearingCost,
  deleteCustomsClearingCost,
  fetchCustomsClearingCostsSummary,
  exportAndDownloadCustomsClearingCosts,
  fetchPendingClearances,
  createCostFromPending,
  searchShipmentsForLinking,
  type ShipmentSearchResult,
} from '../services/customsClearingCostsService';
import type {
  CustomsClearingCost,
  CustomsClearingCostFilters,
  CustomsClearingCostSummary,
  PendingClearanceShipment,
  PendingClearanceFilters,
  CreateCostFromPendingInput,
} from '../types/api';

/**
 * Hook to fetch list of customs clearing costs
 */
export function useCustomsClearingCosts(filters: CustomsClearingCostFilters = {}) {
  const [data, setData] = useState<CustomsClearingCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const loadData = useCallback(async (currentFilters: CustomsClearingCostFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomsClearingCosts(currentFilters);
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load customs clearing costs');
      console.error('Error loading customs clearing costs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [filters, loadData]);

  const refresh = useCallback(() => {
    loadData(filters);
  }, [filters, loadData]);

  return {
    data,
    loading,
    error,
    pagination,
    refresh,
  };
}

/**
 * Hook to fetch single customs clearing cost by ID
 */
export function useCustomsClearingCost(id: string | null) {
  const [data, setData] = useState<CustomsClearingCost | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchCustomsClearingCostById(id);
        setData(response);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load customs clearing cost');
        console.error('Error loading customs clearing cost:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  return {
    data,
    loading,
    error,
  };
}

/**
 * Hook for CRUD operations
 */
export function useCustomsClearingCostMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: Partial<CustomsClearingCost>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await createCustomsClearingCost(data);
      return result;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create customs clearing cost';
      setError(errorMsg);
      console.error('Error creating customs clearing cost:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, data: Partial<CustomsClearingCost>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateCustomsClearingCost(id, data);
      return result;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to update customs clearing cost';
      setError(errorMsg);
      console.error('Error updating customs clearing cost:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteCustomsClearingCost(id);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to delete customs clearing cost';
      setError(errorMsg);
      console.error('Error deleting customs clearing cost:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    create,
    update,
    remove,
    loading,
    error,
  };
}

/**
 * Hook to fetch summary statistics
 */
export function useCustomsClearingCostsSummary() {
  const [data, setData] = useState<CustomsClearingCostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomsClearingCostsSummary();
      setData(response);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load summary');
      console.error('Error loading summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh: loadData,
  };
}

/**
 * Hook for Excel export
 */
export function useCustomsClearingCostsExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = useCallback(async (filters: Omit<CustomsClearingCostFilters, 'page' | 'limit'> = {}) => {
    setLoading(true);
    setError(null);
    try {
      await exportAndDownloadCustomsClearingCosts(filters);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to export data';
      setError(errorMsg);
      console.error('Error exporting customs clearing costs:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    exportData,
    loading,
    error,
  };
}

/**
 * Hook to fetch pending clearances (shipments with clearance date but no cost entry)
 */
export function usePendingClearances(filters: PendingClearanceFilters = {}) {
  const [data, setData] = useState<PendingClearanceShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const loadData = useCallback(async (currentFilters: PendingClearanceFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPendingClearances(currentFilters);
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load pending clearances');
      console.error('Error loading pending clearances:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [filters, loadData]);

  const refresh = useCallback(() => {
    loadData(filters);
  }, [filters, loadData]);

  return {
    data,
    loading,
    error,
    pagination,
    refresh,
  };
}

/**
 * Hook to create cost from pending shipment
 */
export function useCreateCostFromPending() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFromPending = useCallback(async (data: CreateCostFromPendingInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await createCostFromPending(data);
      return result;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create cost from pending shipment';
      setError(errorMsg);
      console.error('Error creating cost from pending:', err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createFromPending,
    loading,
    error,
  };
}

/**
 * Hook to search shipments for linking to customs clearing costs
 */
export function useSearchShipments() {
  const [data, setData] = useState<ShipmentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await searchShipmentsForLinking(query);
      setData(response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to search shipments';
      setError(errorMsg);
      console.error('Error searching shipments:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setData([]);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    search,
    clearResults,
  };
}

// Re-export the ShipmentSearchResult type for use in components
export type { ShipmentSearchResult };

