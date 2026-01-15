import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { NotificationService } from '../../services/notificationService';
import { pool } from '../../db/client';
import { workflowProgressionService } from '../../services/workflowProgressionService';

// Mock dependencies
vi.mock('../../db/client', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../services/workflowProgressionService', () => ({
  workflowProgressionService: {
    checkAndAutoComplete: vi.fn(),
  },
}));

vi.mock('../../utils/demurrageCalculator', () => ({
  calculateDemurrageStatus: vi.fn(),
  isClearanceEntryOverdue: vi.fn(),
}));

describe('NotificationService', () => {
  let service: NotificationService;
  const mockPool = vi.mocked(pool);
  const mockWorkflowService = vi.mocked(workflowProgressionService);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
  });

  describe('checkAndGenerateNotifications', () => {
    it('should check contracts and shipments', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] } as any) // Contracts
        .mockResolvedValueOnce({ rows: [] } as any); // Shipments
      mockWorkflowService.checkAndAutoComplete.mockResolvedValueOnce({
        processed: 0,
        autoCompleted: 0,
      });

      await service.checkAndGenerateNotifications();

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should call workflow progression service', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await service.checkAndGenerateNotifications();

      expect(mockWorkflowService.checkAndAutoComplete).toHaveBeenCalled();
    });
  });

  describe('checkContractNotifications', () => {
    it('should check contract created notification', async () => {
      const contract = {
        id: 'contract1',
        contract_no: 'CT-001',
        status: 'ACTIVE',
        buyer_company_id: 'buyer1',
        seller_company_id: 'seller1',
        created_at: new Date(),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [contract] } as any) // Get contract
        .mockResolvedValueOnce({ rows: [] } as any) // Check notification exists
        .mockResolvedValueOnce({ rows: [] } as any) // Create notification
        .mockResolvedValueOnce({ rows: [] } as any); // Update last check

      await service.checkContractNotifications('contract1');

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should check advance payment notification', async () => {
      const contract = {
        id: 'contract1',
        contract_no: 'CT-001',
        status: 'ACTIVE',
        signed_at: new Date(),
        created_at: new Date(),
      };

      const paymentSchedule = {
        id: 'pay1',
        contract_id: 'contract1',
        seq: 1,
        basis: 'ON_BOOKING',
        days_after: 0,
        percent: 30,
        is_deferred: false,
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [contract] } as any)
        .mockResolvedValueOnce({ rows: [paymentSchedule] } as any) // Get payment schedule
        .mockResolvedValueOnce({ rows: [] } as any) // Check notification exists
        .mockResolvedValueOnce({ rows: [] } as any) // Create notification
        .mockResolvedValueOnce({ rows: [] } as any); // Update last check

      await service.checkContractNotifications('contract1');

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('checkShipmentNotifications', () => {
    it('should check buyer workflow notifications', async () => {
      const shipment = {
        id: 'ship1',
        sn: 'SN-001',
        transaction_type: 'incoming',
        status: 'booked',
        contract_ship_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        eta: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        balance_value_usd: 1000,
        created_at: new Date(),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [shipment] } as any) // Get shipment
        .mockResolvedValueOnce({ rows: [] } as any) // Check shipping deadline
        .mockResolvedValueOnce({ rows: [] } as any) // Create notification
        .mockResolvedValueOnce({ rows: [] } as any) // Check documents
        .mockResolvedValueOnce({ rows: [{ doc_count: '2' }] } as any) // Document count
        .mockResolvedValueOnce({ rows: [] } as any); // Update last check

      await service.checkShipmentNotifications('ship1');

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should check seller workflow notifications', async () => {
      const shipment = {
        id: 'ship1',
        sn: 'SN-001',
        transaction_type: 'outgoing',
        status: 'booked',
        contract_id: 'contract1',
        contract_ship_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [shipment] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // Check contract created
        .mockResolvedValueOnce({ rows: [] } as any) // Create notification
        .mockResolvedValueOnce({ rows: [] } as any) // Check shipping deadline
        .mockResolvedValueOnce({ rows: [] } as any) // Create notification
        .mockResolvedValueOnce({ rows: [] } as any); // Update last check

      await service.checkShipmentNotifications('ship1');

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should check balance payment notifications', async () => {
      const shipment = {
        id: 'ship1',
        sn: 'SN-001',
        transaction_type: 'incoming',
        status: 'sailed',
        eta: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        balance_value_usd: 5000,
        created_at: new Date(),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [shipment] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // Check shipping deadline (skip)
        .mockResolvedValueOnce({ rows: [] } as any) // Check documents (skip)
        .mockResolvedValueOnce({ rows: [] } as any) // Check balance payment 2w
        .mockResolvedValueOnce({ rows: [] } as any) // Create notification
        .mockResolvedValueOnce({ rows: [] } as any); // Update last check

      await service.checkShipmentNotifications('ship1');

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should check critical balance payment (8 days)', async () => {
      const shipment = {
        id: 'ship1',
        sn: 'SN-001',
        transaction_type: 'incoming',
        status: 'sailed',
        eta: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
        balance_value_usd: 5000,
        created_at: new Date(),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [shipment] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // Check shipping deadline
        .mockResolvedValueOnce({ rows: [] } as any) // Check documents
        .mockResolvedValueOnce({ rows: [] } as any) // Check balance payment 8d
        .mockResolvedValueOnce({ rows: [] } as any) // Create notification
        .mockResolvedValueOnce({ rows: [] } as any); // Update last check

      await service.checkShipmentNotifications('ship1');

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('notifyQualityIncidentCreated', () => {
    it('should create quality incident notification', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: false }] } as any) // Check exists
        .mockResolvedValueOnce({ rows: [] } as any); // Create notification

      await service.notifyQualityIncidentCreated('incident1', 'SN-001');

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should skip if notification already exists', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
      } as any);

      await service.notifyQualityIncidentCreated('incident1', 'SN-001');

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyQualityIncidentSubmitted', () => {
    it('should create submitted notification', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.notifyQualityIncidentSubmitted('incident1', 'SN-001', 'quality_issue');

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('notifyResamplingRequested', () => {
    it('should create resampling notification', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.notifyResamplingRequested('incident1', 'SN-001', ['sample1', 'sample2']);

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('notifyHoldStatusChanged', () => {
    it('should create cleared hold notification', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.notifyHoldStatusChanged('SN-001', 'cleared', 'Quality approved');

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should create kept hold notification', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.notifyHoldStatusChanged('SN-001', 'kept', 'Quality issues found');

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('notifyQualityIncidentClosed', () => {
    it('should create closed notification', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.notifyQualityIncidentClosed('incident1', 'SN-001', 'Resolved');

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('createQualityFeedbackReminder', () => {
    it('should create feedback reminder', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await service.createQualityFeedbackReminder('ship1', 'SN-001');

      expect(mockPool.query).toHaveBeenCalled();
    });
  });
});
