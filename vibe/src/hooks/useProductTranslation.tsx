/**
 * Product Translation Hook
 * Provides translation functionality for product names with caching
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../config/api';

interface TranslationResponse {
  translations: Record<string, {
    translated: string;
    sourceLang: 'ar' | 'en';
    cached: boolean;
  }>;
  stats: {
    total: number;
    translated: number;
    cached: number;
    skipped: number;
  };
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
 * Fetch translations from the API
 */
async function fetchTranslations(
  texts: string[],
  targetLang: 'ar' | 'en',
  token: string | null
): Promise<TranslationResponse> {
  if (!token || texts.length === 0) {
    return { 
      translations: {}, 
      stats: { total: 0, translated: 0, cached: 0, skipped: 0 } 
    };
  }

  const response = await fetch(`${API_BASE_URL}/translate/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ texts, targetLang }),
  });

  if (!response.ok) {
    throw new Error('Translation request failed');
  }

  return response.json();
}

/**
 * Hook to translate a single product name
 * Returns the translated text or the original if translation not needed/available
 */
export function useProductTranslation(productText: string | null | undefined): string {
  const { i18n } = useTranslation();
  const targetLang = i18n.language === 'ar' ? 'ar' : 'en';
  const token = localStorage.getItem('auth_token');
  
  // Only fetch if we have text and it's in a different language
  const needsTranslation = useMemo(() => {
    if (!productText || !productText.trim()) return false;
    const sourceLang = detectLanguage(productText);
    return sourceLang !== targetLang;
  }, [productText, targetLang]);

  const { data } = useQuery({
    queryKey: ['product-translation', productText, targetLang],
    queryFn: () => fetchTranslations([productText!], targetLang, token),
    enabled: needsTranslation && !!productText,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - translations don't change
    gcTime: 7 * 24 * 60 * 60 * 1000, // Keep in cache for 7 days
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (!productText) return '';
  if (!needsTranslation) return productText;
  
  return data?.translations[productText]?.translated || productText;
}

/**
 * Hook to translate multiple product names at once (batched)
 * More efficient for tables/lists
 */
export function useProductTranslations(productTexts: (string | null | undefined)[]): Map<string, string> {
  const { i18n } = useTranslation();
  const targetLang = i18n.language === 'ar' ? 'ar' : 'en';
  const token = localStorage.getItem('auth_token');
  
  // Filter and deduplicate texts that need translation
  const textsNeedingTranslation = useMemo(() => {
    const uniqueTexts = new Set<string>();
    for (const text of productTexts) {
      if (text && text.trim()) {
        const sourceLang = detectLanguage(text);
        if (sourceLang !== targetLang) {
          uniqueTexts.add(text);
        }
      }
    }
    return Array.from(uniqueTexts);
  }, [productTexts, targetLang]);

  // Create a stable query key from the texts
  const queryKey = useMemo(() => {
    return ['product-translations', targetLang, textsNeedingTranslation.sort().join('|')];
  }, [targetLang, textsNeedingTranslation]);

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchTranslations(textsNeedingTranslation, targetLang, token),
    enabled: textsNeedingTranslation.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Build result map
  return useMemo(() => {
    const result = new Map<string, string>();
    
    for (const text of productTexts) {
      if (!text) continue;
      
      const sourceLang = detectLanguage(text);
      if (sourceLang === targetLang) {
        // No translation needed
        result.set(text, text);
      } else if (data?.translations[text]) {
        // Have translation
        result.set(text, data.translations[text].translated);
      } else {
        // Fallback to original
        result.set(text, text);
      }
    }
    
    return result;
  }, [productTexts, data, targetLang]);
}

/**
 * Hook that provides a translation function for use in components
 * Useful when you need to translate texts dynamically
 */
export function useTranslateProduct() {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const targetLang = i18n.language === 'ar' ? 'ar' : 'en';
  const token = localStorage.getItem('auth_token');

  const translateProduct = useCallback(async (text: string | null | undefined): Promise<string> => {
    if (!text || !text.trim()) return text || '';
    
    const sourceLang = detectLanguage(text);
    if (sourceLang === targetLang) return text;
    
    // Check cache first
    const cacheKey = ['product-translation', text, targetLang];
    const cached = queryClient.getQueryData<TranslationResponse>(cacheKey);
    if (cached?.translations[text]) {
      return cached.translations[text].translated;
    }
    
    // Fetch translation
    try {
      const result = await fetchTranslations([text], targetLang, token);
      
      // Cache the result
      queryClient.setQueryData(cacheKey, result);
      
      return result.translations[text]?.translated || text;
    } catch {
      return text;
    }
  }, [targetLang, token, queryClient]);

  return translateProduct;
}

/**
 * Context provider for batch translation collection
 * Collects translation requests and batches them together
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface TranslationBatchContextValue {
  getTranslation: (text: string) => string;
  registerText: (text: string) => void;
}

const TranslationBatchContext = createContext<TranslationBatchContextValue | null>(null);

export function TranslationBatchProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const targetLang = i18n.language === 'ar' ? 'ar' : 'en';
  const token = localStorage.getItem('auth_token');
  
  const [pendingTexts, setPendingTexts] = useState<Set<string>>(new Set());
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());

  // Register a text for translation
  const registerText = useCallback((text: string) => {
    if (!text || !text.trim()) return;
    const sourceLang = detectLanguage(text);
    if (sourceLang === targetLang) return; // No need to translate
    
    setPendingTexts(prev => {
      if (prev.has(text) || translations.has(text)) return prev;
      const next = new Set(prev);
      next.add(text);
      return next;
    });
  }, [targetLang, translations]);

  // Get translation for a text
  const getTranslation = useCallback((text: string): string => {
    if (!text) return '';
    const sourceLang = detectLanguage(text);
    if (sourceLang === targetLang) return text;
    return translations.get(text) || text;
  }, [targetLang, translations]);

  // Batch fetch translations when pending texts change
  useEffect(() => {
    if (pendingTexts.size === 0) return;
    
    const timer = setTimeout(async () => {
      const textsToFetch = Array.from(pendingTexts);
      setPendingTexts(new Set());
      
      try {
        const result = await fetchTranslations(textsToFetch, targetLang, token);
        
        setTranslations(prev => {
          const next = new Map(prev);
          for (const [original, data] of Object.entries(result.translations)) {
            next.set(original, data.translated);
          }
          return next;
        });
      } catch (error) {
        console.error('Batch translation failed:', error);
      }
    }, 100); // Debounce to collect multiple registrations
    
    return () => clearTimeout(timer);
  }, [pendingTexts, targetLang, token]);

  // Clear translations when language changes
  useEffect(() => {
    setTranslations(new Map());
  }, [targetLang]);

  const value = useMemo(() => ({
    getTranslation,
    registerText,
  }), [getTranslation, registerText]);

  return (
    <TranslationBatchContext.Provider value={value}>
      {children}
    </TranslationBatchContext.Provider>
  );
}

export function useTranslationBatch() {
  const context = useContext(TranslationBatchContext);
  if (!context) {
    throw new Error('useTranslationBatch must be used within TranslationBatchProvider');
  }
  return context;
}

