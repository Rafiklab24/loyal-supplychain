import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/api';

/**
 * Duplicate entity check result
 */
export interface DuplicateMatch {
  id: string;
  name: string;
  score: number;
  details?: {
    levenshtein: number;
    token: number;
    bigram: number;
    containment: number;
    firstWords: number;
    tokenSubset: number;
  };
}

export interface DuplicateCheckResult {
  isChecking: boolean;
  hasPotentialDuplicate: boolean;
  isDuplicateBlocked: boolean; // True if score >= 70% (should block)
  matches: DuplicateMatch[];
  bestMatch: DuplicateMatch | null;
  error: string | null;
}

export interface UseDuplicateCheckOptions {
  /** Entity type for checking (company, supplier, customer, etc.) */
  entityType?: 'company' | 'supplier' | 'customer' | 'shipping_line';
  /** Similarity threshold for warning (default 0.5 = 50%) */
  warningThreshold?: number;
  /** Similarity threshold for blocking (default 0.7 = 70%) */
  blockingThreshold?: number;
  /** Debounce delay in ms (default 500) */
  debounceMs?: number;
  /** Minimum characters before checking (default 3) */
  minLength?: number;
  /** Whether to skip checking (e.g., when editing existing entity) */
  skip?: boolean;
}

/**
 * Custom hook for checking duplicate entities in real-time
 * 
 * Uses fuzzy matching algorithm with multiple similarity metrics:
 * - Levenshtein distance (edit distance)
 * - Token similarity (word overlap)
 * - Bigram similarity (character pairs)
 * - First words match (company names usually start with distinguishing words)
 * - Token subset (handles short vs long name matching)
 * 
 * @param value - The entity name to check
 * @param options - Configuration options
 * @returns DuplicateCheckResult with matches and status
 * 
 * @example
 * const { hasPotentialDuplicate, isDuplicateBlocked, bestMatch, isChecking } = useDuplicateCheck(
 *   companyName,
 *   { entityType: 'customer', blockingThreshold: 0.7 }
 * );
 */
export function useDuplicateCheck(
  value: string,
  options: UseDuplicateCheckOptions = {}
): DuplicateCheckResult {
  const {
    entityType = 'company',
    warningThreshold = 0.5,
    blockingThreshold = 0.7,
    debounceMs = 500,
    minLength = 3,
    skip = false,
  } = options;

  const [isChecking, setIsChecking] = useState(false);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkDuplicates = useCallback(async (name: string) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Don't check if value is too short
    if (!name || name.trim().length < minLength) {
      setMatches([]);
      setError(null);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await apiClient.get('/companies/fuzzy-match', {
        params: {
          name: name.trim(),
          threshold: warningThreshold.toString(),
          limit: '5',
          type: entityType === 'company' ? undefined : entityType,
        },
        signal: abortControllerRef.current.signal,
      });

      if (response.data.matches) {
        setMatches(response.data.matches);
      } else {
        setMatches([]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        // Request was cancelled, ignore
        return;
      }
      console.error('Duplicate check error:', err);
      setError('Failed to check for duplicates');
      setMatches([]);
    } finally {
      setIsChecking(false);
    }
  }, [entityType, warningThreshold, minLength]);

  // Debounced effect for checking duplicates
  useEffect(() => {
    if (skip) {
      setMatches([]);
      setError(null);
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced check
    timeoutRef.current = setTimeout(() => {
      checkDuplicates(value);
    }, debounceMs);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [value, skip, debounceMs, checkDuplicates]);

  // Calculate derived state
  const bestMatch = matches.length > 0 ? matches[0] : null;
  const hasPotentialDuplicate = bestMatch !== null && bestMatch.score >= warningThreshold;
  const isDuplicateBlocked = bestMatch !== null && bestMatch.score >= blockingThreshold;

  return {
    isChecking,
    hasPotentialDuplicate,
    isDuplicateBlocked,
    matches,
    bestMatch,
    error,
  };
}

/**
 * Helper function to format similarity score as percentage
 */
export function formatSimilarityScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Helper function to get warning level based on score
 */
export function getWarningLevel(score: number): 'none' | 'low' | 'medium' | 'high' | 'blocked' {
  if (score >= 0.7) return 'blocked';
  if (score >= 0.6) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.4) return 'low';
  return 'none';
}

export default useDuplicateCheck;

