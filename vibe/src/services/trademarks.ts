/**
 * Trademarks Service
 * Frontend API client for managing product trademarks
 */

import { API_BASE_URL as API_BASE } from '../config/api';

export interface Trademark {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  logo_path?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  already_existed?: boolean; // Set when POST returns existing instead of creating
}

export interface TrademarksResponse {
  trademarks: Trademark[];
  total: number;
}

/**
 * Get all trademarks with optional search
 */
export async function getTrademarks(params?: { 
  search?: string; 
  active_only?: boolean;
  limit?: number;
}): Promise<TrademarksResponse> {
  const token = localStorage.getItem('token');
  const queryParams = new URLSearchParams();
  
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  if (params?.active_only !== undefined) {
    queryParams.append('active_only', String(params.active_only));
  }
  if (params?.limit) {
    queryParams.append('limit', String(params.limit));
  }
  
  const url = `${API_BASE}/trademarks${queryParams.toString() ? `?${queryParams}` : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch trademarks');
  }
  
  return response.json();
}

/**
 * Get single trademark by ID
 */
export async function getTrademark(id: string): Promise<Trademark> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}/trademarks/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch trademark');
  }
  
  return response.json();
}

/**
 * Create new trademark (or return existing if name matches)
 */
export async function createTrademark(data: { 
  name: string; 
  name_ar?: string;
  description?: string;
}): Promise<Trademark> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}/trademarks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create trademark');
  }
  
  return response.json();
}

/**
 * Update trademark
 */
export async function updateTrademark(id: string, data: { 
  name: string; 
  name_ar?: string;
  description?: string;
  is_active?: boolean;
}): Promise<Trademark> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}/trademarks/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update trademark');
  }
  
  return response.json();
}

/**
 * Delete (deactivate) trademark
 */
export async function deleteTrademark(id: string): Promise<void> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}/trademarks/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete trademark');
  }
}

