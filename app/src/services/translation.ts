/**
 * Product Translation Service
 * Translates product names between English and Arabic using OpenAI with database caching
 */

import OpenAI from 'openai';
import pool from '../db/client';
import logger from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(process.env.OPENAI_ORGANIZATION_ID && { organization: process.env.OPENAI_ORGANIZATION_ID }),
});

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: 'en' | 'ar';
  targetLang: 'en' | 'ar';
  cached: boolean;
}

/**
 * Detect if text is primarily Arabic or English
 */
export function detectLanguage(text: string): 'ar' | 'en' {
  if (!text) return 'en';
  
  // Count Arabic characters (Unicode range for Arabic)
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  
  // If more than 30% Arabic characters, consider it Arabic
  return totalChars > 0 && (arabicChars / totalChars) > 0.3 ? 'ar' : 'en';
}

/**
 * Check database cache for existing translations
 */
async function getCachedTranslations(
  texts: string[],
  targetLang: 'ar' | 'en'
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  
  if (texts.length === 0) return cache;
  
  try {
    // Query for all texts at once
    const placeholders = texts.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `SELECT original_text, translated_text 
       FROM master_data.product_translations 
       WHERE original_text IN (${placeholders}) 
       AND target_lang = $${texts.length + 1}`,
      [...texts, targetLang]
    );
    
    for (const row of result.rows) {
      cache.set(row.original_text, row.translated_text);
    }
  } catch (error) {
    logger.error('Error fetching cached translations:', error);
  }
  
  return cache;
}

/**
 * Save translations to database cache
 */
async function saveCachedTranslations(
  translations: Array<{ original: string; translated: string; sourceLang: string; targetLang: string }>
): Promise<void> {
  if (translations.length === 0) return;
  
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const t of translations) {
        await client.query(
          `INSERT INTO master_data.product_translations 
           (original_text, source_lang, target_lang, translated_text)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (original_text, source_lang, target_lang) 
           DO UPDATE SET translated_text = EXCLUDED.translated_text`,
          [t.original, t.sourceLang, t.targetLang, t.translated]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error saving translations to cache:', error);
  }
}

/**
 * Translate product names using OpenAI
 */
