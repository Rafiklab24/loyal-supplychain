import { apiClient } from './api';
import type {
  OutboundDelivery,
  DeliveryFilters,
  DeliveriesResponse,
  ReadyForDeliveryFilters,
  ReadyForDeliveryResponse,
  TransportCompany,
  TransportCompanyFilters,
  TransportCompaniesResponse,
  CreateDeliveryInput,
  UpdateDeliveryInput,
  CreateTransportCompanyInput,
  UpdateTransportCompanyInput,
  DeliveryStats,
  DeliveryStatus,
  OngoingTransportFilters,
  OngoingTransportResponse,
} from '../types/api';

const BASE_URL = '/v1/land-transport';

/**
 * Land Transport API Service
 * Handles outbound deliveries and transport company management
 */

// ========== READY FOR DELIVERY ==========

/**
 * Fetch shipments that are cleared and ready for outbound delivery
 */
export async function fetchReadyForDelivery(
  filters: ReadyForDeliveryFilters = {}
): Promise<ReadyForDeliveryResponse> {
  const response = await apiClient.get(`${BASE_URL}/ready-for-delivery`, { params: filters });
  return response.data;
}

// ========== DELIVERIES ==========

/**
 * Fetch list of outbound deliveries with filters
 */
export async function fetchDeliveries(
  filters: DeliveryFilters = {}
): Promise<DeliveriesResponse> {
  const response = await apiClient.get(`${BASE_URL}/deliveries`, { params: filters });
  return response.data;
}

/**
 * Fetch single delivery by ID
 */
export async function fetchDeliveryById(id: string): Promise<OutboundDelivery> {
  const response = await apiClient.get(`${BASE_URL}/deliveries/${id}`);
  return response.data;
}

/**
 * Create new outbound delivery
 */
export async function createDelivery(
  data: CreateDeliveryInput
): Promise<OutboundDelivery> {
  const response = await apiClient.post(`${BASE_URL}/deliveries`, data);
  return response.data;
}

/**
 * Update existing delivery
 */
export async function updateDelivery(
  id: string,
  data: UpdateDeliveryInput
): Promise<OutboundDelivery> {
  const response = await apiClient.put(`${BASE_URL}/deliveries/${id}`, data);
  return response.data;
}

/**
 * Update delivery status only
 */
export async function updateDeliveryStatus(
  id: string,
  status: DeliveryStatus
): Promise<OutboundDelivery> {
  const response = await apiClient.patch(`${BASE_URL}/deliveries/${id}/status`, { status });
  return response.data;
}

/**
 * Delete (soft delete) delivery
 */
export async function deleteDelivery(id: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/deliveries/${id}`);
}

/**
 * Generate receipt for a delivery
 */
export async function generateReceipt(id: string): Promise<OutboundDelivery> {
  const response = await apiClient.post(`${BASE_URL}/deliveries/${id}/generate-receipt`);
  return response.data;
}

// ========== TRANSPORT COMPANIES ==========

/**
 * Fetch list of transport companies with filters
 */
export async function fetchTransportCompanies(
  filters: TransportCompanyFilters = {}
): Promise<TransportCompaniesResponse> {
  const response = await apiClient.get(`${BASE_URL}/companies`, { params: filters });
  return response.data;
}

/**
 * Fetch single transport company by ID
 */
export async function fetchTransportCompanyById(id: string): Promise<TransportCompany> {
  const response = await apiClient.get(`${BASE_URL}/companies/${id}`);
  return response.data;
}

/**
 * Create new transport company
 */
export async function createTransportCompany(
  data: CreateTransportCompanyInput
): Promise<TransportCompany> {
  const response = await apiClient.post(`${BASE_URL}/companies`, data);
  return response.data;
}

/**
 * Update existing transport company
 */
export async function updateTransportCompany(
  id: string,
  data: UpdateTransportCompanyInput
): Promise<TransportCompany> {
  const response = await apiClient.put(`${BASE_URL}/companies/${id}`, data);
  return response.data;
}

/**
 * Delete (soft delete) transport company
 */
export async function deleteTransportCompany(id: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/companies/${id}`);
}

// ========== ONGOING TRANSPORTS BOARD ==========

/**
 * Fetch ongoing internal transports for the board view
 * Returns deliveries with status: pending, in_transit
 * Includes rich route information (POD → Border → Final Destination)
 */
export async function fetchOngoingTransports(
  filters: OngoingTransportFilters = {}
): Promise<OngoingTransportResponse> {
  const response = await apiClient.get(`${BASE_URL}/ongoing`, { params: filters });
  return response.data;
}

// ========== UTILITIES ==========

/**
 * Get common destination suggestions
 */
export async function fetchDestinationSuggestions(): Promise<{ suggestions: string[] }> {
  const response = await apiClient.get(`${BASE_URL}/destinations/suggestions`);
  return response.data;
}

/**
 * Get delivery statistics
 */
export async function fetchDeliveryStats(): Promise<DeliveryStats> {
  const response = await apiClient.get(`${BASE_URL}/stats`);
  return response.data;
}

