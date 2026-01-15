import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBorderCrossings,
  getBorderCrossing,
  getBorderCrossingsByRoute,
  createBorderCrossing,
  updateBorderCrossing,
  deleteBorderCrossing,
} from '../services/borderCrossings';
import type {
  BorderCrossingsFilters,
  CreateBorderCrossingData,
  UpdateBorderCrossingData,
} from '../services/borderCrossings';

// ============================================================
// QUERY KEYS
// ============================================================

export const borderCrossingsKeys = {
  all: ['borderCrossings'] as const,
  lists: () => [...borderCrossingsKeys.all, 'list'] as const,
  list: (filters?: BorderCrossingsFilters) => [...borderCrossingsKeys.lists(), filters] as const,
  details: () => [...borderCrossingsKeys.all, 'detail'] as const,
  detail: (id: string) => [...borderCrossingsKeys.details(), id] as const,
  byRoute: (countryFrom: string, countryTo: string) => 
    [...borderCrossingsKeys.all, 'byRoute', countryFrom, countryTo] as const,
};

// ============================================================
// HOOKS
// ============================================================

/**
 * Hook to fetch all border crossings with optional filters
 */
export function useBorderCrossings(filters?: BorderCrossingsFilters) {
  return useQuery({
    queryKey: borderCrossingsKeys.list(filters),
    queryFn: () => getBorderCrossings(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes - border crossings don't change often
  });
}

/**
 * Hook to fetch a single border crossing by ID
 */
export function useBorderCrossing(id: string | undefined) {
  return useQuery({
    queryKey: borderCrossingsKeys.detail(id || ''),
    queryFn: () => getBorderCrossing(id!),
    enabled: !!id,
  });
}

/**
 * Hook to fetch border crossings for a specific route
 */
export function useBorderCrossingsByRoute(
  countryFrom: string | undefined,
  countryTo: string | undefined
) {
  return useQuery({
    queryKey: borderCrossingsKeys.byRoute(countryFrom || '', countryTo || ''),
    queryFn: () => getBorderCrossingsByRoute(countryFrom!, countryTo!),
    enabled: !!countryFrom && !!countryTo,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a new border crossing
 */
export function useCreateBorderCrossing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBorderCrossingData) => createBorderCrossing(data),
    onSuccess: () => {
      // Invalidate all border crossing queries
      queryClient.invalidateQueries({ queryKey: borderCrossingsKeys.all });
    },
  });
}

/**
 * Hook to update an existing border crossing
 */
export function useUpdateBorderCrossing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBorderCrossingData }) =>
      updateBorderCrossing(id, data),
    onSuccess: (_, variables) => {
      // Invalidate the specific border crossing and lists
      queryClient.invalidateQueries({ queryKey: borderCrossingsKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: borderCrossingsKeys.lists() });
    },
  });
}

/**
 * Hook to delete/deactivate a border crossing
 */
export function useDeleteBorderCrossing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBorderCrossing(id),
    onSuccess: () => {
      // Invalidate all border crossing queries
      queryClient.invalidateQueries({ queryKey: borderCrossingsKeys.all });
    },
  });
}

