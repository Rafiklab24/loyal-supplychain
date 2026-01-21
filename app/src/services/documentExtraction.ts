/**
 * Document Extraction Service
 * Orchestrates PDF conversion and OpenAI Vision extraction
 */

import { extractFromProformaInvoice, extractFromBillOfLading, extractFromCommercialInvoice } from './openai';
import { convertPdfToImage, convertPdfToImages, cleanupImages } from '../utils/pdfProcessor';
import { saveTrainingData } from '../utils/dataCollector';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger';

interface ExtractionOptions {
  collectTrainingData?: boolean;
  userId?: string;
}

interface ExtractionResult {
  success: boolean;
  data: any;
  confidence: number;
  warnings: string[];
  processingTime: number;
  trainingDataId?: string | null;
  tokensUsed?: number;
  estimatedCost?: number;
}

/**
 * Process a proforma document (PDF or image)
 * Main entry point for document extraction
 */
export async function processProformaDocument(
  filePath: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { collectTrainingData = true, userId } = options;

  let imagePath = filePath;
  let wasConverted = false;
  const startTime = Date.now();

  try {
    logger.info(`📄 Processing document: ${path.basename(filePath)}`);

    // If PDF, convert to image first
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      logger.info('📋 Converting PDF to image...');
      imagePath = await convertPdfToImage(filePath);
      wasConverted = true;
      logger.info('✅ PDF converted successfully');
    }

    // Extract data using OpenAI Vision
    logger.info('🤖 Extracting data with OpenAI Vision...');
    const result = await extractFromProformaInvoice(imagePath);

    if (!result.success) {
      throw new Error(result.warnings[0] || 'Extraction failed');
    }

    logger.info(`✅ Extraction complete! Confidence: ${result.confidence}%`);

    // Collect training data if enabled
    let trainingDataId: string | null = null;
    if (collectTrainingData && result.success) {
      logger.info('💾 Saving training data...');
      trainingDataId = await saveTrainingData({
        originalFile: filePath,
        extractedData: result.data,
        confidence: result.confidence,
        processingTime: result.processingTime,
        userId,
        timestamp: new Date().toISOString(),
      });
      if (trainingDataId) {
        logger.info(`✅ Training data saved: ${trainingDataId}`);
      }
    }

    // Cleanup temporary image if we converted from PDF
    if (wasConverted) {
      await fs.unlink(imagePath).catch(err => 
        logger.warn('Warning: Failed to cleanup temp image:', err.message)
      );
    }

    const totalTime = Date.now() - startTime;
    logger.info(`⏱️ Total processing time: ${totalTime}ms`);

    return {
      success: true,
      data: result.data,
      confidence: result.confidence,
      warnings: result.warnings,
      processingTime: totalTime,
      trainingDataId,
      tokensUsed: result.tokensUsed,
      estimatedCost: result.estimatedCost,
    };
  } catch (error: any) {
    logger.error('❌ Document processing error:', error);
    
    // Cleanup on error
    if (wasConverted && imagePath !== filePath) {
      await fs.unlink(imagePath).catch(() => {});
    }

    return {
      success: false,
      data: null,
      confidence: 0,
      warnings: [error.message || 'Unknown error occurred'],
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Process a Bill of Lading or CMR document (PDF or image)
 * Main entry point for BOL document extraction
 * 
 * Note: Supports multi-page PDFs where the BOL might be bundled with other documents
 * (Certificate of Origin, Packing List, etc.). The AI will identify and extract
 * only from the BOL pages.
 */
export async function processBOLDocument(
  filePath: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { collectTrainingData = true, userId } = options;

  let imagePaths: string[] = [];
  let wasConverted = false;
  const startTime = Date.now();

  try {
    logger.info(`📄 Processing BOL document: ${path.basename(filePath)}`);

    // If PDF, convert ALL pages to images (for multi-document PDFs)
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      logger.info('📋 Converting PDF pages to images (may contain multiple documents)...');
      imagePaths = await convertPdfToImages(filePath);
      wasConverted = true;
      logger.info(`✅ PDF converted: ${imagePaths.length} pages`);
    } else {
      // Single image file
      imagePaths = [filePath];
    }

    // Extract data using OpenAI Vision (pass all pages for multi-document detection)
    logger.info('🤖 Extracting BOL data with OpenAI Vision...');
    const result = await extractFromBillOfLading(imagePaths.length === 1 ? imagePaths[0] : imagePaths);

    if (!result.success) {
      throw new Error(result.warnings[0] || 'Extraction failed');
    }

    logger.info(`✅ BOL extraction complete! Confidence: ${result.confidence}%`);

    // Collect training data if enabled
    let trainingDataId: string | null = null;
    if (collectTrainingData && result.success) {
      logger.info('💾 Saving BOL training data...');
      trainingDataId = await saveTrainingData({
        originalFile: filePath,
        extractedData: result.data,
        confidence: result.confidence,
        processingTime: result.processingTime,
        userId,
        timestamp: new Date().toISOString(),
      });
      if (trainingDataId) {
        logger.info(`✅ BOL training data saved: ${trainingDataId}`);
      }
    }

    // Cleanup temporary images if we converted from PDF
    if (wasConverted && imagePaths.length > 0) {
      await cleanupImages(imagePaths);
    }

    const totalTime = Date.now() - startTime;
    logger.info(`⏱️ Total BOL processing time: ${totalTime}ms`);

    return {
      success: true,
      data: result.data,
      confidence: result.confidence,
      warnings: result.warnings,
      processingTime: totalTime,
      trainingDataId,
      tokensUsed: result.tokensUsed,
      estimatedCost: result.estimatedCost,
    };
  } catch (error: any) {
    logger.error('❌ BOL document processing error:', error);
    
    // Cleanup on error
    if (wasConverted && imagePaths.length > 0) {
      await cleanupImages(imagePaths);
    }

    return {
      success: false,
      data: null,
      confidence: 0,
      warnings: [error.message || 'Unknown error occurred'],
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Process a Commercial Invoice document (PDF or image)
 * Main entry point for Commercial Invoice extraction for shipments
 * 
 * Note: Supports multi-page PDFs where the Commercial Invoice might be bundled
 * with other documents (BOL, Certificate of Origin, Packing List, etc.).
 * The AI will identify and extract only from the Commercial Invoice pages.
 */
export async function processCommercialInvoiceDocument(
  filePath: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const { collectTrainingData = true, userId } = options;

  let imagePaths: string[] = [];
  let wasConverted = false;
  const startTime = Date.now();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0351c484-bc79-48a7-8b30-3870c2e1206d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'documentExtraction.ts:processCI:start',message:'processCommercialInvoiceDocument started',data:{filePath,isPdf:path.extname(filePath).toLowerCase()==='.pdf'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  try {
    logger.info(`📄 Processing Commercial Invoice: ${path.basename(filePath)}`);

    // If PDF, convert ALL pages to images (for multi-document PDFs)
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      logger.info('📋 Converting PDF pages to images (may contain multiple documents)...');
      // #region agent log
      const pdfConversionStart = Date.now();
      fetch('http://127.0.0.1:7242/ingest/0351c484-bc79-48a7-8b30-3870c2e1206d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'documentExtraction.ts:processCI:pdf-conversion-start',message:'Starting PDF to images conversion',data:{elapsed:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      imagePaths = await convertPdfToImages(filePath);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0351c484-bc79-48a7-8b30-3870c2e1206d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'documentExtraction.ts:processCI:pdf-conversion-end',message:'PDF conversion completed',data:{elapsed:Date.now()-startTime,conversionTime:Date.now()-pdfConversionStart,pageCount:imagePaths.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      wasConverted = true;
      logger.info(`✅ PDF converted: ${imagePaths.length} pages`);
    } else {
      // Single image file
      imagePaths = [filePath];
    }

    // Extract data using OpenAI Vision (pass all pages for multi-document detection)
    logger.info('🤖 Extracting Commercial Invoice data with OpenAI Vision...');
    // #region agent log
    const openaiStart = Date.now();
    fetch('http://127.0.0.1:7242/ingest/0351c484-bc79-48a7-8b30-3870c2e1206d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'documentExtraction.ts:processCI:openai-start',message:'Starting OpenAI Vision extraction',data:{elapsed:Date.now()-startTime,pageCount:imagePaths.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const result = await extractFromCommercialInvoice(imagePaths.length === 1 ? imagePaths[0] : imagePaths);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0351c484-bc79-48a7-8b30-3870c2e1206d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'documentExtraction.ts:processCI:openai-end',message:'OpenAI Vision extraction completed',data:{elapsed:Date.now()-startTime,openaiTime:Date.now()-openaiStart,success:result.success,confidence:result.confidence},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!result.success) {
      throw new Error(result.warnings[0] || 'Extraction failed');
    }

    logger.info(`✅ Commercial Invoice extraction complete! Confidence: ${result.confidence}%`);

    // Collect training data if enabled
    let trainingDataId: string | null = null;
    if (collectTrainingData && result.success) {
      logger.info('💾 Saving Commercial Invoice training data...');
      trainingDataId = await saveTrainingData({
        originalFile: filePath,
        extractedData: result.data,
        confidence: result.confidence,
        processingTime: result.processingTime,
        userId,
        timestamp: new Date().toISOString(),
      });
      if (trainingDataId) {
        logger.info(`✅ Commercial Invoice training data saved: ${trainingDataId}`);
      }
    }

    // Cleanup temporary images if we converted from PDF
    if (wasConverted && imagePaths.length > 0) {
      await cleanupImages(imagePaths);
    }

    const totalTime = Date.now() - startTime;
    logger.info(`⏱️ Total Commercial Invoice processing time: ${totalTime}ms`);

    return {
      success: true,
      data: result.data,
      confidence: result.confidence,
      warnings: result.warnings,
      processingTime: totalTime,
      trainingDataId,
      tokensUsed: result.tokensUsed,
      estimatedCost: result.estimatedCost,
    };
  } catch (error: any) {
    logger.error('❌ Commercial Invoice processing error:', error);
    
    // Cleanup on error
    if (wasConverted && imagePaths.length > 0) {
      await cleanupImages(imagePaths);
    }

    return {
      success: false,
      data: null,
      confidence: 0,
      warnings: [error.message || 'Unknown error occurred'],
      processingTime: Date.now() - startTime,
    };
  }
}

