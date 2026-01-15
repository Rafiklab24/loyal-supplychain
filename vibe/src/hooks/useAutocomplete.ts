import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/api';

export interface AutocompleteResult {
  id?: string;
  value: string;
  frequency: number;
  country?: string;
  // Contract-specific fields
  buyer_name?: string;
  seller_name?: string;
  status?: string;
  // Product-specific fields
  sku?: string;
  category_type?: string;
  hs_code?: string;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token'); // Fixed: was 'token', should be 'auth_token'
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchAutocomplete(type: string, query: string): Promise<AutocompleteResult[]> {
  if (!query || query.length < 2) {
    return [];
  }
  
  // Use dedicated products API for products
  if (type === 'product') {
    const response = await fetch(
      `${API_BASE_URL}/products/autocomplete?query=${encodeURIComponent(query)}&limit=10`,
      { headers: getAuthHeaders() }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch product suggestions');
    }
    
    const data = await response.json();
    return data.suggestions || [];
  }
  
  // Use dedicated border crossings API
  if (type === 'borderCrossing') {
    const response = await fetch(
      `${API_BASE_URL}/border-crossings?search=${encodeURIComponent(query)}&is_active=true`,
      { headers: getAuthHeaders() }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch border crossing suggestions');
    }
    
    const data = await response.json();
    // Transform to autocomplete format
    return (data.data || []).map((bc: any) => ({
      id: bc.id,
      value: bc.name,
      country: `${bc.country_from} → ${bc.country_to}`,
      frequency: 1,
    }));
  }
  
  // Use dedicated trademarks API
  if (type === 'trademark') {
    const response = await fetch(
      `${API_BASE_URL}/trademarks?search=${encodeURIComponent(query)}&active_only=true&limit=20`,
      { headers: getAuthHeaders() }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch trademark suggestions');
    }
    
    const data = await response.json();
    // Transform to autocomplete format
    return (data.trademarks || []).map((tm: any) => ({
      id: tm.id,
      value: tm.name,
      name_ar: tm.name_ar,
      frequency: 1,
    }));
  }
  
  // Use shipments autocomplete for other types (ports, shipping lines, suppliers, etc.)
  const response = await fetch(
    `${API_BASE_URL}/shipments/autocomplete?type=${type}&query=${encodeURIComponent(query)}`,
    { headers: getAuthHeaders() }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch autocomplete suggestions');
  }
  
  const data = await response.json();
  return data.suggestions || [];
}

export function useAutocomplete(type: 'product' | 'port' | 'shippingLine' | 'supplier' | 'customer' | 'contract' | 'borderCrossing' | 'trademark', query: string | null | undefined) {
  const safeQuery = query ?? '';
  return useQuery({
    queryKey: ['autocomplete', type, safeQuery],
    queryFn: () => fetchAutocomplete(type, safeQuery),
    enabled: safeQuery.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
