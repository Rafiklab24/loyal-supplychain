import { apiClient } from './api';
import type { Company, PaginatedResponse, CompanyBankingInfo } from '../types/api';

export const companiesService = {
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Company>> => {
    const { data } = await apiClient.get('/companies', { params });
    return data;
  },

  getById: async (id: string): Promise<Company> => {
    const { data } = await apiClient.get(`/companies/${id}`);
    return data;
  },

  getSuppliers: async (params?: { 
    page?: number; 
    limit?: number;
  }): Promise<PaginatedResponse<Company>> => {
    const { data } = await apiClient.get('/companies/type/suppliers', { params });
    return data;
  },

  getShippingLines: async (params?: { 
    page?: number; 
    limit?: number; 
  }): Promise<PaginatedResponse<Company>> => {
    const { data } = await apiClient.get('/companies/type/shipping-lines', { params });
    return data;
  },

  updateBankingInfo: async (id: string, bankingInfo: CompanyBankingInfo, productCategories?: string[]): Promise<Company> => {
    const { data } = await apiClient.patch(`/companies/${id}/banking`, { 
      banking: bankingInfo,
      product_categories: productCategories 
    });
    return data;
  },
};

