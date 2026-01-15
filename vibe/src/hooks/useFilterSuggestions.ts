import { useQuery } from '@tanstack/react-query';

import { API_BASE_URL } from '../config/api';

interface FilterSuggestion {
  name: string;
  count: number;
}

interface FilterSuggestions {
  topOrigins: FilterSuggestion[];
  topDestinations: FilterSuggestion[];
  topProducts: FilterSuggestion[];
  shippingLines: FilterSuggestion[];
}

interface ActiveFilters {
  origin?: string | null;
  destination?: string | null;
  product?: string | null;
  shippingLine?: string | null;
  valueRange?: string | null;
  dateRange?: string | null;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchFilterSuggestions(filters: ActiveFilters): Promise<FilterSuggestions> {
  const params = new URLSearchParams();
  
  if (filters.origin) params.append('origin', filters.origin);
  if (filters.destination) params.append('destination', filters.destination);
  if (filters.product) params.append('product', filters.product);
  if (filters.shippingLine) params.append('shippingLine', filters.shippingLine);
  if (filters.valueRange) params.append('valueRange', filters.valueRange);
  if (filters.dateRange) params.append('dateRange', filters.dateRange);
  
  const queryString = params.toString();
  const url = `${API_BASE_URL}/shipments/suggestions${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error('Failed to fetch filter suggestions');
  }
  return response.json();
}

export function useFilterSuggestions(filters: ActiveFilters = {}) {
  return useQuery({
    queryKey: ['filterSuggestions', filters],
    queryFn: () => fetchFilterSuggestions(filters),
    staleTime: 30 * 1000, // 30 seconds (shorter for dynamic updates)
  });
}
