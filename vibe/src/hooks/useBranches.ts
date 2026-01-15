import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

export interface Branch {
  id: string;
  name: string;
  name_ar: string;
  parent_id: string | null;
  branch_type: string;
  country: string | null;
  city: string | null;
  is_active: boolean;
  sort_order: number;
  is_shared?: boolean;
  shared_with_branches?: string[]; // Array of branch IDs that can access this warehouse
  parent_name?: string;
  parent_name_ar?: string;
  full_path?: string;
  full_path_ar?: string;
}

interface BranchesResponse {
  branches: Branch[];
  total: number;
}

export function useBranches(options?: { type?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ['branches', options],
    queryFn: async (): Promise<BranchesResponse> => {
      const params = new URLSearchParams();
      if (options?.type) params.append('type', options.type);
      if (options?.active_only !== undefined) params.append('active_only', String(options.active_only));
      
      const { data } = await apiClient.get(`/branches/warehouses?${params.toString()}`);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useBranch(id: string | undefined) {
  return useQuery({
    queryKey: ['branch', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await apiClient.get(`/branches/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

