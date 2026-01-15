/**
 * Finance API Service
 * Handles all API calls related to financial transactions, funds, and parties
 */

import { apiClient } from './api';
import type {
  FinancialTransaction,
  Fund,
  FinancialParty,
  PartySearchResult,
  TransactionsResponse,
  FinanceSummaryResponse,
  ContractSearchResult,
  ShipmentSearchResult,
} from '../types/api';

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  direction?: 'in' | 'out';
  fund?: string;
  party?: string;
  contract_id?: string;
  shipment_id?: string;
  transaction_type?: string;
  page?: number;
  limit?: number;
}

export interface TransactionCreateInput extends CreateTransactionData {}

export interface CreateTransactionData {
  transaction_date: string;
  amount_usd: number;
  amount_other?: number;
  currency?: string;
  transaction_type: string;
  direction: 'in' | 'out';
  fund_source: string;
  party_name: string;
  description: string;
  contract_id?: string;
  shipment_id?: string;
  company_id?: string;
}

// Re-export for backwards compatibility
export type Transaction = FinancialTransaction;
export interface FinanceStats {
  totalIn: number;
  totalOut: number;
  balance: number;
  transactionCount: number;
}

class FinanceService {
  // ========== Transactions ==========

  async getTransactions(filters: TransactionFilters = {}): Promise<TransactionsResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await apiClient.get(`/finance/transactions?${params.toString()}`);
    return response.data;
  }

  async getTransaction(id: string): Promise<FinancialTransaction> {
    const response = await apiClient.get(`/finance/transactions/${id}`);
    return response.data;
  }

  async createTransaction(data: CreateTransactionData): Promise<FinancialTransaction> {
    const response = await apiClient.post('/finance/transactions', data);
    return response.data;
  }

  async updateTransaction(id: string, data: Partial<CreateTransactionData>): Promise<FinancialTransaction> {
    const response = await apiClient.put(`/finance/transactions/${id}`, data);
    return response.data;
  }

  async deleteTransaction(id: string): Promise<void> {
    await apiClient.delete(`/finance/transactions/${id}`);
  }

  async bulkDeleteTransactions(ids: string[]): Promise<void> {
    await apiClient.post('/finance/transactions/bulk-delete', { ids });
  }

  async bulkArchiveTransactions(ids: string[]): Promise<void> {
    await apiClient.post('/finance/transactions/bulk-archive', { ids });
  }

  // ========== Funds ==========

  async getFunds(): Promise<Fund[]> {
    const response = await apiClient.get('/finance/funds');
    return response.data;
  }

  async createFund(data: { name: string; type: 'bank' | 'cash_fund' | 'exchange'; currency?: string }): Promise<Fund> {
    const response = await apiClient.post('/finance/funds', data);
    return response.data;
  }

  async getFundBalance(id: string): Promise<Fund> {
    const response = await apiClient.get(`/finance/funds/${id}/balance`);
    return response.data;
  }

  // ========== Parties ==========

  async getParties(): Promise<FinancialParty[]> {
    const response = await apiClient.get('/finance/parties');
    return response.data;
  }

  async createParty(data: { name: string; type?: string }): Promise<FinancialParty> {
    const response = await apiClient.post('/finance/parties', data);
    return response.data;
  }

  async searchParties(query: string): Promise<PartySearchResult[]> {
    if (!query || query.trim() === '') {
      return [];
    }
    const response = await apiClient.get(`/finance/parties/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  // ========== Summary & Statistics ==========

  async getSummary(filters?: { dateFrom?: string; dateTo?: string }): Promise<FinanceSummaryResponse> {
    const params = new URLSearchParams();
    
    if (filters?.dateFrom) {
      params.append('dateFrom', filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.append('dateTo', filters.dateTo);
    }

    const response = await apiClient.get(`/finance/summary?${params.toString()}`);
    return response.data;
  }

  async getTopUsed(limit: number = 4): Promise<{ topFunds: string[]; topParties: string[] }> {
    const response = await apiClient.get(`/finance/top-used?limit=${limit}`);
    return response.data;
  }

  // ========== Contracts ==========

  async searchContracts(query: string = '', limit: number = 10): Promise<ContractSearchResult[]> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    params.append('limit', limit.toString());
    
    const response = await apiClient.get(`/finance/contracts/search?${params.toString()}`);
    return response.data;
  }

  async getRecentContracts(limit: number = 5): Promise<ContractSearchResult[]> {
    const response = await apiClient.get(`/finance/contracts/recent?limit=${limit}`);
    return response.data;
  }

  // ========== Shipments ==========

  async searchShipments(query: string = '', limit: number = 10): Promise<ShipmentSearchResult[]> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    params.append('limit', limit.toString());
    
    const response = await apiClient.get(`/finance/shipments/search?${params.toString()}`);
    return response.data;
  }

  async getRecentShipments(limit: number = 5): Promise<ShipmentSearchResult[]> {
    const response = await apiClient.get(`/finance/shipments/recent?limit=${limit}`);
    return response.data;
  }
}

export const financeService = new FinanceService();
export default financeService;
