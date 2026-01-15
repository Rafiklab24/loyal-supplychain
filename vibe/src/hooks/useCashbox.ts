import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as cashboxService from '../services/cashbox';
import type {
  CashBox,
  CashBoxTransaction,
  RecordTransactionInput,
  TransferInput,
  OpeningBalanceInput,
  TransactionFilters,
  PaginatedResponse,
  CashBoxDetailResponse,
} from '../services/cashbox';

// Query keys
const QUERY_KEYS = {
  cashBoxes: ['cashBoxes'] as const,
  cashBox: (id: string) => ['cashBox', id] as const,
  cashBoxTransactions: (id: string) => ['cashBoxTransactions', id] as const,
  allTransactions: ['allTransactions'] as const,
};

/**
 * Fetch all cash boxes with current balances
 */
export function useCashBoxes() {
  return useQuery<CashBox[], Error>({
    queryKey: QUERY_KEYS.cashBoxes,
    queryFn: cashboxService.getCashBoxes,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch a single cash box with recent transactions
 */
export function useCashBox(id: string | undefined) {
  return useQuery<CashBoxDetailResponse, Error>({
    queryKey: QUERY_KEYS.cashBox(id || ''),
    queryFn: () => cashboxService.getCashBox(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch transactions for a cash box with filters
 */
export function useCashBoxTransactions(
  cashBoxId: string | undefined,
  filters?: Omit<TransactionFilters, 'cash_box_id'>
) {
  return useQuery<PaginatedResponse<CashBoxTransaction>, Error>({
    queryKey: [...QUERY_KEYS.cashBoxTransactions(cashBoxId || ''), filters],
    queryFn: () => cashboxService.getCashBoxTransactions(cashBoxId!, filters),
    enabled: !!cashBoxId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch all transactions with filters
 */
export function useAllTransactions(filters?: TransactionFilters) {
  return useQuery<PaginatedResponse<CashBoxTransaction>, Error>({
    queryKey: [...QUERY_KEYS.allTransactions, filters],
    queryFn: () => cashboxService.getAllTransactions(filters),
    staleTime: 30 * 1000,
  });
}

/**
 * Record an IN or OUT transaction
 */
export function useRecordTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordTransactionInput) =>
      cashboxService.recordTransaction(input),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBoxes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBox(variables.cash_box_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBoxTransactions(variables.cash_box_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allTransactions });
    },
  });
}

/**
 * Transfer between cash boxes
 */
export function useTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransferInput) => cashboxService.transfer(input),
    onSuccess: (data, variables) => {
      // Invalidate related queries for both boxes
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBoxes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBox(variables.from_cash_box_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBox(variables.to_cash_box_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBoxTransactions(variables.from_cash_box_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBoxTransactions(variables.to_cash_box_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allTransactions });
    },
  });
}

/**
 * Update opening balance (Admin only)
 */
export function useUpdateOpeningBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cashBoxId, input }: { cashBoxId: string; input: OpeningBalanceInput }) =>
      cashboxService.updateOpeningBalance(cashBoxId, input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBoxes });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashBox(variables.cashBoxId) });
    },
  });
}

// Re-export types
export type {
  CashBox,
  CashBoxTransaction,
  RecordTransactionInput,
  TransferInput,
  OpeningBalanceInput,
  TransactionFilters,
};

// Re-export helper functions
export {
  getCurrencySymbol,
  formatCurrency,
  getTransactionTypeLabel,
  getTransactionTypeColor,
} from '../services/cashbox';

