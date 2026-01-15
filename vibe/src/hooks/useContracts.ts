/**
 * React Hook for Contracts
 * Uses TanStack Query for state management and caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import contractsService from '../services/contracts';
import type { 
  Contract,
  ContractFilters, 
  ContractCreateInput,
  ContractListResponse 
} from '../services/contracts';

// ========== QUERY KEYS ==========

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (filters: ContractFilters) => [...contractKeys.lists(), filters] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractKeys.details(), id] as const,
  lines: (contractId: string) => [...contractKeys.detail(contractId), 'lines'] as const,
  paymentSchedules: (contractId: string) => [...contractKeys.detail(contractId), 'payment-schedules'] as const,
};

// ========== HOOKS ==========

/**
 * Hook to fetch contracts list
 */
export function useContracts(filters: ContractFilters = {}) {
  return useQuery<ContractListResponse, Error>({
    queryKey: contractKeys.list(filters),
    queryFn: () => contractsService.getContracts(filters),
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

/**
 * Hook to fetch single contract
 */
export function useContract(id: string) {
  return useQuery<Contract, Error>({
    queryKey: contractKeys.detail(id),
    queryFn: () => contractsService.getContract(id),
    enabled: !!id,
    staleTime: 60000, // Consider data fresh for 1 minute
  });
}

/**
 * Hook to fetch contract lines
 */
export function useContractLines(contractId: string) {
  return useQuery({
    queryKey: contractKeys.lines(contractId),
    queryFn: () => contractsService.getContractLines(contractId),
    enabled: !!contractId,
    staleTime: 60000,
  });
}

/**
 * Hook to fetch payment schedules
 */
export function usePaymentSchedules(contractId: string) {
  return useQuery({
    queryKey: contractKeys.paymentSchedules(contractId),
    queryFn: () => contractsService.getPaymentSchedules(contractId),
    enabled: !!contractId,
    staleTime: 60000,
  });
}

/**
 * Hook to create contract
 */
export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ContractCreateInput) => contractsService.createContract(data),
    onSuccess: () => {
      // Invalidate all contract lists to trigger refetch
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Hook to update contract
 */
export function useUpdateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContractCreateInput> }) => 
      contractsService.updateContract(id, data),
    onSuccess: (_, variables) => {
      // Invalidate the specific contract and all lists
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Hook to add payment schedule
 */
export function useAddPaymentSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contractId, data }: { 
      contractId: string; 
      data: {
        seq: number;
        basis: string;
        days_after?: number;
        percent?: number;
        amount?: number;
        is_deferred?: boolean;
        notes?: string;
      }
    }) => contractsService.addPaymentSchedule(contractId, data),
    onSuccess: (_, variables) => {
      // Invalidate payment schedules and contract detail
      queryClient.invalidateQueries({ queryKey: contractKeys.paymentSchedules(variables.contractId) });
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(variables.contractId) });
    },
  });
}

