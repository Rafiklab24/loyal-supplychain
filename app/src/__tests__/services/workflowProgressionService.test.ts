import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { WorkflowProgressionService } from '../../services/workflowProgressionService';
import { pool } from '../../db/client';

// Mock database
vi.mock('../../db/client', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('WorkflowProgressionService', () => {
  let service: WorkflowProgressionService;
  const mockPool = vi.mocked(pool);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkflowProgressionService();
  });

  describe('checkAndAutoComplete', () => {
    it('should return zeros when no rules exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any); // No rules
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any); // No notifications

      const result = await service.checkAndAutoComplete();

      expect(result).toEqual({ processed: 0, autoCompleted: 0 });
    });

    it('should return zeros when no pending notifications', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'rule1', notification_type: 'test', entity_type: 'shipment' }],
      } as any); // Rules exist
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any); // No notifications

      const result = await service.checkAndAutoComplete();

      expect(result).toEqual({ processed: 0, autoCompleted: 0 });
    });

    it('should auto-complete notification when condition matches', async () => {
      const rule = {
        id: 'rule1',
        notification_type: 'test_notification',
        entity_type: 'shipment',
        conditions: { status_in: ['sailed', 'arrived'] },
        priority: 1,
        is_active: true,
        rule_name: 'Test Rule',
        description: 'Test description',
      };

      const notification = {
        id: 'notif1',
        notification_type: 'test_notification',
        shipment_id: 'ship1',
        contract_id: null,
      };

      const shipmentData = {
        id: 'ship1',
        status: 'sailed',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [rule] } as any) // Load rules
        .mockResolvedValueOnce({ rows: [notification] } as any) // Load notifications
        .mockResolvedValueOnce({ rows: [shipmentData] } as any) // Load shipment
        .mockResolvedValueOnce({ rows: [] } as any); // Update notification

      const result = await service.checkAndAutoComplete();

      expect(result.autoCompleted).toBe(1);
      expect(result.processed).toBe(1);
    });

    it('should skip notification when entity not found', async () => {
      const rule = {
        id: 'rule1',
        notification_type: 'test_notification',
        entity_type: 'shipment',
        conditions: { status_in: ['sailed'] },
        priority: 1,
        is_active: true,
        rule_name: 'Test Rule',
      };

      const notification = {
        id: 'notif1',
        notification_type: 'test_notification',
        shipment_id: 'ship1',
        contract_id: null,
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [rule] } as any)
        .mockResolvedValueOnce({ rows: [notification] } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // Shipment not found

      const result = await service.checkAndAutoComplete();

      expect(result.autoCompleted).toBe(0);
      expect(result.processed).toBe(1);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate status_in condition', async () => {
      const entityData = { id: '1', status: 'sailed' };
      const condition = { status_in: ['sailed', 'arrived'] };
      const notification = { id: '1', notification_type: 'test', shipment_id: '1', contract_id: null };

      // Access private method via reflection or test through public API
      // For now, test through checkAndAutoComplete
      const rule = {
        id: 'rule1',
        notification_type: 'test',
        entity_type: 'shipment',
        conditions: condition,
        priority: 1,
        is_active: true,
        rule_name: 'Test',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [rule] } as any)
        .mockResolvedValueOnce({ rows: [notification] } as any)
        .mockResolvedValueOnce({ rows: [entityData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.checkAndAutoComplete();
      expect(result.autoCompleted).toBe(1);
    });

    it('should evaluate status_gte condition', async () => {
      const entityData = { id: '1', status: 'arrived' };
      const condition = { status_gte: 'sailed' };
      const notification = { id: '1', notification_type: 'test', shipment_id: '1', contract_id: null };

      const rule = {
        id: 'rule1',
        notification_type: 'test',
        entity_type: 'shipment',
        conditions: condition,
        priority: 1,
        is_active: true,
        rule_name: 'Test',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [rule] } as any)
        .mockResolvedValueOnce({ rows: [notification] } as any)
        .mockResolvedValueOnce({ rows: [entityData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.checkAndAutoComplete();
      expect(result.autoCompleted).toBe(1);
    });

    it('should evaluate field_not_null condition', async () => {
      const entityData = { id: '1', status: 'sailed', customs_clearance_date: '2024-01-15' };
      const condition = { field_not_null: 'customs_clearance_date' };
      const notification = { id: '1', notification_type: 'test', shipment_id: '1', contract_id: null };

      const rule = {
        id: 'rule1',
        notification_type: 'test',
        entity_type: 'shipment',
        conditions: condition,
        priority: 1,
        is_active: true,
        rule_name: 'Test',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [rule] } as any)
        .mockResolvedValueOnce({ rows: [notification] } as any)
        .mockResolvedValueOnce({ rows: [entityData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.checkAndAutoComplete();
      expect(result.autoCompleted).toBe(1);
    });

    it('should evaluate all_of condition', async () => {
      const entityData = { id: '1', status: 'sailed', customs_clearance_date: '2024-01-15' };
      const condition = {
        all_of: [
          { status_in: ['sailed', 'arrived'] },
          { field_not_null: 'customs_clearance_date' },
        ],
      };
      const notification = { id: '1', notification_type: 'test', shipment_id: '1', contract_id: null };

      const rule = {
        id: 'rule1',
        notification_type: 'test',
        entity_type: 'shipment',
        conditions: condition,
        priority: 1,
        is_active: true,
        rule_name: 'Test',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [rule] } as any)
        .mockResolvedValueOnce({ rows: [notification] } as any)
        .mockResolvedValueOnce({ rows: [entityData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.checkAndAutoComplete();
      expect(result.autoCompleted).toBe(1);
    });

    it('should evaluate any_of condition', async () => {
      const entityData = { id: '1', status: 'sailed' };
      const condition = {
        any_of: [
          { status_in: ['booked'] },
          { status_in: ['sailed'] },
        ],
      };
      const notification = { id: '1', notification_type: 'test', shipment_id: '1', contract_id: null };

      const rule = {
        id: 'rule1',
        notification_type: 'test',
        entity_type: 'shipment',
        conditions: condition,
        priority: 1,
        is_active: true,
        rule_name: 'Test',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [rule] } as any)
        .mockResolvedValueOnce({ rows: [notification] } as any)
        .mockResolvedValueOnce({ rows: [entityData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.checkAndAutoComplete();
      expect(result.autoCompleted).toBe(1);
    });
  });

  describe('getAllRules', () => {
    it('should return all rules', async () => {
      const rules = [
        { id: 'rule1', notification_type: 'test1', priority: 1 },
        { id: 'rule2', notification_type: 'test2', priority: 2 },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: rules } as any);

      const result = await service.getAllRules();

      expect(result).toEqual(rules);
    });
  });

  describe('updateRule', () => {
    it('should update rule conditions', async () => {
      const updatedRule = {
        id: 'rule1',
        notification_type: 'test',
        conditions: { status_in: ['sailed'] },
        is_active: true,
        priority: 1,
      };

      mockPool.query.mockResolvedValueOnce({ rows: [updatedRule] } as any);

      const result = await service.updateRule('rule1', {
        conditions: { status_in: ['sailed'] },
      });

      expect(result).toEqual(updatedRule);
    });

    it('should update rule is_active', async () => {
      const updatedRule = {
        id: 'rule1',
        notification_type: 'test',
        is_active: false,
      };

      mockPool.query.mockResolvedValueOnce({ rows: [updatedRule] } as any);

      const result = await service.updateRule('rule1', {
        is_active: false,
      });

      expect(result).toEqual(updatedRule);
    });

    it('should return null if rule not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.updateRule('nonexistent', {
        is_active: true,
      });

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ total: '10', active: '8' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ today: '5', week: '20' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { rule_name: 'Rule 1', count: '10' },
            { rule_name: 'Rule 2', count: '5' },
          ],
        } as any);

      const result = await service.getStats();

      expect(result).toEqual({
        totalRules: 10,
        activeRules: 8,
        autoCompletedToday: 5,
        autoCompletedThisWeek: 20,
        topRules: [
          { rule_name: 'Rule 1', count: '10' },
          { rule_name: 'Rule 2', count: '5' },
        ],
      });
    });
  });
});
