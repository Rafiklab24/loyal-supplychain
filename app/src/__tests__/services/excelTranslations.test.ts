import { describe, it, expect } from '@jest/globals';
import {
  getExcelTranslation,
  translateStatus,
  translateClearanceType,
  translatePaymentStatus,
  translateCostPaidBy,
  ExcelLanguage,
} from '../../services/excelTranslations';

describe('Excel Translations Service', () => {
  describe('getExcelTranslation', () => {
    it('should return English translation for valid key', () => {
      expect(getExcelTranslation('en', 'batchSummary')).toBe('Batch Summary');
      expect(getExcelTranslation('en', 'status')).toBe('Status');
      expect(getExcelTranslation('en', 'fileNumber')).toBe('File Number');
    });

    it('should return Arabic translation for valid key', () => {
      expect(getExcelTranslation('ar', 'batchSummary')).toBe('ملخص الدفعة');
      expect(getExcelTranslation('ar', 'status')).toBe('الحالة');
      expect(getExcelTranslation('ar', 'fileNumber')).toBe('رقم الملف');
    });

    it('should return key if translation not found', () => {
      expect(getExcelTranslation('en', 'nonexistentKey')).toBe('nonexistentKey');
      expect(getExcelTranslation('ar', 'nonexistentKey')).toBe('nonexistentKey');
    });
  });

  describe('translateStatus', () => {
    it('should translate pending status', () => {
      expect(translateStatus('pending', 'en')).toBe('Pending');
      expect(translateStatus('pending', 'ar')).toBe('قيد الانتظار');
    });

    it('should translate approved status', () => {
      expect(translateStatus('approved', 'en')).toBe('Approved');
      expect(translateStatus('approved', 'ar')).toBe('موافق عليها');
    });

    it('should translate archived status', () => {
      expect(translateStatus('archived', 'en')).toBe('Archived');
      expect(translateStatus('archived', 'ar')).toBe('مؤرشفة');
    });

    it('should handle case-insensitive status', () => {
      expect(translateStatus('PENDING', 'en')).toBe('Pending');
      expect(translateStatus('APPROVED', 'ar')).toBe('موافق عليها');
    });

    it('should return N/A for unknown status', () => {
      expect(translateStatus('unknown', 'en')).toBe('N/A');
      expect(translateStatus('unknown', 'ar')).toBe('غير متوفر');
    });
  });

  describe('translateClearanceType', () => {
    it('should translate inbound type', () => {
      expect(translateClearanceType('inbound', 'en')).toBe('Inbound');
      expect(translateClearanceType('inbound', 'ar')).toBe('وارد');
    });

    it('should translate outbound type', () => {
      expect(translateClearanceType('outbound', 'en')).toBe('Outbound');
      expect(translateClearanceType('outbound', 'ar')).toBe('صادر');
    });

    it('should handle case-insensitive type', () => {
      expect(translateClearanceType('INBOUND', 'en')).toBe('Inbound');
      expect(translateClearanceType('OUTBOUND', 'ar')).toBe('صادر');
    });

    it('should return N/A for null type', () => {
      expect(translateClearanceType(null, 'en')).toBe('N/A');
      expect(translateClearanceType(null, 'ar')).toBe('غير متوفر');
    });

    it('should return N/A for unknown type', () => {
      expect(translateClearanceType('unknown', 'en')).toBe('N/A');
      expect(translateClearanceType('unknown', 'ar')).toBe('غير متوفر');
    });
  });

  describe('translatePaymentStatus', () => {
    it('should translate pending status', () => {
      expect(translatePaymentStatus('pending', 'en')).toBe('Pending');
      expect(translatePaymentStatus('pending', 'ar')).toBe('قيد الانتظار');
    });

    it('should translate paid status', () => {
      expect(translatePaymentStatus('paid', 'en')).toBe('Paid');
      expect(translatePaymentStatus('paid', 'ar')).toBe('مدفوع');
    });

    it('should translate partial status', () => {
      expect(translatePaymentStatus('partial', 'en')).toBe('Partial');
      expect(translatePaymentStatus('partial', 'ar')).toBe('جزئي');
    });

    it('should handle case-insensitive status', () => {
      expect(translatePaymentStatus('PAID', 'en')).toBe('Paid');
      expect(translatePaymentStatus('PARTIAL', 'ar')).toBe('جزئي');
    });

    it('should return N/A for unknown status', () => {
      expect(translatePaymentStatus('unknown', 'en')).toBe('N/A');
      expect(translatePaymentStatus('unknown', 'ar')).toBe('غير متوفر');
    });
  });

  describe('translateCostPaidBy', () => {
    it('should return Company when cost_paid_by_company is set', () => {
      const item = { cost_paid_by_company: 100 };
      expect(translateCostPaidBy(item, 'en')).toBe('Company');
      expect(translateCostPaidBy(item, 'ar')).toBe('الشركة');
    });

    it('should return Client when cost_paid_by_fb is set', () => {
      const item = { cost_paid_by_fb: 100 };
      expect(translateCostPaidBy(item, 'en')).toBe('Client');
      expect(translateCostPaidBy(item, 'ar')).toBe('العميل');
    });

    it('should prioritize company over client', () => {
      const item = { cost_paid_by_company: 100, cost_paid_by_fb: 50 };
      expect(translateCostPaidBy(item, 'en')).toBe('Company');
    });

    it('should return N/A when neither is set', () => {
      const item = {};
      expect(translateCostPaidBy(item, 'en')).toBe('N/A');
      expect(translateCostPaidBy(item, 'ar')).toBe('غير متوفر');
    });

    it('should return N/A when both are zero', () => {
      const item = { cost_paid_by_company: 0, cost_paid_by_fb: 0 };
      expect(translateCostPaidBy(item, 'en')).toBe('N/A');
    });
  });
});



