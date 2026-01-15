import { useQuery } from '@tanstack/react-query';
import { shipmentsService } from '../services/shipments';

export function useShipments(params?: {
  page?: number;
  limit?: number;
  status?: string;
  product?: string;
  excludeProduct?: string; // Products to exclude (comma-separated)
  sn?: string;
  pol?: string; // Can be comma-separated list of origins
  pod?: string; // Can be comma-separated list of destinations
  search?: string; // Universal search
  etaMonth?: number; // Filter by ETA month (1-12)
  etaYear?: number; // Filter by ETA year (e.g., 2025)
  etaFrom?: string; // Date range start (YYYY-MM-DD)
  etaTo?: string; // Date range end (YYYY-MM-DD)
  branchId?: string; // Filter by final destination branch
  destinationType?: string; // Filter by final destination type (branch, customer, consignment)
  // Numeric filters with operators
  totalValueOp?: string;
  totalValue?: number;
  containerCountOp?: string;
  containerCount?: number;
  weightOp?: string;
  weight?: number;
  balanceOp?: string;
  balance?: number;
  sortBy?: string; // Column to sort by
  sortDir?: 'asc' | 'desc'; // Sort direction
}) {
  return useQuery({
    queryKey: ['shipments', params],
    queryFn: () => shipmentsService.list(params),
  });
}

// UUID validation helper
const isValidUUID = (str: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: ['shipment', id],
    queryFn: () => shipmentsService.getById(id!),
    enabled: !!id && isValidUUID(id),
  });
}

export function useShipmentBySN(sn: string | undefined) {
  return useQuery({
    queryKey: ['shipment-sn', sn],
    queryFn: () => shipmentsService.getBySN(sn!),
    enabled: !!sn,
  });
}