async function translateWithOpenAI(
  texts: string[],
  sourceLang: 'ar' | 'en',
  targetLang: 'ar' | 'en'
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  if (texts.length === 0) return results;
  
  // Build prompt for OpenAI
  const targetLangName = targetLang === 'ar' ? 'Arabic' : 'English';
  const sourceLangName = sourceLang === 'ar' ? 'Arabic' : 'English';
  
  const prompt = `You are a professional translator specializing in international trade and commodity products.

Translate the following product names from ${sourceLangName} to ${targetLangName}.

IMPORTANT RULES:
1. Translate commodity/product names (rice, sugar, pepper, etc.) to their ${targetLangName} equivalents
2. PRESERVE technical specifications, codes, grades, and numbers exactly as they are (e.g., "T5 170-180", "25/29", "550 GL", "100D/36F")
3. PRESERVE brand names and trademarks in their original form
4. If a product name is already in the target language, return it as-is
5. For mixed content, translate what can be translated and keep the rest
6. Keep packaging specifications like "25KG", "50G", "BAGS", "CTNS" in their original form or translate to common abbreviations

Input (JSON array of product names):
${JSON.stringify(texts)}

Respond with a JSON object where keys are the original texts and values are the translations.
Example response format:
{"White Sugar packed in 50 kg": "سكر أبيض معبأ في 50 كغ", "BLACK PEPPER 550 GL": "فلفل أسود 550 GL"}

Only respond with the JSON object, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Use mini for cost efficiency
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.error('No content in OpenAI translation response');
      return results;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('No JSON found in translation response:', content);
      return results;
    }

    const translations = JSON.parse(jsonMatch[0]);
    
    for (const original of texts) {
      if (translations[original]) {
        results.set(original, translations[original]);
      }
    }
    
    // Log usage for monitoring
    if (response.usage) {
      logger.info(`Translation API: ${texts.length} texts, ${response.usage.total_tokens} tokens`);
    }
    
  } catch (error) {
    logger.error('OpenAI translation error:', error);
  }
  
  return results;
}

/**
 * Main translation function - translates product names with caching
 */
export async function translateProducts(
  texts: string[],
  targetLang: 'ar' | 'en'
): Promise<Map<string, TranslationResult>> {
  const results = new Map<string, TranslationResult>();
  
  // Filter out empty/null texts and deduplicate
  const uniqueTexts = [...new Set(texts.filter(t => t && t.trim()))];
  
  if (uniqueTexts.length === 0) return results;
  
  // Separate texts by whether they need translation
  const textsToTranslate: string[] = [];
  
  for (const text of uniqueTexts) {
    const sourceLang = detectLanguage(text);
    
    // If text is already in target language, no translation needed
    if (sourceLang === targetLang) {
      results.set(text, {
        original: text,
        translated: text,
        sourceLang,
        targetLang,
        cached: true, // Not actually cached, but no API call needed
      });
    } else {
      textsToTranslate.push(text);
    }
  }
  
  if (textsToTranslate.length === 0) return results;
  
  // Check cache first
  const cachedTranslations = await getCachedTranslations(textsToTranslate, targetLang);
  
  const uncachedTexts: string[] = [];
  
  for (const text of textsToTranslate) {
    const cached = cachedTranslations.get(text);
    if (cached) {
      const sourceLang = detectLanguage(text);
      results.set(text, {
        original: text,
        translated: cached,
        sourceLang,
        targetLang,
        cached: true,
      });
    } else {
      uncachedTexts.push(text);
    }
  }
  
  // Translate uncached texts with OpenAI
  if (uncachedTexts.length > 0) {
    // Group by source language for more accurate translation
    const englishTexts = uncachedTexts.filter(t => detectLanguage(t) === 'en');
    const arabicTexts = uncachedTexts.filter(t => detectLanguage(t) === 'ar');
    
    const translationsToCache: Array<{ original: string; translated: string; sourceLang: string; targetLang: string }> = [];
    
    // Translate English to Arabic
    if (englishTexts.length > 0 && targetLang === 'ar') {
      const translations = await translateWithOpenAI(englishTexts, 'en', 'ar');
      for (const [original, translated] of translations) {
        results.set(original, {
          original,
          translated,
          sourceLang: 'en',
          targetLang: 'ar',
          cached: false,
        });
        translationsToCache.push({ original, translated, sourceLang: 'en', targetLang: 'ar' });
      }
      
      // For any text that wasn't translated, use original
      for (const text of englishTexts) {
        if (!results.has(text)) {
          results.set(text, {
            original: text,
            translated: text, // Fallback to original
            sourceLang: 'en',
            targetLang: 'ar',
            cached: false,
          });
        }
      }
    }
    
    // Translate Arabic to English
    if (arabicTexts.length > 0 && targetLang === 'en') {
      const translations = await translateWithOpenAI(arabicTexts, 'ar', 'en');
      for (const [original, translated] of translations) {
        results.set(original, {
          original,
          translated,
          sourceLang: 'ar',
          targetLang: 'en',
          cached: false,
        });
        translationsToCache.push({ original, translated, sourceLang: 'ar', targetLang: 'en' });
      }
      
      // For any text that wasn't translated, use original
      for (const text of arabicTexts) {
        if (!results.has(text)) {
          results.set(text, {
            original: text,
            translated: text, // Fallback to original
            sourceLang: 'ar',
            targetLang: 'en',
            cached: false,
          });
        }
      }
    }
    
    // Save new translations to cache (fire and forget)
    if (translationsToCache.length > 0) {
      saveCachedTranslations(translationsToCache).catch(err => {
        logger.error('Failed to cache translations:', err);
      });
    }
  }
  
  return results;
}

/**
 * Simple single-text translation (convenience wrapper)
 */
export async function translateProduct(
  text: string | null | undefined,
  targetLang: 'ar' | 'en'
): Promise<string> {
  if (!text || !text.trim()) return text || '';
  
  const results = await translateProducts([text], targetLang);
  const result = results.get(text);
  
  return result?.translated || text;
}

