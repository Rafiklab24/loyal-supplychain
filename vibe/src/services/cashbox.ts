import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Get auth header
function getAuthHeader() {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ============================================
// Types
// ============================================

export interface CashBox {
  id: string;
  name: string;
  name_ar?: string | null;
  currency_code: 'USD' | 'EUR' | 'TRY';
  opening_balance: number;
  opening_date?: string | null;
  is_active: boolean;
  total_in: number;
  total_out: number;
  current_balance: number;
  transaction_count: number;
  last_transaction_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashBoxTransaction {
  id: string;
  cash_box_id: string;
  cash_box_name: string;
  cash_box_name_ar?: string | null;
  currency_code: string;
  transaction_type: 'in' | 'out' | 'transfer_in' | 'transfer_out';
  amount: number;
  running_balance: number;
  party_name?: string | null;
  description?: string | null;
  reference_type?: 'shipment' | 'contract' | 'invoice' | null;
  reference_id?: string | null;
  reference_label?: string | null;
  transfer_pair_id?: string | null;
  recorded_by: string;
  recorded_by_name?: string | null;
  transaction_date: string;
  created_at: string;
}

export interface RecordTransactionInput {
  cash_box_id: string;
  transaction_type: 'in' | 'out';
  amount: number;
  party_name: string;
  description?: string;
  reference_type?: 'shipment' | 'contract' | 'invoice' | null;
  reference_id?: string | null;
  transaction_date?: string;
}

export interface TransferInput {
  from_cash_box_id: string;
  to_cash_box_id: string;
  from_amount: number;
  to_amount: number;
  description?: string;
  transaction_date?: string;
}

export interface OpeningBalanceInput {
  opening_balance: number;
  opening_date?: string;
}

export interface TransactionFilters {
  cash_box_id?: string;
  transaction_type?: 'in' | 'out' | 'transfer_in' | 'transfer_out';
  from_date?: string;
  to_date?: string;
  party_name?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  transactions: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface CashBoxListResponse {
  cash_boxes: CashBox[];
}

export interface CashBoxDetailResponse {
  cash_box: CashBox;
  recent_transactions: CashBoxTransaction[];
}

export interface RecordTransactionResponse {
  message: string;
  transaction: CashBoxTransaction;
  new_balance: number;
}

export interface TransferResponse {
  message: string;
  transfer_pair_id: string;
  from_transaction: CashBoxTransaction;
  to_transaction: CashBoxTransaction;
  from_new_balance: number;
  to_new_balance: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Fetch all cash boxes with current balances
 */
export async function getCashBoxes(): Promise<CashBox[]> {
  const response = await axios.get<CashBoxListResponse>(
    `${API_BASE_URL}/cashbox`,
    { headers: getAuthHeader() }
  );
  return response.data.cash_boxes;
}

/**
 * Fetch a single cash box with recent transactions
 */
export async function getCashBox(id: string): Promise<CashBoxDetailResponse> {
  const response = await axios.get<CashBoxDetailResponse>(
    `${API_BASE_URL}/cashbox/${id}`,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * Fetch transactions for a cash box with filters
 */
export async function getCashBoxTransactions(
  cashBoxId: string,
  filters?: Omit<TransactionFilters, 'cash_box_id'>
): Promise<PaginatedResponse<CashBoxTransaction>> {
  const params = new URLSearchParams();
  if (filters?.transaction_type) params.append('transaction_type', filters.transaction_type);
  if (filters?.from_date) params.append('from_date', filters.from_date);
  if (filters?.to_date) params.append('to_date', filters.to_date);
  if (filters?.party_name) params.append('party_name', filters.party_name);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const response = await axios.get<PaginatedResponse<CashBoxTransaction>>(
    `${API_BASE_URL}/cashbox/${cashBoxId}/transactions?${params.toString()}`,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * Fetch all transactions with filters
 */
export async function getAllTransactions(
  filters?: TransactionFilters
): Promise<PaginatedResponse<CashBoxTransaction>> {
  const params = new URLSearchParams();
  if (filters?.cash_box_id) params.append('cash_box_id', filters.cash_box_id);
  if (filters?.transaction_type) params.append('transaction_type', filters.transaction_type);
  if (filters?.from_date) params.append('from_date', filters.from_date);
  if (filters?.to_date) params.append('to_date', filters.to_date);
  if (filters?.party_name) params.append('party_name', filters.party_name);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const response = await axios.get<PaginatedResponse<CashBoxTransaction>>(
    `${API_BASE_URL}/cashbox/transactions?${params.toString()}`,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * Record an IN or OUT transaction
 */
export async function recordTransaction(
  input: RecordTransactionInput
): Promise<RecordTransactionResponse> {
  const response = await axios.post<RecordTransactionResponse>(
    `${API_BASE_URL}/cashbox/transaction`,
    input,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * Transfer between cash boxes
 */
export async function transfer(input: TransferInput): Promise<TransferResponse> {
  const response = await axios.post<TransferResponse>(
    `${API_BASE_URL}/cashbox/transfer`,
    input,
    { headers: getAuthHeader() }
  );
  return response.data;
}

/**
 * Update opening balance (Admin only)
 */
export async function updateOpeningBalance(
  cashBoxId: string,
  input: OpeningBalanceInput
): Promise<{ message: string; cash_box: CashBox }> {
  const response = await axios.put(
    `${API_BASE_URL}/cashbox/${cashBoxId}/opening-balance`,
    input,
    { headers: getAuthHeader() }
  );
  return response.data;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get currency symbol for display
 */
export function getCurrencySymbol(currencyCode: string): string {
  switch (currencyCode) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'TRY': return '₺';
    default: return currencyCode;
  }
}

/**
 * Format amount with currency
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  // Put symbol after for TRY (common Turkish convention)
  if (currencyCode === 'TRY') {
    return `${formatted} ${symbol}`;
  }
  return `${symbol}${formatted}`;
}

/**
 * Get transaction type label
 */
export function getTransactionTypeLabel(type: string, lang: 'en' | 'ar' = 'en'): string {
  const labels: Record<string, { en: string; ar: string }> = {
    in: { en: 'Deposit', ar: 'إيداع' },
    out: { en: 'Withdrawal', ar: 'سحب' },
    transfer_in: { en: 'Transfer In', ar: 'تحويل وارد' },
    transfer_out: { en: 'Transfer Out', ar: 'تحويل صادر' },
  };
  return labels[type]?.[lang] || type;
}

/**
 * Get transaction type color class
 */
export function getTransactionTypeColor(type: string): string {
  switch (type) {
    case 'in':
    case 'transfer_in':
      return 'text-green-600 bg-green-50';
    case 'out':
    case 'transfer_out':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

