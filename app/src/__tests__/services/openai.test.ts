import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import fs from 'fs/promises';
import OpenAI from 'openai';
import {
  extractFromProformaInvoice,
  extractFromBillOfLading,
  extractFromCommercialInvoice,
  checkOpenAIConnection,
  getUsageMetrics,
} from '../../services/openai';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      models: {
        list: vi.fn(),
      },
    })),
  };
});

describe('OpenAI Service', () => {
  let mockOpenAI: any;
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAI = new OpenAI({ apiKey: 'test-key' });
    process.env.OPENAI_MODEL = 'gpt-4o';
    process.env.OPENAI_MAX_TOKENS = '4096';
  });

  describe('extractFromProformaInvoice', () => {
    it('should extract data from image', async () => {
      const imagePath = '/test/proforma.png';
      const imageBuffer = Buffer.from('fake-image-data');
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              proforma_invoice: { number: 'PI-001', date: '2024-01-15' },
              commercial_parties: {
                exporter: { name: 'Exporter Co' },
                buyer: { name: 'Buyer Co' },
              },
              product_lines: [{
                type_of_goods: 'Product',
                quantity_kg: 1000,
                unit_price: 10,
              }],
            }),
          },
        }],
        usage: {
          total_tokens: 500,
          prompt_tokens: 300,
          completion_tokens: 200,
        },
      };

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractFromProformaInvoice(imagePath);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('proforma_invoice');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.tokensUsed).toBe(500);
    });

    it('should handle PNG files', async () => {
      const imagePath = '/test/proforma.png';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: '{}' } }],
        usage: { total_tokens: 100 },
      });

      await extractFromProformaInvoice(imagePath);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content[1].image_url.url).toContain('image/png');
    });

    it('should handle JPEG files', async () => {
      const imagePath = '/test/proforma.jpg';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: '{}' } }],
        usage: { total_tokens: 100 },
      });

      await extractFromProformaInvoice(imagePath);

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content[1].image_url.url).toContain('image/jpeg');
    });

    it('should handle API errors', async () => {
      const imagePath = '/test/proforma.png';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      const result = await extractFromProformaInvoice(imagePath);

      expect(result.success).toBe(false);
      expect(result.warnings).toContain('API Error');
    });

    it('should handle missing content in response', async () => {
      const imagePath = '/test/proforma.png';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: {} }],
        usage: { total_tokens: 100 },
      });

      const result = await extractFromProformaInvoice(imagePath);

      expect(result.success).toBe(false);
      expect(result.warnings[0]).toContain('No content');
    });

    it('should handle invalid JSON in response', async () => {
      const imagePath = '/test/proforma.png';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'This is not JSON',
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await extractFromProformaInvoice(imagePath);

      expect(result.success).toBe(false);
      expect(result.warnings[0]).toContain('No JSON found');
    });

    it('should calculate confidence score', async () => {
      const imagePath = '/test/proforma.png';
      const imageBuffer = Buffer.from('fake-image');
      const completeData = {
        proforma_invoice: { number: 'PI-001', date: '2024-01-15' },
        commercial_parties: {
          exporter: { name: 'Exporter' },
          buyer: { name: 'Buyer' },
        },
        contract_terms: {
          incoterm: 'CIF',
          payment_terms: 'LC',
        },
        totals: { total_amount: 10000 },
        product_lines: [{ type_of_goods: 'Product' }],
      };

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(completeData),
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await extractFromProformaInvoice(imagePath);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(80);
    });
  });

  describe('extractFromBillOfLading', () => {
    it('should extract from single image', async () => {
      const imagePath = '/test/bol.png';
      const imageBuffer = Buffer.from('fake-image');
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_info: {
                document_type: 'BOL',
                bl_number: 'BL-001',
                transport_mode: 'SEA',
              },
              shipping_line: { name: 'MSC' },
              ports: {
                port_of_loading: 'Mumbai',
                port_of_discharge: 'Jebel Ali',
              },
            }),
          },
        }],
        usage: { total_tokens: 600 },
      };

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractFromBillOfLading(imagePath);

      expect(result.success).toBe(true);
      expect(result.data.document_info.bl_number).toBe('BL-001');
    });

    it('should extract from multiple images (multi-page PDF)', async () => {
      const imagePaths = ['/test/bol-1.png', '/test/bol-2.png'];
      const imageBuffers = [Buffer.from('page1'), Buffer.from('page2')];
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_info: { bl_number: 'BL-001' },
            }),
          },
        }],
        usage: { total_tokens: 800 },
      };

      mockFs.readFile
        .mockResolvedValueOnce(imageBuffers[0])
        .mockResolvedValueOnce(imageBuffers[1]);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractFromBillOfLading(imagePaths);

      expect(result.success).toBe(true);
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content.length).toBe(3); // Text + 2 images
    });

    it('should handle NOT_FOUND document type', async () => {
      const imagePath = '/test/bol.png';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              document_info: { document_type: 'NOT_FOUND' },
              error: 'No BOL found',
            }),
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await extractFromBillOfLading(imagePath);

      expect(result.success).toBe(false);
      expect(result.warnings[0]).toContain('No Bill of Lading');
    });

    it('should handle FALLBACK document type', async () => {
      const imagePath = '/test/bol.png';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              document_info: {
                document_type: 'FALLBACK',
                data_source: 'fallback',
                fallback_document_type: 'COMMERCIAL_INVOICE',
              },
              shipping_line: { name: 'MSC' },
            }),
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await extractFromBillOfLading(imagePath);

      expect(result.success).toBe(true);
      expect(result.warnings[0]).toContain('fallback');
    });
  });

  describe('extractFromCommercialInvoice', () => {
    it('should extract Commercial Invoice data', async () => {
      const imagePath = '/test/ci.png';
      const imageBuffer = Buffer.from('fake-image');
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_info: {
                document_type: 'COMMERCIAL_INVOICE',
                invoice_number: 'CI-001',
              },
              cargo_type: 'containers',
              incoterms: 'CIF',
              payment_terms: 'LC at sight',
            }),
          },
        }],
        usage: { total_tokens: 700 },
      };

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractFromCommercialInvoice(imagePath);

      expect(result.success).toBe(true);
      expect(result.data.document_info.invoice_number).toBe('CI-001');
    });

    it('should handle markdown-wrapped JSON', async () => {
      const imagePath = '/test/ci.png';
      const imageBuffer = Buffer.from('fake-image');

      mockFs.readFile.mockResolvedValueOnce(imageBuffer);
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '```json\n{"document_info": {"invoice_number": "CI-001"}}\n```',
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await extractFromCommercialInvoice(imagePath);

      expect(result.success).toBe(true);
      expect(result.data.document_info.invoice_number).toBe('CI-001');
    });
  });

  describe('checkOpenAIConnection', () => {
    it('should return true on successful connection', async () => {
      mockOpenAI.models.list.mockResolvedValueOnce({ data: [] });

      const result = await checkOpenAIConnection();

      expect(result).toBe(true);
    });

    it('should throw error if API key not configured', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(checkOpenAIConnection()).rejects.toThrow('OPENAI_API_KEY not configured');
    });

    it('should throw error on connection failure', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOpenAI.models.list.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(checkOpenAIConnection()).rejects.toThrow('Connection failed');
    });
  });

  describe('getUsageMetrics', () => {
    it('should return usage metrics', () => {
      const metrics = getUsageMetrics();

      expect(metrics).toHaveProperty('totalTokensUsed');
      expect(metrics).toHaveProperty('totalCost');
      expect(metrics).toHaveProperty('extractionCount');
      expect(metrics).toHaveProperty('avgCostPerExtraction');
    });
  });
});
