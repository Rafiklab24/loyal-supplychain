/**
 * Training Data Collection Utility
 * Saves extraction results for future local model training
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

interface TrainingDataEntry {
  originalFile: string;
  extractedData: any;
  confidence: number;
  processingTime: number;
  userId?: string;
  timestamp: string;
}

/**
 * Save extraction result for future model training
 * Creates a structured directory with:
 * - Original document
 * - Extraction results
 * - Metadata
 * - Placeholder for user corrections
 */
export async function saveTrainingData(entry: TrainingDataEntry): Promise<string | null> {
  if (process.env.ENABLE_DATA_COLLECTION !== 'true') {
    logger.info('Data collection disabled');
    return null;
  }

  const trainingDir = process.env.TRAINING_DATA_DIR || './training_data';
  const entryId = uuidv4();
  const entryDir = path.join(trainingDir, entryId);

  try {
    // Create entry directory
    await fs.mkdir(entryDir, { recursive: true });

    // Copy original file
    const originalExt = path.extname(entry.originalFile);
    const originalDest = path.join(entryDir, `original${originalExt}`);
    await fs.copyFile(entry.originalFile, originalDest);

    // Save extracted data
    const extractionPath = path.join(entryDir, 'extraction.json');
    await fs.writeFile(
      extractionPath,
      JSON.stringify(entry.extractedData, null, 2)
    );

    // Save metadata
    const metadataPath = path.join(entryDir, 'metadata.json');
    await fs.writeFile(
      metadataPath,
      JSON.stringify({
        id: entryId,
        confidence: entry.confidence,
        processingTime: entry.processingTime,
        userId: entry.userId,
        timestamp: entry.timestamp,
        originalFileName: path.basename(entry.originalFile),
      }, null, 2)
    );

    // Create placeholder for user corrections
    const correctionsPath = path.join(entryDir, 'corrections.json');
    await fs.writeFile(
      correctionsPath,
      JSON.stringify({
        note: 'User corrections will be saved here after review',
        corrections: {},
        finalData: null,
      }, null, 2)
    );

    logger.info(`✅ Training data saved: ${entryId}`);
    return entryId;
  } catch (error: any) {
    logger.error('❌ Error saving training data:', error);
    // Don't throw - we don't want to fail the main extraction
    return null;
  }
}

/**
 * Calculate field-level diffs between original and corrected data
 */
function calculateFieldDiffs(originalData: any, correctedData: any): any[] {
  const diffs: any[] = [];

  // Compare product lines (most important)
  if (originalData.product_lines && correctedData.product_lines) {
    for (let i = 0; i < Math.max(originalData.product_lines.length, correctedData.product_lines.length); i++) {
      const original = originalData.product_lines[i] || {};
      const corrected = correctedData.product_lines[i] || {};

      const lineDiffs: any = {
        lineIndex: i,
        changes: [],
      };

      // Check each field
      const fields = ['type_of_goods', 'unit_size', 'number_of_packages', 'quantity_mt', 'rate_per_mt', 'amount'];
      for (const field of fields) {
        if (original[field] !== corrected[field]) {
          lineDiffs.changes.push({
            field,
            original: original[field],
            corrected: corrected[field],
          });
        }
      }

      if (lineDiffs.changes.length > 0) {
        diffs.push(lineDiffs);
      }
    }
  }

  return diffs;
}

/**
 * Categorize errors based on the types of corrections made
 */
function categorizeErrors(diffs: any[]): string[] {
  const categories = new Set<string>();

  for (const diff of diffs) {
    for (const change of diff.changes) {
      switch (change.field) {
        case 'unit_size':
          categories.add('package_size_error');
          break;
        case 'number_of_packages':
          categories.add('package_count_error');
          break;
        case 'quantity_mt':
          categories.add('quantity_error');
          break;
        case 'amount':
          categories.add('amount_calculation_error');
          break;
        case 'rate_per_mt':
          categories.add('rate_error');
          break;
        case 'type_of_goods':
          categories.add('product_description_error');
          break;
      }
    }
  }

  return Array.from(categories);
}

/**
 * Update training data with user corrections
 * This is crucial for improving future models!
 */
export async function saveUserCorrections(
  entryId: string,
  corrections: any,
  finalData: any
): Promise<void> {
  const trainingDir = process.env.TRAINING_DATA_DIR || './training_data';
  const entryDir = path.join(trainingDir, entryId);
  const correctionsPath = path.join(entryDir, 'corrections.json');
  const extractionPath = path.join(entryDir, 'extraction.json');

  try {
    // Check if entry exists
    await fs.access(entryDir);

    // Read original extraction for comparison
    let originalData: any = null;
    try {
      const extractionContent = await fs.readFile(extractionPath, 'utf-8');
      originalData = JSON.parse(extractionContent);
    } catch (error) {
      logger.warn('Could not read original extraction for diff calculation');
    }

    // Calculate field-level diffs
    const fieldDiffs = originalData ? calculateFieldDiffs(originalData, finalData) : [];
    
    // Categorize errors
    const errorCategories = categorizeErrors(fieldDiffs);

    // Save enhanced corrections
    await fs.writeFile(
      correctionsPath,
      JSON.stringify({
        corrections,
        finalData,
        timestamp: new Date().toISOString(),
        fieldDiffs,
        errorCategories,
        metadata: {
          totalChanges: fieldDiffs.reduce((sum, diff) => sum + diff.changes.length, 0),
          primaryErrors: errorCategories,
          correctionQuality: fieldDiffs.length > 0 ? 'user_verified' : 'unchanged',
        },
      }, null, 2)
    );

    logger.info(`✅ User corrections saved for: ${entryId}`);
    logger.info(`   - Total changes: ${fieldDiffs.reduce((sum, diff) => sum + diff.changes.length, 0)}`);
    logger.info(`   - Error categories: ${errorCategories.join(', ')}`);
  } catch (error: any) {
    logger.error('❌ Error saving user corrections:', error);
    throw new Error(`Failed to save corrections: ${error.message}`);
  }
}

/**
 * Get statistics on collected training data
 */
export async function getTrainingDataStats(): Promise<any> {
  const trainingDir = process.env.TRAINING_DATA_DIR || './training_data';

  try {
    const entries = await fs.readdir(trainingDir);
    
    let totalEntries = 0;
    let withCorrections = 0;
    let avgConfidence = 0;
    let totalProcessingTime = 0;

    for (const entryId of entries) {
      const metadataPath = path.join(trainingDir, entryId, 'metadata.json');
      const correctionsPath = path.join(trainingDir, entryId, 'corrections.json');

      try {
        // Read metadata
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        totalEntries++;
        avgConfidence += metadata.confidence;
        totalProcessingTime += metadata.processingTime;

        // Check if corrections exist
        const corrections = JSON.parse(await fs.readFile(correctionsPath, 'utf-8'));
        if (corrections.finalData) {
          withCorrections++;
        }
      } catch {
        // Skip invalid entries
      }
    }

    return {
      totalEntries,
      withCorrections,
      avgConfidence: totalEntries > 0 ? Math.round(avgConfidence / totalEntries) : 0,
      avgProcessingTime: totalEntries > 0 ? Math.round(totalProcessingTime / totalEntries) : 0,
      correctionRate: totalEntries > 0 ? Math.round((withCorrections / totalEntries) * 100) : 0,
    };
  } catch (error: any) {
    logger.error('Error getting training data stats:', error);
    return {
      totalEntries: 0,
      withCorrections: 0,
      avgConfidence: 0,
      avgProcessingTime: 0,
      correctionRate: 0,
    };
  }
}

