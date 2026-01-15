import { useState, useEffect, useCallback } from 'react';
import {
  fetchReadyForDelivery,
  fetchDeliveries,
  fetchDeliveryById,
  createDelivery,
  updateDelivery,
  updateDeliveryStatus,
  deleteDelivery,
  generateReceipt,
  fetchTransportCompanies,
  createTransportCompany,
  updateTransportCompany,
  deleteTransportCompany,
  fetchDestinationSuggestions,
  fetchDeliveryStats,
  fetchOngoingTransports,
} from '../services/landTransportService';
import type {
  OutboundDelivery,
  DeliveryFilters,
  ReadyForDeliveryShipment,
  ReadyForDeliveryFilters,
  TransportCompany,
  TransportCompanyFilters,
  CreateDeliveryInput,
  UpdateDeliveryInput,
  CreateTransportCompanyInput,
  UpdateTransportCompanyInput,
  DeliveryStats,
  DeliveryStatus,
  OngoingTransport,
  OngoingTransportFilters,
  OngoingTransportStats,
} from '../types/api';

// ========== READY FOR DELIVERY HOOK ==========

/**
 * Hook to fetch shipments ready for outbound delivery
 */
export function useReadyForDelivery(filters: ReadyForDeliveryFilters = {}) {
  const [data, setData] = useState<ReadyForDeliveryShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const loadData = useCallback(async (currentFilters: ReadyForDeliveryFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchReadyForDelivery(currentFilters);
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load ready for delivery shipments');
      console.error('Error loading ready for delivery:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [JSON.stringify(filters), loadData]);

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

// ========== DELIVERIES HOOKS ==========

/**
 * Hook to fetch list of outbound deliveries
 */
export function useDeliveries(filters: DeliveryFilters = {}) {
  const [data, setData] = useState<OutboundDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const loadData = useCallback(async (currentFilters: DeliveryFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDeliveries(currentFilters);
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load deliveries');
      console.error('Error loading deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [JSON.stringify(filters), loadData]);

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
 * Hook to fetch single delivery by ID
 */
export function useDelivery(id: string | null) {
  const [data, setData] = useState<OutboundDelivery | null>(null);
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
        const response = await fetchDeliveryById(id);
        setData(response);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load delivery');
        console.error('Error loading delivery:', err);
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
 * Hook for delivery mutations (create, update, delete)
 */
export function useDeliveryMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: CreateDeliveryInput): Promise<OutboundDelivery | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await createDelivery(data);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create delivery';
      setError(errorMessage);
      console.error('Error creating delivery:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, data: UpdateDeliveryInput): Promise<OutboundDelivery | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateDelivery(id, data);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update delivery';
      setError(errorMessage);
      console.error('Error updating delivery:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(async (id: string, status: DeliveryStatus): Promise<OutboundDelivery | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateDeliveryStatus(id, status);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update delivery status';
      setError(errorMessage);
      console.error('Error updating delivery status:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteDelivery(id);
      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete delivery';
      setError(errorMessage);
      console.error('Error deleting delivery:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const genReceipt = useCallback(async (id: string): Promise<OutboundDelivery | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateReceipt(id);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to generate receipt';
      setError(errorMessage);
      console.error('Error generating receipt:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    create,
    update,
    updateStatus,
    remove,
    generateReceipt: genReceipt,
  };
}

// ========== TRANSPORT COMPANIES HOOKS ==========

/**
 * Hook to fetch list of transport companies
 */
export function useTransportCompanies(filters: TransportCompanyFilters = {}) {
  const [data, setData] = useState<TransportCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const loadData = useCallback(async (currentFilters: TransportCompanyFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTransportCompanies(currentFilters);
      setData(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load transport companies');
      console.error('Error loading transport companies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [JSON.stringify(filters), loadData]);

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
 * Hook for transport company mutations (create, update, delete)
 */
export function useTransportCompanyMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: CreateTransportCompanyInput): Promise<TransportCompany | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await createTransportCompany(data);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create transport company';
      setError(errorMessage);
      console.error('Error creating transport company:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, data: UpdateTransportCompanyInput): Promise<TransportCompany | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateTransportCompany(id, data);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update transport company';
      setError(errorMessage);
      console.error('Error updating transport company:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteTransportCompany(id);
      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete transport company';
      setError(errorMessage);
      console.error('Error deleting transport company:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    create,
    update,
    remove,
  };
}

// ========== ONGOING TRANSPORTS BOARD HOOK ==========

/**
 * Hook to fetch ongoing internal transports for the board view
 * Returns deliveries with status: pending, in_transit
 */
export function useOngoingTransports(filters: OngoingTransportFilters = {}) {
  const [data, setData] = useState<OngoingTransport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [stats, setStats] = useState<OngoingTransportStats>({
    pending_count: 0,
    in_transit_count: 0,
    total_ongoing: 0,
  });

  const loadData = useCallback(async (currentFilters: OngoingTransportFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchOngoingTransports(currentFilters);
      setData(response.data);
      setPagination(response.pagination);
      setStats(response.stats);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load ongoing transports');
      console.error('Error loading ongoing transports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [JSON.stringify(filters), loadData]);

  const refresh = useCallback(() => {
    loadData(filters);
  }, [filters, loadData]);

  return {
    data,
    loading,
    error,
    pagination,
    stats,
    refresh,
  };
}

// ========== UTILITY HOOKS ==========

/**
 * Hook to fetch destination suggestions
 */
export function useDestinationSuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDestinationSuggestions();
      setSuggestions(response.suggestions);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load suggestions');
      console.error('Error loading destination suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  return {
    suggestions,
    loading,
    error,
    refresh: loadSuggestions,
  };
}

/**
 * Hook to fetch delivery statistics
 */
export function useDeliveryStats() {
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDeliveryStats();
      setStats(response);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load stats');
      console.error('Error loading delivery stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refresh: loadStats,
  };
}

