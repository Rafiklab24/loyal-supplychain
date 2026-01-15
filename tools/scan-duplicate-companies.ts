#!/usr/bin/env ts-node
/**
 * Scan for duplicate companies in the database
 * Uses the stringMatch utility with 70% similarity threshold
 * 
 * Usage: 
 *   npx ts-node tools/scan-duplicate-companies.ts
 * 
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string
 */

import { Pool } from 'pg';

// ============================================
// String matching utilities (copied from app/src/utils/stringMatch.ts)
// ============================================

const LEGAL_SUFFIXES = [
  'limited', 'ltd', 'llc', 'inc', 'incorporated', 'corp', 'corporation',
  'co', 'company', 'plc', 'lp', 'llp', 'pllc', 'sa', 'ag', 'gmbh', 'bv', 'nv',
  'private', 'pvt', 'public',
  'anonim şirketi', 'anonim sirketi', 'a.ş.', 'a.s.', 'aş', 'as',
  'limited şirketi', 'limited sirketi', 'ltd şti', 'ltd. şti.', 'ltd sti', 'ltd. sti.',
  'ticaret', 'sanayi', 'şirketi', 'sirketi', 'şti', 'sti',
  'limited', 'limi ted',
  'ذ.م.م', 'ش.م.م', 'شركة', 'للتجارة', 'والتجارة',
  'mersin', 'turkey', 'türkiye', 'istanbul',
];

const STOP_WORDS = ['the', 'and', 'of', 'for', 've', 'و', 'ال'];

function normalizeTurkishChars(text: string): string {
  let result = text.normalize('NFD');
  result = result.replace(/[\u0300-\u036f]/g, '');
  const turkishMap: { [key: string]: string } = {
    'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u',
    'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c', 'ı': 'i', 'İ': 'i',
    'ý': 'y', 'Ý': 'y', 'I': 'i',
  };
  for (const [from, to] of Object.entries(turkishMap)) {
    result = result.split(from).join(to);
  }
  return result;
}

