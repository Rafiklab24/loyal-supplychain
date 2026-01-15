import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import {
  sanitizeFilename,
  generateFilename,
  buildFolderPath,
  ensureFolderExists,
  saveFile,
  archiveDocument,
  deleteFile,
  readFile,
  getFileStats,
  EntityType,
} from '../../services/fileStorage';

// Mock fs module
vi.mock('fs/promises');
vi.mock('../../db/client', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('File Storage Service', () => {
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeFilename', () => {
    it('should sanitize filename with spaces', () => {
      expect(sanitizeFilename('test file.pdf')).toBe('test_file.pdf');
    });

    it('should remove special characters', () => {
      expect(sanitizeFilename('test@file#123.pdf')).toBe('testfile123.pdf');
    });

    it('should preserve Arabic characters', () => {
      expect(sanitizeFilename('ملف_اختبار.pdf')).toBe('ملف_اختبار.pdf');
    });

    it('should preserve hyphens and underscores', () => {
      expect(sanitizeFilename('test-file_name.pdf')).toBe('test-file_name.pdf');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(150) + '.pdf';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(104); // 100 chars + .pdf
    });

    it('should lowercase extension', () => {
      expect(sanitizeFilename('test.PDF')).toBe('test.pdf');
      expect(sanitizeFilename('test.JPG')).toBe('test.jpg');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with prefix and date', () => {
      const date = new Date('2024-01-15');
      const result = generateFilename('proforma_invoice', 'original.pdf', false, date);
      expect(result).toMatch(/^PI_2024-01-15_original\.pdf$/);
    });

    it('should add draft suffix when isDraft is true', () => {
      const result = generateFilename('bill_of_lading', 'test.pdf', true);
      expect(result).toMatch(/_draft_/);
    });

    it('should use current date when customDate not provided', () => {
      const result = generateFilename('commercial_invoice', 'test.pdf');
      const today = new Date().toISOString().split('T')[0];
      expect(result).toContain(today);
    });

    it('should use DOC prefix for unknown doc type', () => {
      const result = generateFilename('unknown_type', 'test.pdf');
      expect(result).toMatch(/^DOC_/);
    });

    it('should sanitize original filename', () => {
      const result = generateFilename('proforma_invoice', 'test file@123.pdf');
      expect(result).toContain('test_file123');
    });
  });

  describe('buildFolderPath', () => {
    it('should build shipment folder path', async () => {
      const result = await buildFolderPath('shipment', 'SN-001', 2024);
      expect(result).toContain('shipments');
      expect(result).toContain('2024');
      expect(result).toContain('SN-001');
      expect(result).toContain('docs');
    });

    it('should build contract folder path', async () => {
      const result = await buildFolderPath('contract', 'CT-001', 2024);
      expect(result).toContain('contracts');
      expect(result).toContain('2024');
      expect(result).toContain('CT-001');
    });

    it('should build finance folder path', async () => {
      const result = await buildFolderPath('finance', 'TXN-001', 2024);
      expect(result).toContain('finance');
      expect(result).toContain('2024');
    });

    it('should build customs folder path', async () => {
      const result = await buildFolderPath('customs', 'BATCH-001', 2024);
      expect(result).toContain('customs');
      expect(result).toContain('2024');
    });

    it('should build company folder path', async () => {
      const result = await buildFolderPath('company', 'Company Name');
      expect(result).toContain('companies');
      expect(result).toContain('Company_Name');
    });

    it('should use current year when year not provided', async () => {
      const result = await buildFolderPath('shipment', 'SN-001');
      const currentYear = new Date().getFullYear();
      expect(result).toContain(String(currentYear));
    });
  });

  describe('ensureFolderExists', () => {
    it('should create folder if it does not exist', async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      
      await ensureFolderExists('/test/path');
      
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/path', { recursive: true });
    });

    it('should not throw if folder already exists', async () => {
      const error = new Error('Folder exists');
      (error as any).code = 'EEXIST';
      mockFs.mkdir.mockRejectedValueOnce(error);
      
      await expect(ensureFolderExists('/test/path')).resolves.not.toThrow();
    });

    it('should throw if mkdir fails with non-EEXIST error', async () => {
      const error = new Error('Permission denied');
      (error as any).code = 'EACCES';
      mockFs.mkdir.mockRejectedValueOnce(error);
      
      await expect(ensureFolderExists('/test/path')).rejects.toThrow('Permission denied');
    });
  });

  describe('saveFile', () => {
    it('should save file and return path', async () => {
      const buffer = Buffer.from('test content');
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Not found')); // File doesn't exist
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const result = await saveFile(
        buffer,
        'shipment',
        'SN-001',
        'proforma_invoice',
        'test.pdf',
        false,
        2024
      );

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('filename');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should add counter if file exists', async () => {
      const buffer = Buffer.from('test content');
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      // First file exists, second doesn't
      mockFs.access
        .mockResolvedValueOnce(undefined) // File exists
        .mockRejectedValueOnce(new Error('Not found')); // Counter version doesn't exist
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const result = await saveFile(
        buffer,
        'shipment',
        'SN-001',
        'proforma_invoice',
        'test.pdf'
      );

      expect(result.filename).toContain('_1');
    });
  });

  describe('archiveDocument', () => {
    it('should move file to archive folder', async () => {
      const currentPath = '/test/path/file.pdf';
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.rename.mockResolvedValueOnce(undefined);

      const result = await archiveDocument(currentPath, 2);

      expect(result).toContain('archive');
      expect(result).toContain('_v2');
      expect(mockFs.rename).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should permanently delete file when permanent is true', async () => {
      mockFs.unlink.mockResolvedValueOnce(undefined);

      await deleteFile('/test/path/file.pdf', true);

      expect(mockFs.unlink).toHaveBeenCalledWith('/test/path/file.pdf');
    });

    it('should move to archive when permanent is false', async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.rename.mockResolvedValueOnce(undefined);

      await deleteFile('/test/path/file.pdf', false);

      expect(mockFs.rename).toHaveBeenCalled();
      expect(mockFs.rename.mock.calls[0][1]).toContain('DELETED_');
    });
  });

  describe('readFile', () => {
    it('should read file and return buffer', async () => {
      const buffer = Buffer.from('test content');
      mockFs.readFile.mockResolvedValueOnce(buffer);

      const result = await readFile('/test/path/file.pdf');

      expect(result).toEqual(buffer);
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/path/file.pdf');
    });
  });

  describe('getFileStats', () => {
    it('should return file stats', async () => {
      const mockStats = {
        size: 1024,
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02'),
      };
      mockFs.stat.mockResolvedValueOnce(mockStats as any);

      const result = await getFileStats('/test/path/file.pdf');

      expect(result).toEqual({
        size: 1024,
        createdAt: mockStats.birthtime,
        modifiedAt: mockStats.mtime,
      });
    });
  });
});
