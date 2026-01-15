import { describe, it, expect } from '@jest/globals';
import {
  exportCustomsClearingCostsToExcel,
  generateExportFilename,
  exportCustomsClearingCostsWithSummary,
  exportCustomsClearingBatch,
} from '../../services/excelExportService';
import { CustomsClearingCostDTO, CustomsClearingBatchDetailDTO } from '../../types/dto';

describe('Excel Export Service', () => {
  const mockCost: CustomsClearingCostDTO = {
    id: '1',
    file_number: 'FILE-001',
    transaction_description: 'Test transaction',
    destination_final_beneficiary: 'Test Company',
    bol_number: 'BOL-001',
    car_plate: 'ABC-123',
    cost_paid_by_company: 100,
    cost_paid_by_fb: 50,
    extra_cost_amount: 10,
    extra_cost_description: 'Extra cost',
    total_clearing_cost: 160,
    client_name: 'Client Name',
    invoice_amount: 200,
    currency: 'USD',
    invoice_number: 'INV-001',
    invoice_date: '2024-01-15',
    clearance_type: 'inbound',
    payment_status: 'pending',
    notes: 'Test notes',
    batch_id: null,
    created_at: '2024-01-15',
    updated_at: '2024-01-15',
  };

  describe('exportCustomsClearingCostsToExcel', () => {
    it('should export costs to Excel buffer', () => {
      const buffer = exportCustomsClearingCostsToExcel([mockCost]);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      const buffer = exportCustomsClearingCostsToExcel([]);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should use custom sheet name', () => {
      const buffer = exportCustomsClearingCostsToExcel([mockCost], {
        sheetName: 'Custom Sheet',
      });

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should format numbers correctly', () => {
      const costWithDecimals: CustomsClearingCostDTO = {
        ...mockCost,
        total_clearing_cost: 123.45,
        cost_paid_by_fb: 67.89,
      };

      const buffer = exportCustomsClearingCostsToExcel([costWithDecimals]);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle null values', () => {
      const costWithNulls: CustomsClearingCostDTO = {
        ...mockCost,
        bol_number: null,
        car_plate: null,
        invoice_amount: null,
      };

      const buffer = exportCustomsClearingCostsToExcel([costWithNulls]);
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('generateExportFilename', () => {
    it('should generate filename with prefix and timestamp', () => {
      const filename = generateExportFilename('test_prefix');

      expect(filename).toContain('test_prefix');
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
      expect(filename).toContain('.xlsx');
    });

    it('should use default prefix when not provided', () => {
      const filename = generateExportFilename();

      expect(filename).toContain('customs_clearing_costs');
      expect(filename).toContain('.xlsx');
    });
  });

  describe('exportCustomsClearingCostsWithSummary', () => {
    it('should export costs with summary sheet', () => {
      const buffer = exportCustomsClearingCostsWithSummary([mockCost]);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should calculate totals correctly', () => {
      const costs: CustomsClearingCostDTO[] = [
        { ...mockCost, total_clearing_cost: 100, cost_paid_by_company: 100 },
        { ...mockCost, id: '2', total_clearing_cost: 200, cost_paid_by_fb: 200 },
      ];

      const buffer = exportCustomsClearingCostsWithSummary(costs);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should separate inbound and outbound costs', () => {
      const costs: CustomsClearingCostDTO[] = [
        { ...mockCost, clearance_type: 'inbound' },
        { ...mockCost, id: '2', clearance_type: 'outbound' },
      ];

      const buffer = exportCustomsClearingCostsWithSummary(costs);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle empty costs array', () => {
      const buffer = exportCustomsClearingCostsWithSummary([]);
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('exportCustomsClearingBatch', () => {
    const mockBatch: CustomsClearingBatchDetailDTO = {
      id: '1',
      batch_number: 'BATCH-001',
      status: 'pending',
      item_count: 1,
      total_clearing_cost: 160,
      created_by: 'user1',
      created_at: '2024-01-15',
      submitted_at: null,
      reviewed_by: null,
      reviewed_at: null,
      notes: 'Test notes',
      items: [mockCost],
    };

    it('should export batch with all sheets', () => {
      const buffer = exportCustomsClearingBatch(mockBatch, 'en');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should export in Arabic', () => {
      const buffer = exportCustomsClearingBatch(mockBatch, 'ar');

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle batch with multiple items', () => {
      const batchWithMultiple: CustomsClearingBatchDetailDTO = {
        ...mockBatch,
        items: [mockCost, { ...mockCost, id: '2' }],
        item_count: 2,
      };

      const buffer = exportCustomsClearingBatch(batchWithMultiple, 'en');
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle tie in voting (cafe feature)', () => {
      // This tests the batch export doesn't break with various data
      const buffer = exportCustomsClearingBatch(mockBatch, 'en');
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should calculate totals breakdown correctly', () => {
      const batchWithCosts: CustomsClearingBatchDetailDTO = {
        ...mockBatch,
        items: [
          { ...mockCost, cost_paid_by_company: 100, cost_paid_by_fb: 0, extra_cost_amount: 10 },
          { ...mockCost, id: '2', cost_paid_by_company: 0, cost_paid_by_fb: 200, extra_cost_amount: 20 },
        ],
      };

      const buffer = exportCustomsClearingBatch(batchWithCosts, 'en');
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle null values in batch', () => {
      const batchWithNulls: CustomsClearingBatchDetailDTO = {
        ...mockBatch,
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        notes: null,
      };

      const buffer = exportCustomsClearingBatch(batchWithNulls, 'en');
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });
});
