/**
 * String similarity utilities for fuzzy matching company names
 * Used to match OCR-extracted names against existing database records
 */

// Common legal suffixes to remove for better matching
const LEGAL_SUFFIXES = [
  // English
  'limited', 'ltd', 'llc', 'inc', 'incorporated', 'corp', 'corporation',
  'co', 'company', 'plc', 'lp', 'llp', 'pllc', 'sa', 'ag', 'gmbh', 'bv', 'nv',
  'private', 'pvt', 'public',
  // Turkish (with variations)
  'anonim şirketi', 'anonim sirketi', 'a.ş.', 'a.s.', 'aş', 'as',
  'limited şirketi', 'limited sirketi', 'ltd şti', 'ltd. şti.', 'ltd sti', 'ltd. sti.',
  'ticaret', 'sanayi', 'şirketi', 'sirketi', 'şti', 'sti',
  'limited', 'limi ted', // OCR sometimes splits 'limited'
  // Arabic
  'ذ.م.م', 'ش.م.م', 'شركة', 'للتجارة', 'والتجارة',
  // Location suffixes
  'mersin', 'turkey', 'türkiye', 'istanbul',
];

// Common words to ignore in matching (but keep for identification)
const STOP_WORDS = [
  'the', 'and', 'of', 'for', 've', 'و', 'ال',
];

/**
 * Normalize Turkish/special characters to ASCII equivalents
 */
function normalizeTurkishChars(text: string): string {
  // First, normalize unicode (some chars may be composed differently)
  let result = text.normalize('NFD');
  
  // Remove diacritical marks (accents)
  result = result.replace(/[\u0300-\u036f]/g, '');
  
  // Handle specific Turkish characters that might not be covered by diacritical removal
  const turkishMap: { [key: string]: string } = {
    'ş': 's', 'Ş': 's',
    'ğ': 'g', 'Ğ': 'g',
    'ü': 'u', 'Ü': 'u',
    'ö': 'o', 'Ö': 'o',
    'ç': 'c', 'Ç': 'c',
    'ı': 'i', 'İ': 'i', // Turkish dotless i and dotted I
    'ý': 'y', 'Ý': 'y',
    'I': 'i', // Also handle regular uppercase I
  };
  
  for (const [from, to] of Object.entries(turkishMap)) {
    result = result.split(from).join(to);
  }
  
  return result;
}

/**
 * Normalize a company name for comparison
 * - Lowercase
 * - Normalize Turkish characters
 * - Remove legal suffixes
 * - Remove punctuation
 * - Normalize whitespace
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  
  let normalized = name.toLowerCase().trim();
  
  // Normalize Turkish characters
  normalized = normalizeTurkishChars(normalized);
  
  // Remove punctuation except spaces
  normalized = normalized.replace(/[.,\-_'"()]/g, ' ');
  
  // Remove legal suffixes (iterate multiple times for nested suffixes)
  for (let i = 0; i < 3; i++) {
    for (const suffix of LEGAL_SUFFIXES) {
      const safeSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match at end of string or followed by space/punctuation
      const regex = new RegExp(`\\b${safeSuffix}\\b`, 'gi');
      normalized = normalized.replace(regex, '');
    }
  }
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Extract significant tokens from a company name
 */
