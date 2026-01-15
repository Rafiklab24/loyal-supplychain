/**
 * PDF Processing Utilities
 * Converts PDF documents to images for OpenAI Vision API
 */

import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';
import logger from './logger';

const execAsync = promisify(exec);

// Maximum pages to extract from a PDF (to limit API costs and processing time)
const MAX_PAGES = 10;

/**
 * Convert PDF first page to image using pdf-poppler (pdftoppm)
 * For backward compatibility with single-page extraction
 * 
 * Prerequisites:
 * - Ubuntu/Debian: sudo apt-get install poppler-utils
 * - macOS: brew install poppler
 * - Windows: Download from https://blog.alivate.com.au/poppler-windows/
 */
export async function convertPdfToImage(pdfPath: string): Promise<string> {
  const outputDir = path.dirname(pdfPath);
  const outputBase = path.basename(pdfPath, '.pdf');
  const outputPath = path.join(outputDir, `${outputBase}_page1.jpg`);

  try {
    // Use pdftoppm (from poppler-utils) to convert first page to JPEG
    // -jpeg: output format
    // -f 1 -l 1: first page to last page (page 1 only)
    // -scale-to 2048: scale to 2048 pixels (good quality for OCR)
    const command = `pdftoppm -jpeg -f 1 -l 1 -scale-to 2048 "${pdfPath}" "${path.join(outputDir, outputBase)}"`;
    
    logger.info('Converting PDF to image...');
    await execAsync(command);

    // pdftoppm outputs files with format: filename-1.jpg
    const generatedFile = path.join(outputDir, `${outputBase}-1.jpg`);
    
    // Check if file exists
    await fs.access(generatedFile);
    
    // Rename to our desired name
    await fs.rename(generatedFile, outputPath);

    logger.info(`PDF converted successfully: ${outputPath}`);
    return outputPath;
  } catch (error: any) {
    logger.error('PDF conversion error:', error);
    
    // Check if pdftoppm is installed
    if (error.message?.includes('pdftoppm') || error.code === 'ENOENT') {
      throw new Error(
        'pdftoppm not found. Please install poppler-utils:\n' +
        '  Ubuntu/Debian: sudo apt-get install poppler-utils\n' +
        '  macOS: brew install poppler\n' +
        '  Windows: https://blog.alivate.com.au/poppler-windows/'
      );
    }
    
    throw new Error(`Failed to convert PDF to image: ${error.message}`);
  }
}

/**
 * Convert ALL pages of a PDF to images for multi-document extraction
 * Returns an array of image paths
 * 
 * This is used when a PDF may contain multiple documents bundled together
 * (e.g., Commercial Invoice + Bill of Lading + Certificate of Origin)
 */
export async function convertPdfToImages(pdfPath: string, maxPages: number = MAX_PAGES): Promise<string[]> {
  const outputDir = path.dirname(pdfPath);
  const outputBase = path.basename(pdfPath, '.pdf');
  const imagePaths: string[] = [];

  try {
    // First, get the page count
    const pageCountCmd = `pdfinfo "${pdfPath}" | grep "Pages:" | awk '{print $2}'`;
    let pageCount = 1;
    
    try {
      const { stdout } = await execAsync(pageCountCmd);
      pageCount = Math.min(parseInt(stdout.trim()) || 1, maxPages);
    } catch {
      // If pdfinfo fails, default to max pages and let pdftoppm handle it
      pageCount = maxPages;
    }
    
    logger.info(`📄 Converting PDF (${pageCount} pages) to images...`);

    // Convert all pages up to maxPages
    // -jpeg: output format
    // -scale-to 1800: scale to 1800 pixels (good balance between quality and file size)
    const command = `pdftoppm -jpeg -f 1 -l ${pageCount} -scale-to 1800 "${pdfPath}" "${path.join(outputDir, outputBase)}"`;
    
    await execAsync(command);

    // Find all generated files
    const files = await fs.readdir(outputDir);
    const pageFiles = files
      .filter(f => f.startsWith(outputBase) && f.endsWith('.jpg') && f.match(/-\d+\.jpg$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/-(\d+)\.jpg$/)?.[1] || '0');
        const numB = parseInt(b.match(/-(\d+)\.jpg$/)?.[1] || '0');
        return numA - numB;
      });

    for (const file of pageFiles) {
      imagePaths.push(path.join(outputDir, file));
    }

    logger.info(`✅ Converted ${imagePaths.length} pages to images`);
    return imagePaths;
  } catch (error: any) {
    logger.error('PDF conversion error:', error);
    
    // Check if pdftoppm is installed
    if (error.message?.includes('pdftoppm') || error.code === 'ENOENT') {
      throw new Error(
        'pdftoppm not found. Please install poppler-utils:\n' +
        '  Ubuntu/Debian: sudo apt-get install poppler-utils\n' +
        '  macOS: brew install poppler\n' +
        '  Windows: https://blog.alivate.com.au/poppler-windows/'
      );
    }
    
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
}

/**
 * Clean up multiple image files
 */
export async function cleanupImages(imagePaths: string[]): Promise<void> {
  for (const imagePath of imagePaths) {
    try {
      await fs.unlink(imagePath);
    } catch (err) {
      logger.warn(`Failed to cleanup image: ${imagePath}`, err);
    }
  }
}

/**
 * Check if pdftoppm is available
 */
export async function checkPdfToolsAvailable(): Promise<boolean> {
  try {
    await execAsync('pdftoppm -v');
    return true;
  } catch {
    return false;
  }
}