function normalizeCompanyName(name: string): string {
  if (!name) return '';
  let normalized = name.toLowerCase().trim();
  normalized = normalizeTurkishChars(normalized);
  normalized = normalized.replace(/[.,\-_'"()]/g, ' ');
  for (let i = 0; i < 3; i++) {
    for (const suffix of LEGAL_SUFFIXES) {
      const safeSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${safeSuffix}\\b`, 'gi');
      normalized = normalized.replace(regex, '');
    }
  }
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

function getSignificantTokens(name: string): string[] {
  const normalized = normalizeCompanyName(name);
  const tokens = normalized.split(' ').filter(t => t.length > 1);
  return tokens.filter(token => !STOP_WORDS.includes(token.toLowerCase()));
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function levenshteinSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

function tokenSimilarity(name1: string, name2: string): number {
  const tokens1 = new Set(getSignificantTokens(name1));
  const tokens2 = new Set(getSignificantTokens(name2));
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  return intersection.size / union.size;
}

function bigramSimilarity(str1: string, str2: string): number {
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

function containmentScore(name1: string, name2: string): number {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  if (norm1.includes(norm2)) return norm2.length / norm1.length;
  if (norm2.includes(norm1)) return norm1.length / norm2.length;
  return 0;
}

function firstWordsMatch(name1: string, name2: string): number {
  const tokens1 = getSignificantTokens(name1);
  const tokens2 = getSignificantTokens(name2);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  const shorter = tokens1.length < tokens2.length ? tokens1 : tokens2;
  const longer = tokens1.length >= tokens2.length ? tokens1 : tokens2;
  let matchCount = 0;
  for (let i = 0; i < Math.min(shorter.length, 3); i++) {
    if (shorter[i] === longer[i]) {
      matchCount++;
    } else if (levenshteinSimilarity(shorter[i], longer[i]) > 0.8) {
      matchCount += 0.8;
    }
  }
  return matchCount / Math.min(shorter.length, 3);
}

function tokenSubsetScore(name1: string, name2: string): number {
  const tokens1 = new Set(getSignificantTokens(name1));
  const tokens2 = new Set(getSignificantTokens(name2));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  const shorter = tokens1.size < tokens2.size ? tokens1 : tokens2;
  const longer = tokens1.size >= tokens2.size ? tokens1 : tokens2;
  let matchCount = 0;
  for (const token of shorter) {
    if (longer.has(token)) {
      matchCount++;
    } else {
      for (const longerToken of longer) {
        if (levenshteinSimilarity(token, longerToken) > 0.8) {
          matchCount += 0.8;
          break;
        }
      }
    }
  }
  return matchCount / shorter.size;
}

interface SimilarityResult {
  overallScore: number;
  levenshtein: number;
  token: number;
  bigram: number;
  containment: number;
  firstWords: number;
  tokenSubset: number;
}

function calculateSimilarity(name1: string, name2: string): SimilarityResult {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  const levenshtein = levenshteinSimilarity(norm1, norm2);
  const token = tokenSimilarity(name1, name2);
  const bigram = bigramSimilarity(norm1, norm2);
  const containment = containmentScore(name1, name2);
  const firstWords = firstWordsMatch(name1, name2);
  const tokenSubset = tokenSubsetScore(name1, name2);

  const tokens1 = getSignificantTokens(name1);
  const tokens2 = getSignificantTokens(name2);
  const lengthRatio = Math.min(tokens1.length, tokens2.length) / Math.max(tokens1.length, tokens2.length);
  const isShortToLong = lengthRatio < 0.5;

  let weights;
  if (isShortToLong) {
    weights = {
      levenshtein: 0.05, token: 0.15, bigram: 0.15,
      containment: 0.15, firstWords: 0.25, tokenSubset: 0.25,
    };
  } else {
    weights = {
      levenshtein: 0.10, token: 0.30, bigram: 0.20,
      containment: 0.10, firstWords: 0.15, tokenSubset: 0.15,
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
    overallScore: Math.min(1, overallScore),
    levenshtein, token, bigram, containment, firstWords, tokenSubset,
  };
}

// ============================================
// Main scanning logic
// ============================================

interface Company {
  id: string;
  name: string;
  is_supplier: boolean;
  is_customer: boolean;
  is_shipping_line: boolean;
  is_forwarder: boolean;
  is_bank: boolean;
  is_insurance: boolean;
  is_deleted: boolean;
  created_at: Date;
}

interface DuplicatePair {
  company1: Company;
  company2: Company;
  similarity: number;
  details: SimilarityResult;
}

async function scanForDuplicates(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('\nUsage:');
    console.log('  DATABASE_URL="postgresql://user:pass@host:5432/db" npx ts-node tools/scan-duplicate-companies.ts');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const SIMILARITY_THRESHOLD = 0.70; // 70%

  try {
    console.log('🔍 Scanning for duplicate companies...\n');
    console.log(`   Threshold: ${(SIMILARITY_THRESHOLD * 100).toFixed(0)}% similarity`);
    console.log('');

    // Fetch all non-deleted companies
    const result = await pool.query<Company>(`
      SELECT id, name, is_supplier, is_customer, is_shipping_line, is_forwarder, is_bank, is_insurance, is_deleted, created_at
      FROM master_data.companies
      WHERE is_deleted = false
      ORDER BY created_at ASC
    `);

    const companies = result.rows;
    console.log(`📊 Found ${companies.length} active companies to analyze\n`);

    if (companies.length === 0) {
      console.log('✅ No companies found in database.');
      return;
    }

    const duplicatePairs: DuplicatePair[] = [];
    const processedPairs = new Set<string>(); // To avoid duplicate entries

    // Compare each company with all others
    let comparisons = 0;
    const totalComparisons = (companies.length * (companies.length - 1)) / 2;

    console.log(`⏳ Performing ${totalComparisons.toLocaleString()} comparisons...\n`);

    for (let i = 0; i < companies.length; i++) {
      for (let j = i + 1; j < companies.length; j++) {
        comparisons++;
        
        // Progress indicator
        if (comparisons % 10000 === 0) {
          const pct = ((comparisons / totalComparisons) * 100).toFixed(1);
          process.stdout.write(`\r   Progress: ${pct}% (${comparisons.toLocaleString()}/${totalComparisons.toLocaleString()})`);
        }

        const company1 = companies[i];
        const company2 = companies[j];

        // Skip if either name is empty
        if (!company1.name || !company2.name) continue;

        // Create a unique key for this pair
        const pairKey = [company1.id, company2.id].sort().join('|');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const similarity = calculateSimilarity(company1.name, company2.name);

        if (similarity.overallScore >= SIMILARITY_THRESHOLD) {
          duplicatePairs.push({
            company1,
            company2,
            similarity: similarity.overallScore,
            details: similarity,
          });
        }
      }
    }

    console.log(`\r   Progress: 100% - Complete!                    \n`);

    // Sort by similarity (highest first)
    duplicatePairs.sort((a, b) => b.similarity - a.similarity);

    // Output results
    console.log('═'.repeat(100));
    console.log(`\n🔴 DUPLICATE COMPANIES FOUND: ${duplicatePairs.length} pairs\n`);
    console.log('═'.repeat(100));

    if (duplicatePairs.length === 0) {
      console.log('\n✅ No duplicates found above the threshold!');
    } else {
      // Group by similarity ranges
      const high = duplicatePairs.filter(p => p.similarity >= 0.90);
      const medium = duplicatePairs.filter(p => p.similarity >= 0.80 && p.similarity < 0.90);
      const low = duplicatePairs.filter(p => p.similarity >= 0.70 && p.similarity < 0.80);

      console.log(`\n📈 Breakdown:`);
      console.log(`   🔴 High (90%+):    ${high.length} pairs`);
      console.log(`   🟠 Medium (80-90%): ${medium.length} pairs`);
      console.log(`   🟡 Low (70-80%):    ${low.length} pairs`);
      console.log('');

      // Print detailed results
      let pairNum = 1;
      for (const pair of duplicatePairs) {
        const pctStr = (pair.similarity * 100).toFixed(1);
        let emoji = '🟡';
        if (pair.similarity >= 0.90) emoji = '🔴';
        else if (pair.similarity >= 0.80) emoji = '🟠';

        console.log(`\n${emoji} Pair #${pairNum} - ${pctStr}% Similar`);
        console.log('─'.repeat(60));
        const getCompanyTypes = (c: Company): string => {
          const types: string[] = [];
          if (c.is_supplier) types.push('Supplier');
          if (c.is_customer) types.push('Customer');
          if (c.is_shipping_line) types.push('Shipping Line');
          if (c.is_forwarder) types.push('Forwarder');
          if (c.is_bank) types.push('Bank');
          if (c.is_insurance) types.push('Insurance');
          return types.length > 0 ? types.join(', ') : 'N/A';
        };
        
        console.log(`   Company A: "${pair.company1.name}"`);
        console.log(`              ID: ${pair.company1.id}`);
        console.log(`              Type: ${getCompanyTypes(pair.company1)}`);
        console.log(`              Created: ${pair.company1.created_at}`);
        console.log('');
        console.log(`   Company B: "${pair.company2.name}"`);
        console.log(`              ID: ${pair.company2.id}`);
        console.log(`              Type: ${getCompanyTypes(pair.company2)}`);
        console.log(`              Created: ${pair.company2.created_at}`);
        console.log('');
        console.log(`   Similarity Breakdown:`);
        console.log(`     • Levenshtein: ${(pair.details.levenshtein * 100).toFixed(1)}%`);
        console.log(`     • Token:       ${(pair.details.token * 100).toFixed(1)}%`);
        console.log(`     • Bigram:      ${(pair.details.bigram * 100).toFixed(1)}%`);
        console.log(`     • Containment: ${(pair.details.containment * 100).toFixed(1)}%`);
        console.log(`     • FirstWords:  ${(pair.details.firstWords * 100).toFixed(1)}%`);
        console.log(`     • TokenSubset: ${(pair.details.tokenSubset * 100).toFixed(1)}%`);

        pairNum++;

        // Limit output to first 50 pairs to avoid overwhelming console
        if (pairNum > 50) {
          console.log(`\n... and ${duplicatePairs.length - 50} more pairs. Full report saved to CSV.`);
          break;
        }
      }

      // Generate CSV report
      const csvLines = [
        'Pair#,Similarity%,Company1_ID,Company1_Name,Company1_Types,Company2_ID,Company2_Name,Company2_Types,Levenshtein%,Token%,Bigram%,Containment%,FirstWords%,TokenSubset%'
      ];

      const getCompanyTypesForCsv = (c: Company): string => {
        const types: string[] = [];
        if (c.is_supplier) types.push('Supplier');
        if (c.is_customer) types.push('Customer');
        if (c.is_shipping_line) types.push('Shipping Line');
        if (c.is_forwarder) types.push('Forwarder');
        if (c.is_bank) types.push('Bank');
        if (c.is_insurance) types.push('Insurance');
        return types.join('; ') || 'N/A';
      };

      duplicatePairs.forEach((pair, idx) => {
        const row = [
          idx + 1,
          (pair.similarity * 100).toFixed(1),
          pair.company1.id,
          `"${pair.company1.name.replace(/"/g, '""')}"`,
          `"${getCompanyTypesForCsv(pair.company1)}"`,
          pair.company2.id,
          `"${pair.company2.name.replace(/"/g, '""')}"`,
          `"${getCompanyTypesForCsv(pair.company2)}"`,
          (pair.details.levenshtein * 100).toFixed(1),
          (pair.details.token * 100).toFixed(1),
          (pair.details.bigram * 100).toFixed(1),
          (pair.details.containment * 100).toFixed(1),
          (pair.details.firstWords * 100).toFixed(1),
          (pair.details.tokenSubset * 100).toFixed(1),
        ].join(',');
        csvLines.push(row);
      });

      const csvContent = csvLines.join('\n');
      const csvPath = 'tools/duplicate-companies-report.csv';
      
      const fs = require('fs');
      fs.writeFileSync(csvPath, csvContent, 'utf8');
      
      console.log(`\n\n📄 Full report saved to: ${csvPath}`);
    }

    // Summary
    console.log('\n' + '═'.repeat(100));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(100));
    console.log(`   Total companies scanned: ${companies.length}`);
    console.log(`   Total comparisons made:  ${totalComparisons.toLocaleString()}`);
    console.log(`   Duplicate pairs found:   ${duplicatePairs.length}`);
    console.log(`   Similarity threshold:    ${(SIMILARITY_THRESHOLD * 100).toFixed(0)}%`);
    console.log('');

    if (duplicatePairs.length > 0) {
      console.log('💡 Next steps:');
      console.log('   1. Review the CSV report: tools/duplicate-companies-report.csv');
      console.log('   2. Decide which company to keep for each pair');
      console.log('   3. Run the merge script to consolidate duplicates');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error scanning for duplicates:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the scan
scanForDuplicates().catch(console.error);

