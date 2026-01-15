/**
 * TranslatedProductText Component
 * Displays product text with automatic translation based on UI language
 * Uses batched translation requests for efficiency in tables/lists
 */

import { useEffect } from 'react';
import { useProductTranslation, useTranslationBatch, detectLanguage } from '../../hooks/useProductTranslation';
import { useTranslation } from 'react-i18next';

interface TranslatedProductTextProps {
  text: string | null | undefined;
  className?: string;
  fallback?: string;
  /** If true, shows loading skeleton while translating */
  showLoading?: boolean;
  /** If true, uses batch translation context (more efficient for tables) */
  useBatch?: boolean;
}

/**
 * Simple translated text component
 * Uses individual translation request (good for standalone usage)
 */
export function TranslatedProductText({ 
  text, 
  className = '',
  fallback = '—',
  showLoading = false,
}: TranslatedProductTextProps) {
  const translatedText = useProductTranslation(text);
  
  if (!text) {
    return <span className={className}>{fallback}</span>;
  }
  
  // Show original text while loading if needed
  if (showLoading && translatedText === text) {
    return (
      <span className={`${className} animate-pulse`}>
        {text}
      </span>
    );
  }
  
  return <span className={className}>{translatedText || fallback}</span>;
}

/**
 * Batched translated text component
 * Uses batch translation context for efficiency in tables
 * Must be used within TranslationBatchProvider
 */
export function BatchedTranslatedProductText({ 
  text, 
  className = '',
  fallback = '—',
}: Omit<TranslatedProductTextProps, 'useBatch' | 'showLoading'>) {
  const { getTranslation, registerText } = useTranslationBatch();
  
  // Register text for batch translation on mount
  useEffect(() => {
    if (text) {
      registerText(text);
    }
  }, [text, registerText]);
  
  if (!text) {
    return <span className={className}>{fallback}</span>;
  }
  
  const translatedText = getTranslation(text);
  
  return <span className={className}>{translatedText || fallback}</span>;
}

/**
 * Smart translated text - automatically chooses batch or individual mode
 * Prefer this component for most use cases
 */
export function SmartTranslatedProductText({ 
  text, 
  className = '',
  fallback = '—',
}: Omit<TranslatedProductTextProps, 'useBatch' | 'showLoading'>) {
  const { i18n } = useTranslation();
  const targetLang = i18n.language === 'ar' ? 'ar' : 'en';
  const translatedText = useProductTranslation(text);
  
  if (!text) {
    return <span className={className}>{fallback}</span>;
  }
  
  // Check if translation is needed
  const sourceLang = detectLanguage(text);
  if (sourceLang === targetLang) {
    return <span className={className}>{text}</span>;
  }
  
  return <span className={className}>{translatedText || text}</span>;
}

/**
 * Inline translated product text (no wrapper span)
 * Returns just the translated string, useful for props/attributes
 */
export function useTranslatedProductText(text: string | null | undefined): string {
  const translatedText = useProductTranslation(text);
  return translatedText || text || '';
}

export default TranslatedProductText;

