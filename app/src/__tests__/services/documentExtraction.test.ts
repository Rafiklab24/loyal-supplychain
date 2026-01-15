import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import {
  processProformaDocument,
  processBOLDocument,
  processCommercialInvoiceDocument,
} from '../../services/documentExtraction';
import { extractFromProformaInvoice, extractFromBillOfLading, extractFromCommercialInvoice } from '../../services/openai';
import { convertPdfToImage, convertPdfToImages, cleanupImages } from '../../utils/pdfProcessor';
import { saveTrainingData } from '../../utils/dataCollector';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../services/openai');
vi.mock('../../utils/pdfProcessor');
vi.mock('../../utils/dataCollector');

describe('Document Extraction Service', () => {
  const mockFs = vi.mocked(fs);
  const mockExtractProforma = vi.mocked(extractFromProformaInvoice);
  const mockExtractBOL = vi.mocked(extractFromBillOfLading);
  const mockExtractCI = vi.mocked(extractFromCommercialInvoice);
  const mockConvertPdfToImage = vi.mocked(convertPdfToImage);
  const mockConvertPdfToImages = vi.mocked(convertPdfToImages);
  const mockCleanupImages = vi.mocked(cleanupImages);
  const mockSaveTrainingData = vi.mocked(saveTrainingData);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processProformaDocument', () => {
    it('should process PDF file', async () => {
      const filePath = '/test/proforma.pdf';
      const imagePath = '/tmp/proforma.png';
      const mockResult = {
        success: true,
        data: { proforma_invoice: { number: 'PI-001' } },
        confidence: 95,
        warnings: [],
        processingTime: 1000,
        tokensUsed: 500,
        estimatedCost: 0.01,
      };

      mockConvertPdfToImage.mockResolvedValueOnce(imagePath);
      mockExtractProforma.mockResolvedValueOnce(mockResult);
      mockSaveTrainingData.mockResolvedValueOnce('training-id-1');
      mockFs.unlink.mockResolvedValueOnce(undefined);

      const result = await processProformaDocument(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult.data);
      expect(result.confidence).toBe(95);
      expect(mockConvertPdfToImage).toHaveBeenCalledWith(filePath);
      expect(mockExtractProforma).toHaveBeenCalledWith(imagePath);
      expect(mockFs.unlink).toHaveBeenCalledWith(imagePath);
    });

    it('should process image file directly', async () => {
      const filePath = '/test/proforma.png';
      const mockResult = {
        success: true,
        data: { proforma_invoice: { number: 'PI-001' } },
        confidence: 95,
        warnings: [],
        processingTime: 1000,
      };

      mockExtractProforma.mockResolvedValueOnce(mockResult);
      mockSaveTrainingData.mockResolvedValueOnce('training-id-1');

      const result = await processProformaDocument(filePath);

      expect(result.success).toBe(true);
      expect(mockConvertPdfToImage).not.toHaveBeenCalled();
      expect(mockExtractProforma).toHaveBeenCalledWith(filePath);
    });

    it('should handle extraction failure', async () => {
      const filePath = '/test/proforma.pdf';
      const imagePath = '/tmp/proforma.png';
      const mockResult = {
        success: false,
        data: null,
        confidence: 0,
        warnings: ['Extraction failed'],
        processingTime: 500,
      };

      mockConvertPdfToImage.mockResolvedValueOnce(imagePath);
      mockExtractProforma.mockResolvedValueOnce(mockResult);
      mockFs.unlink.mockResolvedValueOnce(undefined);

      const result = await processProformaDocument(filePath);

      expect(result.success).toBe(false);
      expect(result.warnings).toContain('Extraction failed');
    });

    it('should cleanup on error', async () => {
      const filePath = '/test/proforma.pdf';
      const imagePath = '/tmp/proforma.png';

      mockConvertPdfToImage.mockResolvedValueOnce(imagePath);
      mockExtractProforma.mockRejectedValueOnce(new Error('API Error'));
      mockFs.unlink.mockResolvedValueOnce(undefined);

      const result = await processProformaDocument(filePath);

      expect(result.success).toBe(false);
      expect(mockFs.unlink).toHaveBeenCalledWith(imagePath);
    });

    it('should skip training data collection when disabled', async () => {
      const filePath = '/test/proforma.png';
      const mockResult = {
        success: true,
        data: { proforma_invoice: { number: 'PI-001' } },
        confidence: 95,
        warnings: [],
        processingTime: 1000,
      };

      mockExtractProforma.mockResolvedValueOnce(mockResult);

      const result = await processProformaDocument(filePath, {
        collectTrainingData: false,
      });

      expect(result.success).toBe(true);
      expect(mockSaveTrainingData).not.toHaveBeenCalled();
      expect(result.trainingDataId).toBeUndefined();
    });
  });

  describe('processBOLDocument', () => {
    it('should process multi-page PDF', async () => {
      const filePath = '/test/bol.pdf';
      const imagePaths = ['/tmp/bol-1.png', '/tmp/bol-2.png'];
      const mockResult = {
        success: true,
        data: { document_info: { bl_number: 'BL-001' } },
        confidence: 90,
        warnings: [],
        processingTime: 2000,
        tokensUsed: 1000,
        estimatedCost: 0.02,
      };

      mockConvertPdfToImages.mockResolvedValueOnce(imagePaths);
      mockExtractBOL.mockResolvedValueOnce(mockResult);
      mockSaveTrainingData.mockResolvedValueOnce('training-id-2');
      mockCleanupImages.mockResolvedValueOnce(undefined);

      const result = await processBOLDocument(filePath);

      expect(result.success).toBe(true);
      expect(mockConvertPdfToImages).toHaveBeenCalledWith(filePath);
      expect(mockExtractBOL).toHaveBeenCalledWith(imagePaths);
      expect(mockCleanupImages).toHaveBeenCalledWith(imagePaths);
    });

    it('should process single image file', async () => {
      const filePath = '/test/bol.png';
      const mockResult = {
        success: true,
        data: { document_info: { bl_number: 'BL-001' } },
        confidence: 90,
        warnings: [],
        processingTime: 1000,
      };

      mockExtractBOL.mockResolvedValueOnce(mockResult);

      const result = await processBOLDocument(filePath);

      expect(result.success).toBe(true);
      expect(mockConvertPdfToImages).not.toHaveBeenCalled();
      expect(mockExtractBOL).toHaveBeenCalledWith([filePath]);
    });

    it('should handle extraction failure', async () => {
      const filePath = '/test/bol.pdf';
      const imagePaths = ['/tmp/bol-1.png'];

      mockConvertPdfToImages.mockResolvedValueOnce(imagePaths);
      mockExtractBOL.mockResolvedValueOnce({
        success: false,
        data: null,
        confidence: 0,
        warnings: ['No BOL found'],
        processingTime: 500,
      });
      mockCleanupImages.mockResolvedValueOnce(undefined);

      const result = await processBOLDocument(filePath);

      expect(result.success).toBe(false);
      expect(result.warnings).toContain('No BOL found');
    });
  });

  describe('processCommercialInvoiceDocument', () => {
    it('should process Commercial Invoice PDF', async () => {
      const filePath = '/test/ci.pdf';
      const imagePaths = ['/tmp/ci-1.png', '/tmp/ci-2.png'];
      const mockResult = {
        success: true,
        data: {
          document_info: { invoice_number: 'CI-001' },
          cargo_type: 'containers',
        },
        confidence: 92,
        warnings: [],
        processingTime: 1500,
        tokensUsed: 800,
        estimatedCost: 0.015,
      };

      mockConvertPdfToImages.mockResolvedValueOnce(imagePaths);
      mockExtractCI.mockResolvedValueOnce(mockResult);
      mockSaveTrainingData.mockResolvedValueOnce('training-id-3');
      mockCleanupImages.mockResolvedValueOnce(undefined);

      const result = await processCommercialInvoiceDocument(filePath);

      expect(result.success).toBe(true);
      expect(mockExtractCI).toHaveBeenCalledWith(imagePaths);
      expect(mockCleanupImages).toHaveBeenCalledWith(imagePaths);
    });

    it('should handle single page Commercial Invoice', async () => {
      const filePath = '/test/ci.png';
      const mockResult = {
        success: true,
        data: { document_info: { invoice_number: 'CI-001' } },
        confidence: 92,
        warnings: [],
        processingTime: 1000,
      };

      mockExtractCI.mockResolvedValueOnce(mockResult);

      const result = await processCommercialInvoiceDocument(filePath);

      expect(result.success).toBe(true);
      expect(mockExtractCI).toHaveBeenCalledWith([filePath]);
    });

    it('should cleanup on error', async () => {
      const filePath = '/test/ci.pdf';
      const imagePaths = ['/tmp/ci-1.png'];

      mockConvertPdfToImages.mockResolvedValueOnce(imagePaths);
      mockExtractCI.mockRejectedValueOnce(new Error('API Error'));
      mockCleanupImages.mockResolvedValueOnce(undefined);

      const result = await processCommercialInvoiceDocument(filePath);

      expect(result.success).toBe(false);
      expect(mockCleanupImages).toHaveBeenCalledWith(imagePaths);
    });
  });
});