export function getSignificantTokens(name: string): string[] {
  const normalized = normalizeCompanyName(name);
  const tokens = normalized.split(' ').filter(t => t.length > 1);
  
  // Filter out stop words
  return tokens.filter(token => !STOP_WORDS.includes(token.toLowerCase()));
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create 2D array
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity ratio based on Levenshtein distance (0-1)
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

/**
 * Calculate Jaccard similarity based on word tokens (0-1)
 */
export function tokenSimilarity(name1: string, name2: string): number {
  const tokens1 = new Set(getSignificantTokens(name1));
  const tokens2 = new Set(getSignificantTokens(name2));
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  // Calculate intersection
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  
  // Calculate union
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate bigram (2-character) similarity (0-1)
 * Good for catching typos and OCR errors
 */
export function bigramSimilarity(str1: string, str2: string): number {
  const getBigrams = (s: string): Set<string> => {
    const normalized = s.toLowerCase().replace(/\s+/g, '');
    const bigrams = new Set<string>();
    for (let i = 0; i < normalized.length - 1; i++) {
      bigrams.add(normalized.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);
  
  if (bigrams1.size === 0 && bigrams2.size === 0) return 1;
  if (bigrams1.size === 0 || bigrams2.size === 0) return 0;
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  const union = new Set([...bigrams1, ...bigrams2]);
  
  return intersection.size / union.size;
}

/**
 * Check if one name contains the other (for short vs long name matching)
 */
export function containmentScore(name1: string, name2: string): number {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  
  if (norm1.includes(norm2)) return norm2.length / norm1.length;
  if (norm2.includes(norm1)) return norm1.length / norm2.length;
  
  return 0;
}

/**
 * Check if the first N significant words match (company name usually starts with distinguishing words)
 */
export function firstWordsMatch(name1: string, name2: string): number {
  const tokens1 = getSignificantTokens(name1);
  const tokens2 = getSignificantTokens(name2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  // Check how many of the first words match
  const shorter = tokens1.length < tokens2.length ? tokens1 : tokens2;
  const longer = tokens1.length >= tokens2.length ? tokens1 : tokens2;
  
  let matchCount = 0;
  for (let i = 0; i < Math.min(shorter.length, 3); i++) { // Check first 3 words
    if (shorter[i] === longer[i]) {
      matchCount++;
    } else if (levenshteinSimilarity(shorter[i], longer[i]) > 0.8) {
      matchCount += 0.8; // Partial credit for similar words (typos)
    }
  }
  
  // Return proportion of first words that matched
  return matchCount / Math.min(shorter.length, 3);
}

/**
 * Check if one name's tokens are a subset of another (handles short vs long names)
 */
export function tokenSubsetScore(name1: string, name2: string): number {
  const tokens1 = new Set(getSignificantTokens(name1));
  const tokens2 = new Set(getSignificantTokens(name2));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  // Find which is shorter
  const shorter = tokens1.size < tokens2.size ? tokens1 : tokens2;
  const longer = tokens1.size >= tokens2.size ? tokens1 : tokens2;
  
  // Count how many of the shorter's tokens appear in the longer
  let matchCount = 0;
  for (const token of shorter) {
    if (longer.has(token)) {
      matchCount++;
    } else {
      // Check for fuzzy match (typos)
      for (const longerToken of longer) {
        if (levenshteinSimilarity(token, longerToken) > 0.8) {
          matchCount += 0.8;
          break;
        }
      }
    }
  }
  
  // Return what percentage of the shorter name's tokens were found
  return matchCount / shorter.size;
}

export interface SimilarityResult {
  overallScore: number;
  levenshtein: number;
  token: number;
  bigram: number;
  containment: number;
  firstWords: number;
  tokenSubset: number;
}

/**
 * Calculate overall similarity score between two company names
 * Returns a score between 0 and 1
 */
export function calculateSimilarity(name1: string, name2: string): SimilarityResult {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  
  // Calculate individual scores
  const levenshtein = levenshteinSimilarity(norm1, norm2);
  const token = tokenSimilarity(name1, name2);
  const bigram = bigramSimilarity(norm1, norm2);
  const containment = containmentScore(name1, name2);
  const firstWords = firstWordsMatch(name1, name2);
  const tokenSubset = tokenSubsetScore(name1, name2);
  
  // Determine if this is a short-to-long comparison
  const tokens1 = getSignificantTokens(name1);
  const tokens2 = getSignificantTokens(name2);
  const lengthRatio = Math.min(tokens1.length, tokens2.length) / Math.max(tokens1.length, tokens2.length);
  const isShortToLong = lengthRatio < 0.5;
  
  // Adaptive weights based on comparison type
  let weights;
  if (isShortToLong) {
    // For short vs long names (like "Bayrak Group" vs "Bayrak Group Gida Sanayi...")
    // Prioritize token subset and first words match
    weights = {
      levenshtein: 0.05,
      token: 0.15,
      bigram: 0.15,
      containment: 0.15,
      firstWords: 0.25,
      tokenSubset: 0.25,
    };
  } else {
    // For similar-length names
    weights = {
      levenshtein: 0.10,
      token: 0.30,
      bigram: 0.20,
      containment: 0.10,
      firstWords: 0.15,
      tokenSubset: 0.15,
    };
  }
  
  const overallScore = 
    levenshtein * weights.levenshtein +
    token * weights.token +
    bigram * weights.bigram +
    containment * weights.containment +
    firstWords * weights.firstWords +
    tokenSubset * weights.tokenSubset;
  
  return {
    overallScore: Math.min(1, overallScore), // Cap at 1
    levenshtein,
    token,
    bigram,
    containment,
    firstWords,
    tokenSubset,
  };
}

/**
 * Find best matches for a company name from a list of candidates
 */
export function findBestMatches(
  searchName: string,
  candidates: { id: string; name: string }[],
  threshold: number = 0.7,
  maxResults: number = 5
): Array<{ id: string; name: string; score: number; details: SimilarityResult }> {
  const results = candidates
    .map(candidate => {
      const similarity = calculateSimilarity(searchName, candidate.name);
      return {
        id: candidate.id,
        name: candidate.name,
        score: similarity.overallScore,
        details: similarity,
      };
    })
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  return results;
}

