/**
 * Elleçleme React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as elleclemeService from '../services/ellecleme';
import type {
  ElleclemeRequest,
  ElleclemePermit,
  ElleçlemeCost,
  ElleclemeDocument,
  ActivityType,
  DashboardSummary,
  CreateRequestInput,
  UpdateRequestInput,
  SubmitForPermitInput,
  StartExecutionInput,
  CompleteRequestInput,
  ApprovePermitInput,
  RejectPermitInput,
  CreateCostInput,
  RequestFilters,
  ElleclemeStatus,
  PermitStatus,
} from '../services/ellecleme';

// Query Keys
export const elleclemeKeys = {
  all: ['ellecleme'] as const,
  dashboard: () => [...elleclemeKeys.all, 'dashboard'] as const,
  requests: (filters: RequestFilters) => [...elleclemeKeys.all, 'requests', filters] as const,
  request: (id: string) => [...elleclemeKeys.all, 'request', id] as const,
  permits: (filters?: { request_id?: string; status?: PermitStatus }) => [...elleclemeKeys.all, 'permits', filters] as const,
  costs: (request_id?: string) => [...elleclemeKeys.all, 'costs', request_id] as const,
  costSummary: (request_id?: string) => [...elleclemeKeys.all, 'costSummary', request_id] as const,
  documents: (request_id: string) => [...elleclemeKeys.all, 'documents', request_id] as const,
  activityTypes: () => [...elleclemeKeys.all, 'activityTypes'] as const,
  reportSummary: (filters?: any) => [...elleclemeKeys.all, 'reportSummary', filters] as const,
  shipmentHistory: (shipmentId: string) => [...elleclemeKeys.all, 'shipmentHistory', shipmentId] as const,
};

// ============================================================
// DASHBOARD
// ============================================================

export function useElleclemeDashboard() {
  return useQuery({
    queryKey: elleclemeKeys.dashboard(),
    queryFn: elleclemeService.fetchDashboard,
  });
}

// ============================================================
// REQUESTS
// ============================================================

export function useElleclemeRequests(filters: RequestFilters = {}) {
  return useQuery({
    queryKey: elleclemeKeys.requests(filters),
    queryFn: () => elleclemeService.fetchRequests(filters),
  });
}

export function useElleclemeRequest(id: string) {
  return useQuery({
    queryKey: elleclemeKeys.request(id),
    queryFn: () => elleclemeService.fetchRequest(id),
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRequestInput) => elleclemeService.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRequestInput }) => 
      elleclemeService.updateRequest(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useSubmitForPermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubmitForPermitInput }) => 
      elleclemeService.submitForPermit(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useStartExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: StartExecutionInput }) => 
      elleclemeService.startExecution(id, data || {}),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useCompleteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompleteRequestInput }) => 
      elleclemeService.completeRequest(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      elleclemeService.cancelRequest(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

// Workflow actions
export function usePickupRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
      elleclemeService.pickupRequest(id, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useConfirmResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmation_notes }: { id: string; confirmation_notes?: string }) => 
      elleclemeService.confirmResult(id, confirmation_notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useRejectResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejection_reason }: { id: string; rejection_reason: string }) => 
      elleclemeService.rejectResult(id, rejection_reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

// Shipment History
export function useShipmentElleclemeHistory(shipmentId: string) {
  return useQuery({
    queryKey: elleclemeKeys.shipmentHistory(shipmentId),
    queryFn: () => elleclemeService.fetchShipmentElleclemeHistory(shipmentId),
    enabled: !!shipmentId,
  });
}

// ============================================================
// PERMITS
// ============================================================

export function useElleclemePermits(filters?: { request_id?: string; status?: PermitStatus }) {
  return useQuery({
    queryKey: elleclemeKeys.permits(filters),
    queryFn: () => elleclemeService.fetchPermits(filters || {}),
  });
}

export function useApprovePermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovePermitInput }) => 
      elleclemeService.approvePermit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

export function useRejectPermit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectPermitInput }) => 
      elleclemeService.rejectPermit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

// ============================================================
// COSTS
// ============================================================

export function useElleçlemeCosts(request_id?: string) {
  return useQuery({
    queryKey: elleclemeKeys.costs(request_id),
    queryFn: () => elleclemeService.fetchCosts(request_id ? { request_id } : {}),
  });
}

export function useElleçlemeCostSummary(request_id?: string) {
  return useQuery({
    queryKey: elleclemeKeys.costSummary(request_id),
    queryFn: () => elleclemeService.fetchCostSummary(request_id),
  });
}

export function useCreateCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCostInput) => elleclemeService.createCost(data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.costs(data.request_id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.costSummary(data.request_id) });
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(data.request_id) });
    },
  });
}

export function useDeleteCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => elleclemeService.deleteCost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

// ============================================================
// DOCUMENTS
// ============================================================

export function useElleclemeDocuments(request_id: string) {
  return useQuery({
    queryKey: elleclemeKeys.documents(request_id),
    queryFn: () => elleclemeService.fetchDocuments(request_id),
    enabled: !!request_id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => elleclemeService.uploadDocument(formData),
    onSuccess: (_, formData) => {
      const request_id = formData.get('request_id') as string;
      if (request_id) {
        queryClient.invalidateQueries({ queryKey: elleclemeKeys.documents(request_id) });
        queryClient.invalidateQueries({ queryKey: elleclemeKeys.request(request_id) });
      }
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => elleclemeService.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: elleclemeKeys.all });
    },
  });
}

// ============================================================
// ACTIVITY TYPES
// ============================================================

export function useActivityTypes() {
  return useQuery({
    queryKey: elleclemeKeys.activityTypes(),
    queryFn: elleclemeService.fetchActivityTypes,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (static data)
  });
}

// ============================================================
// REPORTS
// ============================================================

export function useElleclemeReportSummary(filters?: {
  date_from?: string;
  date_to?: string;
  activity_code?: string;
  status?: ElleclemeStatus;
  lot_id?: string;
  inventory_id?: string;
}) {
  return useQuery({
    queryKey: elleclemeKeys.reportSummary(filters),
    queryFn: () => elleclemeService.fetchReportSummary(filters || {}),
    enabled: !!filters,
  });
}

// Tutanak
export function useElleçlemeTutanak(requestId: string, enabled = false) {
  return useQuery({
    queryKey: [...elleclemeKeys.all, 'tutanak', requestId],
    queryFn: () => elleclemeService.fetchTutanak(requestId),
    enabled: enabled && !!requestId,
  });
}
