/**
 * Custom hooks for accounting data
 * Includes toast notifications for mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  accountingService, 
  type AccountingFilters, 
  type AccountingResponse, 
  type ShipmentTransactionDetail,
  type ClearanceCostRow,
  type TransportRow,
  type TransactionRow,
  type RecordType,
  type DocumentRecordParams,
  type SavedInvoice,
  type InventoryTransactionFilters,
  type InventoryTransactionsResponse,
} from '../services/accounting';
import { useToast } from '../components/common/Toast';

/**
 * Hook to fetch aggregated shipment financial data
 * Uses backend aggregation for better performance
 */
export function useShipmentFinancials(filters: AccountingFilters = {}) {
  return useQuery<AccountingResponse>({
    queryKey: ['accounting', 'shipments', filters],
    queryFn: () => accountingService.getShipmentFinancials(filters),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch detailed transactions for a specific shipment
 */
export function useShipmentTransactions(shipmentId: string | undefined) {
  return useQuery<ShipmentTransactionDetail>({
    queryKey: ['accounting', 'shipment-transactions', shipmentId],
    queryFn: () => accountingService.getShipmentTransactions(shipmentId!),
    enabled: !!shipmentId,
  });
}

/**
 * Hook to fetch accounting summary
 */
export function useAccountingSummary(dateRange?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['accounting', 'summary', dateRange],
    queryFn: () => accountingService.getSummary(dateRange),
    staleTime: 60000,
  });
}

/**
 * Hook to fetch all customs clearing costs
 * Uses backend SQL filtering for correct pagination
 */
export function useClearanceCosts(params: { page?: number; limit?: number; search?: string; documented?: boolean } = {}) {
  return useQuery<{ data: ClearanceCostRow[]; pagination: { page: number; limit: number; total: number; pages: number } }>({
    queryKey: ['accounting', 'clearance-costs', params],
    queryFn: () => accountingService.getClearanceCosts(params),
    staleTime: 30000, // 30 seconds - shorter for faster updates after documenting
  });
}

/**
 * Hook to fetch all internal transport deliveries
 * Uses backend SQL filtering for correct pagination
 */
export function useTransportDeliveries(params: { page?: number; limit?: number; search?: string; documented?: boolean } = {}) {
  return useQuery<{ data: TransportRow[]; pagination: { page: number; limit: number; total: number; pages: number } }>({
    queryKey: ['accounting', 'transport-deliveries', params],
    queryFn: () => accountingService.getTransportDeliveries(params),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch all financial transactions
 * Uses backend SQL filtering for correct pagination
 */
export function useFinancialTransactions(params: { page?: number; limit?: number; search?: string; shipment_id?: string; documented?: boolean } = {}) {
  return useQuery<{ data: TransactionRow[]; pagination: { page: number; limit: number; total: number; pages: number } }>({
    queryKey: ['accounting', 'financial-transactions', params],
    queryFn: () => accountingService.getFinancialTransactions(params),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch inventory transactions (حركة البضاعة)
 * Aggregates data from shipments matching the CSV structure
 */
export function useInventoryTransactions(params: InventoryTransactionFilters = {}) {
  return useQuery<InventoryTransactionsResponse>({
    queryKey: ['accounting', 'inventory-transactions', params],
    queryFn: () => accountingService.getInventoryTransactions(params),
    staleTime: 60000, // 1 minute - this data changes less frequently
  });
}

// ========== Documentation (ترحيل) Mutation Hooks with Toast ==========

/**
 * Hook to document a record (ترحيل)
 * Shows toast notification on success/failure
 */
export function useDocumentRecord() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  return useMutation({
    mutationFn: (params: DocumentRecordParams) => accountingService.documentRecord(params),
    onSuccess: (_, variables) => {
      // Invalidate queries based on record type
      const queryKeyMap: Record<RecordType, string> = {
        'clearance_cost': 'clearance-costs',
        'transport': 'transport-deliveries',
        'transaction': 'financial-transactions',
      };
      const queryKey = queryKeyMap[variables.record_type];
      queryClient.invalidateQueries({ queryKey: ['accounting', queryKey] });
      
      // Show success toast
      toast.success(
        isRtl ? 'تم ترحيل السجل بنجاح ✓' : 'Record documented successfully ✓'
      );
      
      console.log(`[Accounting] Record documented: ${variables.record_type}/${variables.record_id}`);
    },
    onError: (error: any) => {
      // Show error toast
      toast.error(
        isRtl 
          ? `فشل في ترحيل السجل: ${error.message || 'خطأ غير معروف'}` 
          : `Failed to document record: ${error.message || 'Unknown error'}`
      );
      console.error('[Accounting] Failed to document record:', error.message);
    },
  });
}

/**
 * Hook to undocument a record (إلغاء الترحيل)
 * Shows toast notification on success/failure
 */
export function useUndocumentRecord() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  return useMutation({
    mutationFn: (params: { record_type: RecordType; record_id: string }) => 
      accountingService.undocumentRecord(params),
    onSuccess: (_, variables) => {
      // Invalidate queries based on record type
      const queryKeyMap: Record<RecordType, string> = {
        'clearance_cost': 'clearance-costs',
        'transport': 'transport-deliveries',
        'transaction': 'financial-transactions',
      };
      const queryKey = queryKeyMap[variables.record_type];
      queryClient.invalidateQueries({ queryKey: ['accounting', queryKey] });
      
      // Show success toast
      toast.success(
        isRtl ? 'تم إلغاء ترحيل السجل ✓' : 'Record undocumented successfully ✓'
      );
      
      console.log(`[Accounting] Record undocumented: ${variables.record_type}/${variables.record_id}`);
    },
    onError: (error: any) => {
      // Show error toast
      toast.error(
        isRtl 
          ? `فشل في إلغاء ترحيل السجل: ${error.message || 'خطأ غير معروف'}` 
          : `Failed to undocument record: ${error.message || 'Unknown error'}`
      );
      console.error('[Accounting] Failed to undocument record:', error.message);
    },
  });
}

// ========== Invoice Hooks ==========

/**
 * Hook to fetch saved invoices
 */
export function useInvoices(params: { 
  page?: number; 
  limit?: number; 
  type?: 'purchase' | 'sales'; 
  status?: string;
  shipment_id?: string;
  search?: string;
} = {}) {
  return useQuery<{ data: SavedInvoice[]; pagination: { page: number; limit: number; total: number; pages: number } }>({
    queryKey: ['accounting', 'invoices', params],
    queryFn: () => accountingService.getInvoices(params),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch a single invoice
 */
export function useInvoice(id: string | undefined) {
  return useQuery<SavedInvoice>({
    queryKey: ['accounting', 'invoice', id],
    queryFn: () => accountingService.getInvoice(id!),
    enabled: !!id,
  });
}

/**
 * Hook to save an invoice
 * Shows toast notification on success/failure
 */
export function useSaveInvoice() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return useMutation({
    mutationFn: (invoiceData: any) => accountingService.saveInvoice(invoiceData),
    onSuccess: (savedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'invoices'] });
      
      toast.success(
        isRtl 
          ? `تم حفظ الفاتورة ${savedInvoice.invoice_number} بنجاح ✓` 
          : `Invoice ${savedInvoice.invoice_number} saved successfully ✓`
      );
      
      console.log(`[Accounting] Invoice saved: ${savedInvoice.invoice_number}`);
    },
    onError: (error: any) => {
      toast.error(
        isRtl 
          ? `فشل في حفظ الفاتورة: ${error.message || 'خطأ غير معروف'}` 
          : `Failed to save invoice: ${error.message || 'Unknown error'}`
      );
      console.error('[Accounting] Failed to save invoice:', error.message);
    },
  });
}

/**
 * Hook to update invoice status
 * Shows toast notification on success/failure
 */
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return useMutation({
    mutationFn: ({ id, status, cancelledReason }: { id: string; status: 'draft' | 'sent' | 'paid' | 'cancelled'; cancelledReason?: string }) => 
      accountingService.updateInvoiceStatus(id, status, cancelledReason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['accounting', 'invoice', variables.id] });
      
      const statusLabels: Record<string, { ar: string; en: string }> = {
        draft: { ar: 'مسودة', en: 'draft' },
        sent: { ar: 'مُرسلة', en: 'sent' },
        paid: { ar: 'مدفوعة', en: 'paid' },
        cancelled: { ar: 'ملغاة', en: 'cancelled' },
      };
      
      const statusLabel = statusLabels[variables.status];
      toast.success(
        isRtl 
          ? `تم تحديث حالة الفاتورة إلى "${statusLabel.ar}" ✓` 
          : `Invoice status updated to "${statusLabel.en}" ✓`
      );
    },
    onError: (error: any) => {
      toast.error(
        isRtl 
          ? `فشل في تحديث حالة الفاتورة: ${error.message || 'خطأ غير معروف'}` 
          : `Failed to update invoice status: ${error.message || 'Unknown error'}`
      );
    },
  });
}

/**
 * Hook to delete an invoice
 * Shows toast notification on success/failure
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return useMutation({
    mutationFn: (id: string) => accountingService.deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'invoices'] });
      
      toast.success(
        isRtl ? 'تم حذف الفاتورة بنجاح ✓' : 'Invoice deleted successfully ✓'
      );
    },
    onError: (error: any) => {
      toast.error(
        isRtl 
          ? `فشل في حذف الفاتورة: ${error.message || 'خطأ غير معروف'}` 
          : `Failed to delete invoice: ${error.message || 'Unknown error'}`
      );
    },
  });
}
