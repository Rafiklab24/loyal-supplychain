/**
 * Translation API Routes
 * Provides product name translation between English and Arabic
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { translateProducts, detectLanguage, TranslationResult } from '../services/translation';

const router = Router();

// Apply auth to all routes
router.use(authenticateToken);

/**
 * POST /api/translate/products
 * Translate an array of product names to the target language
 * 
 * Request body:
 * {
 *   texts: string[],      // Array of product names to translate
 *   targetLang: 'ar' | 'en'  // Target language
 * }
 * 
 * Response:
 * {
 *   translations: {
 *     [original: string]: {
 *       translated: string,
 *       sourceLang: 'ar' | 'en',
 *       cached: boolean
 *     }
 *   },
 *   stats: {
 *     total: number,
 *     translated: number,
 *     cached: number,
 *     skipped: number
 *   }
 * }
 */
router.post('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { texts, targetLang } = req.body;
    
    // Validate input
    if (!Array.isArray(texts)) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'texts must be an array of strings' 
      });
    }
    
    if (!targetLang || !['ar', 'en'].includes(targetLang)) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'targetLang must be "ar" or "en"' 
      });
    }
    
    // Limit batch size to prevent abuse
    const maxBatchSize = 100;
    const textsToTranslate = texts.slice(0, maxBatchSize);
    
    // Translate
    const results = await translateProducts(textsToTranslate, targetLang);
    
    // Convert Map to object for JSON response
    const translations: Record<string, { translated: string; sourceLang: string; cached: boolean }> = {};
    let cachedCount = 0;
    let translatedCount = 0;
    let skippedCount = 0;
    
    for (const [original, result] of results) {
      translations[original] = {
        translated: result.translated,
        sourceLang: result.sourceLang,
        cached: result.cached,
      };
      
      if (result.cached) cachedCount++;
      if (result.translated !== original) translatedCount++;
      else skippedCount++;
    }
    
    res.json({
      translations,
      stats: {
        total: textsToTranslate.length,
        translated: translatedCount,
        cached: cachedCount,
        skipped: skippedCount,
      },
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/translate/detect
 * Detect the language of a text string
 * 
 * Query params:
 * - text: string to analyze
 * 
 * Response:
 * { language: 'ar' | 'en' }
 */
router.get('/detect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.query;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'text query parameter is required' 
      });
    }
    
    const language = detectLanguage(text);
    
    res.json({ language });
    
  } catch (error) {
    next(error);
  }
});

export default router;

