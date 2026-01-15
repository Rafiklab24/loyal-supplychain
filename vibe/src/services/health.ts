import { apiClient } from './api';
import type { HealthResponse, Stats } from '../types/api';

export const healthService = {
  check: async (): Promise<HealthResponse> => {
    const { data } = await apiClient.get('/health');
    return data;
  },

  stats: async (): Promise<Stats> => {
    const { data } = await apiClient.get('/health/stats');
    return data;
  },
};

