import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import {
  detectLanguage,
  translateProducts,
  translateProduct,
} from '../../services/translation';
import { pool } from '../../db/client';
import OpenAI from 'openai';

// Mock dependencies
vi.mock('../../db/client', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe('Translation Service', () => {
  const mockPool = vi.mocked(pool);
  let mockOpenAI: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenAI = new OpenAI({ apiKey: 'test-key' });
  });

  describe('detectLanguage', () => {
    it('should detect English text', () => {
      expect(detectLanguage('Hello World')).toBe('en');
      expect(detectLanguage('Product Name')).toBe('en');
      expect(detectLanguage('123 ABC')).toBe('en');
    });

    it('should detect Arabic text', () => {
      expect(detectLanguage('مرحبا')).toBe('ar');
      expect(detectLanguage('اسم المنتج')).toBe('ar');
      expect(detectLanguage('Hello مرحبا')).toBe('ar'); // Mixed with >30% Arabic
    });

    it('should default to English for empty string', () => {
      expect(detectLanguage('')).toBe('en');
    });

    it('should default to English for null/undefined', () => {
      expect(detectLanguage(null as any)).toBe('en');
      expect(detectLanguage(undefined as any)).toBe('en');
    });

    it('should detect Arabic when >30% characters are Arabic', () => {
      expect(detectLanguage('Hello مرحبا')).toBe('ar');
      expect(detectLanguage('ABC مرحبا')).toBe('ar');
    });

    it('should detect English when <30% characters are Arabic', () => {
      expect(detectLanguage('Hello World مرحبا')).toBe('en');
    });
  });

  describe('translateProducts', () => {
    it('should return empty map for empty array', async () => {
      const result = await translateProducts([], 'ar');
      expect(result.size).toBe(0);
    });

    it('should return same text if already in target language', async () => {
      const result = await translateProducts(['Hello World'], 'en');
      expect(result.size).toBe(1);
      expect(result.get('Hello World')?.translated).toBe('Hello World');
      expect(result.get('Hello World')?.cached).toBe(true);
    });

    it('should check cache before calling OpenAI', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ original_text: 'Hello', translated_text: 'مرحبا' }],
      } as any);

      const result = await translateProducts(['Hello'], 'ar');

      expect(result.size).toBe(1);
      expect(result.get('Hello')?.translated).toBe('مرحبا');
      expect(result.get('Hello')?.cached).toBe(true);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should call OpenAI for uncached texts', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [], // No cache
      } as any);

      mockPool.connect.mockResolvedValueOnce({
        query: vi.fn().mockResolvedValueOnce(undefined),
        release: vi.fn(),
      } as any);

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({ Hello: 'مرحبا' }),
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await translateProducts(['Hello'], 'ar');

      expect(result.size).toBe(1);
      expect(result.get('Hello')?.translated).toBe('مرحبا');
      expect(result.get('Hello')?.cached).toBe(false);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle multiple texts', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      mockPool.connect.mockResolvedValueOnce({
        query: vi.fn().mockResolvedValueOnce(undefined),
        release: vi.fn(),
      } as any);

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              'Hello': 'مرحبا',
              'World': 'العالم',
            }),
          },
        }],
        usage: { total_tokens: 200 },
      });

      const result = await translateProducts(['Hello', 'World'], 'ar');

      expect(result.size).toBe(2);
      expect(result.get('Hello')?.translated).toBe('مرحبا');
      expect(result.get('World')?.translated).toBe('العالم');
    });

    it('should filter out empty and null texts', async () => {
      const result = await translateProducts(['', null as any, '  ', 'Valid'], 'en');
      expect(result.size).toBe(1);
      expect(result.has('Valid')).toBe(true);
    });

    it('should deduplicate texts', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      mockPool.connect.mockResolvedValueOnce({
        query: vi.fn().mockResolvedValueOnce(undefined),
        release: vi.fn(),
      } as any);

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({ 'Hello': 'مرحبا' }),
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await translateProducts(['Hello', 'Hello', 'Hello'], 'ar');
      expect(result.size).toBe(1);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      const result = await translateProducts(['Hello'], 'ar');

      // Should return original text as fallback
      expect(result.size).toBe(1);
      expect(result.get('Hello')?.translated).toBe('Hello');
    });
  });

  describe('translateProduct', () => {
    it('should translate single text', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      mockPool.connect.mockResolvedValueOnce({
        query: vi.fn().mockResolvedValueOnce(undefined),
        release: vi.fn(),
      } as any);

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({ 'Hello': 'مرحبا' }),
          },
        }],
        usage: { total_tokens: 100 },
      });

      const result = await translateProduct('Hello', 'ar');
      expect(result).toBe('مرحبا');
    });

    it('should return empty string for null/undefined', async () => {
      expect(await translateProduct(null, 'ar')).toBe('');
      expect(await translateProduct(undefined, 'ar')).toBe('');
    });

    it('should return original for empty string', async () => {
      expect(await translateProduct('', 'ar')).toBe('');
      expect(await translateProduct('   ', 'ar')).toBe('   ');
    });
  });
});
