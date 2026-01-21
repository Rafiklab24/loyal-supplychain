/**
 * Antrepo React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as antrepoService from '../services/antrepo';
import { markShipmentDelivered } from '../services/inventory';
import type {
  AntrepoLot,
  AntrepoInventory,
  AntrepoExit,
  AntrepoHandlingActivity,
  AntrepoStorageFee,
  ActivityType,
  PendingArrival,
  ActivityLogEntry,
  DashboardData,
  CreateLotInput,
  UpdateLotInput,
  CreateInventoryInput,
  UpdateInventoryInput,
  TransferInventoryInput,
  CreateExitInput,
  CreateHandlingActivityInput,
  CreateStorageFeeInput,
  UpdateStorageFeeInput,
  InventoryFilters,
  ExitsFilters,
  ActivityLogFilters,
} from '../services/antrepo';

// Query Keys
export const antrepoKeys = {
  all: ['antrepo'] as const,
  dashboard: (antrepoId?: string) => [...antrepoKeys.all, 'dashboard', antrepoId] as const,
  lots: (antrepoId?: string) => [...antrepoKeys.all, 'lots', antrepoId] as const,
  inventory: (filters: InventoryFilters) => [...antrepoKeys.all, 'inventory', filters] as const,
  inventoryItem: (id: string) => [...antrepoKeys.all, 'inventory', 'item', id] as const,
  exits: (filters: ExitsFilters) => [...antrepoKeys.all, 'exits', filters] as const,
  exit: (id: string) => [...antrepoKeys.all, 'exits', 'item', id] as const,
  handling: (inventoryId?: string) => [...antrepoKeys.all, 'handling', inventoryId] as const,
  activityTypes: () => [...antrepoKeys.all, 'activityTypes'] as const,
  fees: (inventoryId?: string) => [...antrepoKeys.all, 'fees', inventoryId] as const,
  pendingArrivals: (antrepoId?: string) => [...antrepoKeys.all, 'pendingArrivals', antrepoId] as const,
  activityLog: (filters: ActivityLogFilters) => [...antrepoKeys.all, 'activityLog', filters] as const,
};

// ============================================================
// DASHBOARD
// ============================================================

export function useAntrepoDashboard(antrepoId?: string) {
  return useQuery<DashboardData>({
    queryKey: antrepoKeys.dashboard(antrepoId),
    queryFn: () => antrepoService.getDashboard(antrepoId),
  });
}

// ============================================================
// LOTS
// ============================================================

export function useAntrepoLots(antrepoId?: string, includeInactive?: boolean) {
  return useQuery<AntrepoLot[]>({
    queryKey: antrepoKeys.lots(antrepoId),
    queryFn: () => antrepoService.getLots(antrepoId, includeInactive),
  });
}

export function useCreateLot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLotInput) => antrepoService.createLot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.lots() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
    },
  });
}

export function useUpdateLot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLotInput }) => antrepoService.updateLot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.lots() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
    },
  });
}

// ============================================================
// INVENTORY
// ============================================================

export function useAntrepoInventory(filters?: InventoryFilters) {
  return useQuery({
    queryKey: antrepoKeys.inventory(filters || {}),
    queryFn: () => antrepoService.getInventory(filters || {}),
    enabled: !!filters,
  });
}

export function useAntrepoInventoryItem(id: string) {
  return useQuery<AntrepoInventory>({
    queryKey: antrepoKeys.inventoryItem(id),
    queryFn: () => antrepoService.getInventoryItem(id),
    enabled: !!id,
  });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInventoryInput) => antrepoService.createInventory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventory({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.pendingArrivals() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.activityLog({}) });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryInput }) => antrepoService.updateInventory(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventory({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventoryItem(variables.id) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
    },
  });
}

export function useTransferInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferInventoryInput }) => antrepoService.transferInventory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventory({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.activityLog({}) });
    },
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => antrepoService.deleteInventory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventory({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
    },
  });
}

export function useArchiveInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      antrepoService.archiveInventory(id, { reason }),
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventory({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.pendingArrivals() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.activityLog({}) });
      // Also invalidate shipment-related queries
      queryClient.invalidateQueries({ queryKey: ['inventory-shipments'] });
    },
  });
}

// ============================================================
// EXITS
// ============================================================

export function useAntrepoExits(filters: ExitsFilters = {}) {
  return useQuery({
    queryKey: antrepoKeys.exits(filters),
    queryFn: () => antrepoService.getExits(filters),
  });
}

export function useAntrepoExit(id: string) {
  return useQuery<AntrepoExit>({
    queryKey: antrepoKeys.exit(id),
    queryFn: () => antrepoService.getExit(id),
    enabled: !!id,
  });
}

export function useCreateExit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExitInput) => antrepoService.createExit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.exits({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventory({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.activityLog({}) });
    },
  });
}

// ============================================================
// HANDLING ACTIVITIES
// ============================================================

export function useAntrepoHandlingActivities(inventoryId?: string) {
  return useQuery<AntrepoHandlingActivity[]>({
    queryKey: antrepoKeys.handling(inventoryId),
    queryFn: () => antrepoService.getHandlingActivities(inventoryId),
  });
}

export function useActivityTypes() {
  return useQuery<ActivityType[]>({
    queryKey: antrepoKeys.activityTypes(),
    queryFn: () => antrepoService.getActivityTypes(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - these don't change often
  });
}

export function useCreateHandlingActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHandlingActivityInput) => antrepoService.createHandlingActivity(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.handling(variables.inventory_id) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventoryItem(variables.inventory_id) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.activityLog({}) });
    },
  });
}

// ============================================================
// STORAGE FEES
// ============================================================

export function useAntrepoStorageFees(inventoryId?: string, paymentStatus?: string) {
  return useQuery<AntrepoStorageFee[]>({
    queryKey: antrepoKeys.fees(inventoryId),
    queryFn: () => antrepoService.getStorageFees(inventoryId, paymentStatus),
  });
}

export function useCreateStorageFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStorageFeeInput) => antrepoService.createStorageFee(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.fees(variables.inventory_id) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventoryItem(variables.inventory_id) });
    },
  });
}

export function useUpdateStorageFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStorageFeeInput }) => antrepoService.updateStorageFee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: antrepoKeys.fees() });
    },
  });
}

// ============================================================
// PENDING ARRIVALS
// ============================================================

export function usePendingArrivals(antrepoId?: string) {
  return useQuery<PendingArrival[]>({
    queryKey: antrepoKeys.pendingArrivals(antrepoId),
    queryFn: () => antrepoService.getPendingArrivals(antrepoId),
  });
}

// ============================================================
// ACTIVITY LOG
// ============================================================

export function useActivityLog(filters: ActivityLogFilters = {}) {
  return useQuery<ActivityLogEntry[]>({
    queryKey: antrepoKeys.activityLog(filters),
    queryFn: () => antrepoService.getActivityLog(filters),
  });
}

// ============================================================
// SHIPMENT DELIVERY (For Quality Check Integration)
// ============================================================

/**
 * Hook to mark a shipment as delivered after quality check
 * Used in Antrepo entry flow after recording inventory
 */
export function useMarkShipmentDelivered() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shipmentId, hasIssues }: { shipmentId: string; hasIssues: boolean }) =>
      markShipmentDelivered(shipmentId, hasIssues),
    onSuccess: () => {
      // Invalidate inventory and antrepo queries
      queryClient.invalidateQueries({ queryKey: antrepoKeys.inventory({}) });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.pendingArrivals() });
      queryClient.invalidateQueries({ queryKey: antrepoKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: ['inventory-shipments'] });
    },
  });
}

// ============================================================
// USER'S ACCESSIBLE WAREHOUSES
// ============================================================

/**
 * Hook to get warehouses the current user can access
 */
export function useMyWarehouses() {
  return useQuery({
    queryKey: ['my-warehouses'],
    queryFn: () => antrepoService.getMyWarehouses(),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
