/**
 * API Client Configuration
 * 
 * ⚠️  IMPORTANT: Always use `apiClient` instead of raw `axios` for API calls!
 * 
 * The apiClient automatically:
 * - Adds the Authorization header with the JWT token
 * - Handles 401 errors by redirecting to login
 * - Uses the correct base URL
 * 
 * Usage:
 *   import { apiClient } from '../services/api';
 *   const response = await apiClient.get('/endpoint');
 *   const response = await apiClient.post('/endpoint', data);
 * 
 * The ONLY exception is the login endpoint in AuthContext.tsx,
 * which must use raw axios since no token exists yet.
 */
import axios from 'axios';

import { API_BASE_URL } from '../config/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_name');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

