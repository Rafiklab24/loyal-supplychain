import { useQuery } from '@tanstack/react-query';
import { companiesService } from '../services/companies';

export function useCompanies(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: ['companies', params],
    queryFn: () => companiesService.list(params),
  });
}

export function useSuppliers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['suppliers', params],
    queryFn: () => companiesService.getSuppliers(params),
  });
}

export function useShippingLines(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['shipping-lines', params],
    queryFn: () => companiesService.getShippingLines(params),
  });
}

