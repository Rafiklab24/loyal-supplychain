/**
 * API Configuration
 * Provides dynamic API base URL that works both locally and on network
 */

export const getApiBaseUrl = (): string => {
  // Use environment variable if set
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  const { protocol, hostname } = window.location;
  
  // If accessed via ngrok or other tunnel services, use relative URL (Vite proxy)
  if (hostname.includes('ngrok') || hostname.includes('tunnel') || hostname.includes('.app')) {
    return '/api';
  }
  
  // For local/network development, derive from current host
  // This allows colleagues on the same network to access the API
  return `${protocol}//${hostname}:3000/api`;
};

export const API_BASE_URL = getApiBaseUrl();

