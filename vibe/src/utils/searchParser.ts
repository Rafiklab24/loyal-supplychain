/**
 * Intelligent Search Parser
 * Parses natural language queries in Arabic and English
 * Extracts: product keywords, origin (POL), destination (POD), dates
 */

export interface ParsedSearch {
  generalSearch?: string;  // General product/term search
  pol?: string[];          // Origin port/country (supports multiple)
  pod?: string[];          // Destination port/country (supports multiple)
  products?: string[];     // Specific products (supports multiple)
  excludeProducts?: string[]; // Products to exclude
  month?: number;          // Month (1-12) - single month filter
  year?: number;           // Year - single year filter
  // Date range filters
  etaFrom?: string;        // ETA start date (YYYY-MM-DD)
  etaTo?: string;          // ETA end date (YYYY-MM-DD)
  // Numeric filters with operators
  totalValue?: { operator: string; value: number };      // Total value comparisons
  containerCount?: { operator: string; value: number };  // Container count comparisons
  weight?: { operator: string; value: number };          // Weight comparisons
  balance?: { operator: string; value: number };         // Balance comparisons
  // Auto-sort instructions
  sortBy?: string;         // Column to sort by
  sortDir?: 'asc' | 'desc'; // Sort direction
}

// Keywords that indicate origin (POL)
const FROM_KEYWORDS_AR = ['من', 'قادم من', 'قادمة من', 'مصدره', 'منشأ'];
const FROM_KEYWORDS_EN = ['from', 'coming from', 'origin', 'shipped from', 'departing'];

// Keywords that indicate destination (POD)
const TO_KEYWORDS_AR = ['إلى', 'الى', 'إلي', 'متجه', 'متجهة', 'وجهة', 'ذاهب', 'ذاهبة'];
const TO_KEYWORDS_EN = ['to', 'going to', 'headed to', 'destination', 'arriving', 'bound for'];

// Keywords that indicate conjunction (AND)
const AND_KEYWORDS_EN = ['and', 'also', 'plus', 'as well as'];

// Keywords that indicate exclusion (EXCEPT/NOT)
const EXCEPT_KEYWORDS_AR = ['عدا', 'ما عدا', 'باستثناء', 'غير', 'ماعدا', 'ليس', 'بدون'];
const EXCEPT_KEYWORDS_EN = ['except', 'excluding', 'not', 'without', 'but not', 'exclude'];

// Month names in Arabic
const ARABIC_MONTHS: Record<string, number> = {
  'يناير': 1, 'كانون الثاني': 1, 'شهر 1': 1,
  'فبراير': 2, 'شباط': 2, 'شهر 2': 2,
  'مارس': 3, 'آذار': 3, 'شهر 3': 3,
  'أبريل': 4, 'نيسان': 4, 'شهر 4': 4,
  'مايو': 5, 'أيار': 5, 'شهر 5': 5,
  'يونيو': 6, 'حزيران': 6, 'شهر 6': 6,
  'يوليو': 7, 'تموز': 7, 'شهر 7': 7,
  'أغسطس': 8, 'آب': 8, 'شهر 8': 8,
  'سبتمبر': 9, 'أيلول': 9, 'شهر 9': 9,
  'أكتوبر': 10, 'تشرين الأول': 10, 'شهر 10': 10,
  'نوفمبر': 11, 'تشرين الثاني': 11, 'شهر 11': 11,
  'ديسمبر': 12, 'كانون الأول': 12, 'شهر 12': 12,
};

// Month names in English
const ENGLISH_MONTHS: Record<string, number> = {
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9, 'sept': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12,
};

/**
 * Parse smart date keywords (relative dates)
 * Examples: "last 30 days", "this month", "آخر 30 يوم", "هذا الشهر"
 */
function parseSmartDate(text: string): { from?: string; to?: string } | null {
  const today = new Date();
  const lowerText = text.toLowerCase();
  
  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // "Last X days" / "آخر X يوم"
  const lastDaysMatch = lowerText.match(/(?:last|آخر|اخر)\s+(\d+)\s+(?:days?|يوم|ايام)/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[1]);
    const from = new Date(today);
    from.setDate(today.getDate() - days);
    return { from: formatDate(from), to: formatDate(today) };
  }

  // "Next X days" / "خلال X يوم القادمة"
  const nextDaysMatch = lowerText.match(/(?:next|خلال|القادمة)\s+(\d+)\s+(?:days?|يوم|ايام)/);
  if (nextDaysMatch) {
    const days = parseInt(nextDaysMatch[1]);
    const to = new Date(today);
    to.setDate(today.getDate() + days);
    return { from: formatDate(today), to: formatDate(to) };
  }

  // "This month" / "هذا الشهر"
  if (/(?:this month|هذا الشهر)/i.test(text)) {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }

  // "Last month" / "الشهر الماضي"
  if (/(?:last month|الشهر الماضي)/i.test(text)) {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }

  // "This year" / "هذه السنة"
  if (/(?:this year|هذه السنة|هذا العام)/i.test(text)) {
    const firstDay = new Date(today.getFullYear(), 0, 1);
    const lastDay = new Date(today.getFullYear(), 11, 31);
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }

  // "This quarter" / "هذا الربع" / "Q1", "Q2", "Q3", "Q4"
  const quarterMatch = lowerText.match(/(?:q|quarter|ربع|الربع)\s*([1-4])/i);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1]);
    const startMonth = (quarter - 1) * 3;
    const firstDay = new Date(today.getFullYear(), startMonth, 1);
    const lastDay = new Date(today.getFullYear(), startMonth + 3, 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }
  
  // Detect "this quarter" without number
  if (/(?:this quarter|هذا الربع)/i.test(text)) {
    const currentMonth = today.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    const startMonth = (currentQuarter - 1) * 3;
    const firstDay = new Date(today.getFullYear(), startMonth, 1);
    const lastDay = new Date(today.getFullYear(), startMonth + 3, 0);
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }

  // "Fiscal year" / "السنة المالية" (assuming October to September)
  if (/(?:fiscal year|fy|السنة المالية)/i.test(text)) {
    const currentMonth = today.getMonth();
    // If we're in Oct-Dec, fiscal year is current year to next year
    // If we're in Jan-Sep, fiscal year is last year to current year
    const fiscalStartYear = currentMonth >= 9 ? today.getFullYear() : today.getFullYear() - 1;
    const firstDay = new Date(fiscalStartYear, 9, 1); // October 1
    const lastDay = new Date(fiscalStartYear + 1, 8, 30); // September 30
    return { from: formatDate(firstDay), to: formatDate(lastDay) };
  }

  // "Yesterday" / "الأمس"
  if (/(?:yesterday|امس|الأمس)/i.test(text)) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { from: formatDate(yesterday), to: formatDate(yesterday) };
  }

  // "Today" / "اليوم"
  if (/(?:today|اليوم)/i.test(text)) {
    return { from: formatDate(today), to: formatDate(today) };
  }

  // "Tomorrow" / "غدا"
  if (/(?:tomorrow|غدا|غداً)/i.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return { from: formatDate(tomorrow), to: formatDate(tomorrow) };
  }

  // "Next week" / "الأسبوع القادم"
  if (/(?:next week|الأسبوع القادم)/i.test(text)) {
    const nextWeekStart = new Date(today);
    nextWeekStart.setDate(today.getDate() + (7 - today.getDay())); // Next Sunday
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
    return { from: formatDate(nextWeekStart), to: formatDate(nextWeekEnd) };
  }

  // "Last week" / "الأسبوع الماضي"
  if (/(?:last week|الأسبوع الماضي)/i.test(text)) {
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - today.getDay() - 1); // Last Saturday
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
    return { from: formatDate(lastWeekStart), to: formatDate(lastWeekEnd) };
  }

  // "This week" / "هذا الأسبوع"
  if (/(?:this week|هذا الأسبوع)/i.test(text)) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return { from: formatDate(weekStart), to: formatDate(weekEnd) };
  }

  return null;
}

/**
 * Parse date range from text
 * Examples: "from January to March 2025", "بين يناير ومارس"
 */
function parseDateRange(text: string): { from?: string; to?: string } | null {
  const formatDate = (year: number, month: number): string => {
    const y = String(year);
    const m = String(month).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const currentYear = new Date().getFullYear();

  // Try "from [month] to [month] [year]" pattern
  const fromToPattern = /(?:from|من)\s+([a-zA-Zء-ي\s\d]+)\s+(?:to|إلى|الى)\s+([a-zA-Zء-ي\s\d]+)/i;
  const fromToMatch = text.match(fromToPattern);
  
  if (fromToMatch) {
    const fromText = fromToMatch[1].trim();
    const toText = fromToMatch[2].trim();
    
    // Extract year from toText if present
    const yearMatch = toText.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
    
    // Try to match Arabic months
    let fromMonth = null;
    let toMonth = null;
    
    for (const [monthName, monthNum] of Object.entries(ARABIC_MONTHS)) {
      if (fromText.includes(monthName)) fromMonth = monthNum;
      if (toText.includes(monthName)) toMonth = monthNum;
    }
    
    // Try English months if Arabic not found
    if (!fromMonth || !toMonth) {
      for (const [monthName, monthNum] of Object.entries(ENGLISH_MONTHS)) {
        if (fromText.toLowerCase().includes(monthName)) fromMonth = monthNum;
        if (toText.toLowerCase().includes(monthName)) toMonth = monthNum;
      }
    }
    
    if (fromMonth && toMonth) {
      return {
        from: formatDate(year, fromMonth),
        to: formatDate(year, toMonth)
      };
    }
  }

  // Try "between [month] and [month]" pattern
  const betweenPattern = /(?:between|بين)\s+([a-zA-Zء-ي\s\d]+)\s+(?:and|و)\s+([a-zA-Zء-ي\s\d]+)/i;
  const betweenMatch = text.match(betweenPattern);
  
  if (betweenMatch) {
    const fromText = betweenMatch[1].trim();
    const toText = betweenMatch[2].trim();
    
    // Extract year if present
    const yearMatch = toText.match(/\b(20\d{2})\b/) || fromText.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
    
    // Try Arabic months
    let fromMonth = null;
    let toMonth = null;
    
    for (const [monthName, monthNum] of Object.entries(ARABIC_MONTHS)) {
      if (fromText.includes(monthName)) fromMonth = monthNum;
      if (toText.includes(monthName)) toMonth = monthNum;
    }
    
    // Try English months
    if (!fromMonth || !toMonth) {
      for (const [monthName, monthNum] of Object.entries(ENGLISH_MONTHS)) {
        if (fromText.toLowerCase().includes(monthName)) fromMonth = monthNum;
        if (toText.toLowerCase().includes(monthName)) toMonth = monthNum;
      }
    }
    
    if (fromMonth && toMonth) {
      return {
        from: formatDate(year, fromMonth),
        to: formatDate(year, toMonth)
      };
    }
  }

  return null;
}

/**
 * Split text by "and" keywords to extract multiple values
 * Example: "India and China" -> ["India", "China"]
 * Example: "الهند والصين" -> ["الهند", "الصين"]
 */
function splitByAnd(text: string): string[] {
  let parts = [text];
  
  // Try Arabic "و" first (most common)
  if (text.includes('و')) {
    parts = text.split('و').map(p => p.trim()).filter(p => p.length > 0);
  }
  
  // Try English "and" if no Arabic split happened
  if (parts.length === 1) {
    for (const andKeyword of AND_KEYWORDS_EN) {
      const regex = new RegExp(`\\s+${andKeyword}\\s+`, 'gi');
      if (regex.test(text)) {
        parts = text.split(regex).map(p => p.trim()).filter(p => p.length > 0);
        break;
      }
    }
  }
  
  return parts;
}

/**
 * Extract exclusions from text
 * Example: "rice except basmati" -> { remaining: "rice", excluded: ["basmati"] }
 * Example: "من الهند والصين عدا القرفة" -> { remaining: "من الهند والصين", excluded: ["القرفة"] }
 */
function extractExclusions(text: string): { remaining: string; excluded: string[] } {
  const excluded: string[] = [];
  let remaining = text;
  
  // Try all except keywords
  for (const keyword of [...EXCEPT_KEYWORDS_AR, ...EXCEPT_KEYWORDS_EN]) {
    const regex = new RegExp(`\\s+${keyword}\\s+`, 'gi');
    const match = regex.exec(remaining);
    
    if (match) {
      const parts = remaining.split(regex);
      if (parts.length >= 2) {
        remaining = parts[0].trim();
        const excludedText = parts.slice(1).join(' ').trim();
        
        // Split excluded items by "and" if present
        const excludedItems = splitByAnd(excludedText);
        excluded.push(...excludedItems.map(item => {
          const trimmed = item.trim();
          // First try Arabic->English, then English->Arabic
          const translatedToEn = translateArabicToEnglish(trimmed);
          return translatedToEn !== trimmed ? translatedToEn : translateProductNames(trimmed);
        }));
      }
      break;
    }
  }
  
  return { remaining, excluded };
}

/**
 * Extract numeric comparison from text
 * Examples: "less than 50000", ">10", "أقل من 50000"
 * Returns the operator, value, and the full matched text including keywords
 */
function extractNumericComparison(text: string): { operator: string; value: number; matched: string } | null {
  // Patterns for numeric comparisons
  // Arabic patterns use [أا] to match both hamza and non-hamza forms
  const patterns = [
    // English patterns
    { regex: /(?:less than|under|below)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '<' },
    { regex: /(?:greater than|more than|over|above)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '>' },
    { regex: /(?:at least|minimum|min)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '>=' },
    { regex: /(?:at most|maximum|max)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '<=' },
    { regex: /(?:exactly|equal to)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '=' },
    
    // Arabic patterns - match both أ (hamza) and ا (alif) forms
    { regex: /[أا]قل\s+من\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '<' },
    { regex: /(?:[أا]كثر\s+من|[أا]كبر\s+من)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '>' },
    { regex: /(?:على|علي)\s+ال[أا]قل\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '>=' },
    { regex: /(?:على|علي)\s+ال[أا]كثر\s*(\d+(?:,\d{3})*(?:\.\d+)?)/gi, operator: '<=' },
    
    // Symbol patterns
    { regex: /<\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g, operator: '<' },
    { regex: />\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g, operator: '>' },
    { regex: /<=\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g, operator: '<=' },
    { regex: />=\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g, operator: '>=' },
    { regex: /=\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g, operator: '=' },
  ];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(text);
    
    if (match) {
      const valueStr = match[1].replace(/,/g, ''); // Remove commas
      const value = parseFloat(valueStr);
      if (!isNaN(value)) {
        return {
          operator: pattern.operator,
          value: value,
          matched: match[0]  // Full matched text including operator phrase
        };
      }
    }
  }

  return null;
}

/**
 * Parse a natural language search query
 */
export function parseSearch(query: string): ParsedSearch {
  if (!query || query.trim() === '') {
    return {};
  }

  const result: ParsedSearch = {};
  let remainingText = query.trim();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Extract DATE RANGES and SMART DATES first
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // Try smart dates first (last 30 days, this month, etc.)
  const smartDate = parseSmartDate(remainingText);
  if (smartDate) {
    result.etaFrom = smartDate.from;
    result.etaTo = smartDate.to;
    // Remove smart date keywords from text
    remainingText = remainingText
      .replace(/(?:last|next|آخر|اخر|خلال|القادمة)\s+\d+\s+(?:days?|يوم|ايام)/gi, '')
      .replace(/(?:this month|last month|this year|هذا الشهر|الشهر الماضي|هذه السنة|هذا العام)/gi, '')
      .trim();
  }
  
  // Try date ranges if no smart date found (from January to March, etc.)
  if (!smartDate) {
    const dateRange = parseDateRange(remainingText);
    if (dateRange) {
      result.etaFrom = dateRange.from;
      result.etaTo = dateRange.to;
      // Remove date range patterns from text
      remainingText = remainingText
        .replace(/(?:from|من)\s+[a-zA-Zء-ي\s\d]+\s+(?:to|إلى|الى)\s+[a-zA-Zء-ي\s\d]+/gi, '')
        .replace(/(?:between|بين)\s+[a-zA-Zء-ي\s\d]+\s+(?:and|و)\s+[a-zA-Zء-ي\s\d]+/gi, '')
        .trim();
    }
  }

  // Extract single year (2024, 2025, 2026, etc.) - only if no date range
  if (!result.etaFrom && !result.etaTo) {
    const yearMatch = remainingText.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1]);
      remainingText = remainingText.replace(yearMatch[0], '').trim();
    }

    // Extract single month (Arabic)
    for (const [monthName, monthNum] of Object.entries(ARABIC_MONTHS)) {
      if (remainingText.includes(monthName)) {
        result.month = monthNum;
        remainingText = remainingText.replace(monthName, '').trim();
        break;
      }
    }

    // Extract single month (English) - case insensitive
    if (!result.month) {
      const lowerText = remainingText.toLowerCase();
      for (const [monthName, monthNum] of Object.entries(ENGLISH_MONTHS)) {
        if (lowerText.includes(monthName)) {
          result.month = monthNum;
          // Remove the month from the text (case insensitive)
          const regex = new RegExp(monthName, 'gi');
          remainingText = remainingText.replace(regex, '').trim();
          break;
        }
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Detect intelligent MIN/MAX queries for ANY column
  // Examples: "أدنى سعر تثبيت فلفل", "أكبر وزن رز", "earliest ETA"
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // Define column keywords and their database column names
  const columnMappings = [
    {
      column: 'fixed_price_usd_per_ton',
      keywords: {
        ar: ['سعر تثبيت', 'سعر الطن', 'ثمن الطن', 'سعر', 'ثمن'],
        en: ['price per ton', 'price', 'cost per ton', 'cost', 'unit price']
      }
    },
    {
      column: 'total_value_usd',
      keywords: {
        ar: ['القيمة الإجمالية', 'القيمة', 'المبلغ الإجمالي', 'الإجمالي'],
        en: ['total value', 'total amount', 'total cost', 'value']
      }
    },
    {
      column: 'weight_ton',
      keywords: {
        ar: ['الوزن', 'وزن', 'طن'],
        en: ['weight', 'tons', 'tonnage']
      }
    },
    {
      column: 'container_count',
      keywords: {
        ar: ['عدد الحاويات', 'حاويات', 'عدد حاويات'],
        en: ['container count', 'containers', 'number of containers']
      }
    },
    {
      column: 'balance_value_usd',
      keywords: {
        ar: ['الرصيد', 'المتبقي', 'الباقي', 'رصيد متبقي'],
        en: ['balance', 'remaining', 'outstanding', 'due']
      }
    },
    {
      column: 'eta',
      keywords: {
        ar: ['تاريخ الوصول', 'موعد الوصول', 'وصول', 'تاريخ'],
        en: ['eta', 'arrival date', 'arrival', 'date']
      }
    }
  ];

  // Patterns for min/max modifiers
  const minModifiers = {
    ar: ['أدنى', 'ادنى', 'أقل', 'اقل', 'أرخص', 'ارخص', 'أصغر', 'اصغر', 'أقرب', 'اقرب'],
    en: ['lowest', 'minimum', 'min', 'cheapest', 'smallest', 'earliest', 'nearest', 'least']
  };

  const maxModifiers = {
    ar: ['أعلى', 'اعلى', 'أكثر', 'اكثر', 'أغلى', 'اغلى', 'أكبر', 'اكبر', 'أبعد', 'ابعد'],
    en: ['highest', 'maximum', 'max', 'most expensive', 'largest', 'latest', 'furthest', 'most']
  };

  // Try to find min/max queries
  let foundQuery = false;
  
  // Check Arabic patterns
  for (const modifier of minModifiers.ar) {
    for (const mapping of columnMappings) {
      for (const keyword of mapping.keywords.ar) {
        const pattern = new RegExp(`(?:ما هو |ماهو )?${modifier}\\s+${keyword}`, 'gi');
        const match = remainingText.match(pattern);
        if (match) {
          result.sortBy = mapping.column;
          result.sortDir = mapping.column === 'eta' ? 'asc' : 'asc'; // ascending for dates means earliest
          remainingText = remainingText.replace(match[0], '').trim();
          foundQuery = true;
          break;
        }
      }
      if (foundQuery) break;
    }
    if (foundQuery) break;
  }

  if (!foundQuery) {
    for (const modifier of maxModifiers.ar) {
      for (const mapping of columnMappings) {
        for (const keyword of mapping.keywords.ar) {
          const pattern = new RegExp(`(?:ما هو |ماهو )?${modifier}\\s+${keyword}`, 'gi');
          const match = remainingText.match(pattern);
          if (match) {
            result.sortBy = mapping.column;
            result.sortDir = 'desc';
            remainingText = remainingText.replace(match[0], '').trim();
            foundQuery = true;
            break;
          }
        }
        if (foundQuery) break;
      }
      if (foundQuery) break;
    }
  }

  // Check English patterns
  if (!foundQuery) {
    for (const modifier of minModifiers.en) {
      for (const mapping of columnMappings) {
        for (const keyword of mapping.keywords.en) {
          const pattern = new RegExp(`(?:what is |what's )?${modifier}\\s+${keyword}`, 'gi');
          const match = remainingText.match(pattern);
          if (match) {
            result.sortBy = mapping.column;
            result.sortDir = 'asc';
            remainingText = remainingText.replace(match[0], '').trim();
            foundQuery = true;
            break;
          }
        }
        if (foundQuery) break;
      }
      if (foundQuery) break;
    }
  }

  if (!foundQuery) {
    for (const modifier of maxModifiers.en) {
      for (const mapping of columnMappings) {
        for (const keyword of mapping.keywords.en) {
          const pattern = new RegExp(`(?:what is |what's )?${modifier}\\s+${keyword}`, 'gi');
          const match = remainingText.match(pattern);
          if (match) {
            result.sortBy = mapping.column;
            result.sortDir = 'desc';
            remainingText = remainingText.replace(match[0], '').trim();
            foundQuery = true;
            break;
          }
        }
        if (foundQuery) break;
      }
      if (foundQuery) break;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Extract EXCLUSIONS FIRST (before everything else)
  // Example: "من الهند والصين عدا القرفة" -> extract "القرفة" first
  // This prevents exclusion keywords from interfering with location parsing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { remaining: textWithoutExclusions, excluded } = extractExclusions(remainingText);
  
  if (excluded.length > 0) {
    result.excludeProducts = excluded;
  }
  
  // Update remaining text to continue parsing without exclusions
  remainingText = textWithoutExclusions;
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Extract NUMERIC FILTERS (before locations)
  // This prevents "أقل من 50000" from being split incorrectly
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const valueKeywords = ['value', 'total', 'price', 'cost', 'amount', 'القيمة', 'الإجمالي', 'المبلغ', 'السعر', '$', 'دولار'];
  const containerKeywords = ['container', 'containers', 'حاوية', 'حاويات'];
  const weightKeywords = ['ton', 'tons', 'weight', 'طن', 'الوزن'];
  const balanceKeywords = ['balance', 'remaining', 'due', 'الرصيد', 'المتبقي'];

  let lowerTextForNumeric = remainingText.toLowerCase();
  
  // Extract TOTAL VALUE filter
  for (const keyword of valueKeywords) {
    const keywordIndex = lowerTextForNumeric.indexOf(keyword.toLowerCase());
    if (keywordIndex !== -1) {
      // Look for numeric comparison near this keyword (before or after)
      const contextText = remainingText.substring(Math.max(0, keywordIndex - 30), keywordIndex + keyword.length + 50);
      const numericFilter = extractNumericComparison(contextText);
      if (numericFilter) {
        result.totalValue = { operator: numericFilter.operator, value: numericFilter.value };
        
        // Remove BOTH the comparison phrase AND the keyword itself
        remainingText = remainingText.replace(numericFilter.matched, '');
        
        // Also remove the keyword (القيمة, value, $, etc.) from remaining text
        const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        remainingText = remainingText.replace(keywordRegex, '');
        
        remainingText = remainingText.trim();
        break;
      }
    }
  }

  // Extract CONTAINER COUNT filter
  for (const keyword of containerKeywords) {
    const keywordIndex = lowerTextForNumeric.indexOf(keyword.toLowerCase());
    if (keywordIndex !== -1) {
      const contextText = remainingText.substring(Math.max(0, keywordIndex - 30), keywordIndex + keyword.length + 50);
      const numericFilter = extractNumericComparison(contextText);
      if (numericFilter) {
        result.containerCount = { operator: numericFilter.operator, value: numericFilter.value };
        
        // Remove BOTH the comparison phrase AND the keyword
        remainingText = remainingText.replace(numericFilter.matched, '');
        const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        remainingText = remainingText.replace(keywordRegex, '');
        
        remainingText = remainingText.trim();
        break;
      }
    }
  }

  // Extract WEIGHT filter
  for (const keyword of weightKeywords) {
    const keywordIndex = lowerTextForNumeric.indexOf(keyword.toLowerCase());
    if (keywordIndex !== -1) {
      const contextText = remainingText.substring(Math.max(0, keywordIndex - 30), keywordIndex + keyword.length + 50);
      const numericFilter = extractNumericComparison(contextText);
      if (numericFilter) {
        result.weight = { operator: numericFilter.operator, value: numericFilter.value };
        
        // Remove BOTH the comparison phrase AND the keyword
        remainingText = remainingText.replace(numericFilter.matched, '');
        const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        remainingText = remainingText.replace(keywordRegex, '');
        
        remainingText = remainingText.trim();
        break;
      }
    }
  }

  // Extract BALANCE filter
  for (const keyword of balanceKeywords) {
    const keywordIndex = lowerTextForNumeric.indexOf(keyword.toLowerCase());
    if (keywordIndex !== -1) {
      const contextText = remainingText.substring(Math.max(0, keywordIndex - 30), keywordIndex + keyword.length + 50);
      const numericFilter = extractNumericComparison(contextText);
      if (numericFilter) {
        result.balance = { operator: numericFilter.operator, value: numericFilter.value };
        
        // Remove BOTH the comparison phrase AND the keyword
        remainingText = remainingText.replace(numericFilter.matched, '');
        const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        remainingText = remainingText.replace(keywordRegex, '');
        
        remainingText = remainingText.trim();
        break;
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NOW extract ORIGIN (POL) - after numeric filters
  // Supports multiple origins: "from India and China"
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const pols: string[] = [];
  
  // Extract ORIGIN (POL) - Arabic
  for (const keyword of FROM_KEYWORDS_AR) {
    const parts = remainingText.split(keyword);
    if (parts.length > 1) {
      // Text after keyword is the origin
      const afterFrom = parts[1].trim();
      
      // Find the next "to" keyword to know where origin ends
      let originText = afterFrom;
      for (const toKeyword of [...TO_KEYWORDS_AR, ...TO_KEYWORDS_EN]) {
        const toIndex = afterFrom.indexOf(toKeyword);
        if (toIndex > 0) {
          originText = afterFrom.substring(0, toIndex).trim();
          break;
        }
      }
      
      // Split by "and" to get multiple origins
      const originParts = splitByAnd(originText);
      for (const part of originParts) {
        const trimmed = part.trim();
        if (trimmed) {
          pols.push(translateLocation(trimmed));
        }
      }
      
      // Remove from the remaining text
      remainingText = parts[0].trim() + ' ' + afterFrom.replace(originText, '').trim();
      break;
    }
  }

  // Extract ORIGIN (POL) - English
  if (pols.length === 0) {
    for (const keyword of FROM_KEYWORDS_EN) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const match = remainingText.match(regex);
      if (match) {
        const parts = remainingText.split(regex);
        if (parts.length > 1) {
          const afterFrom = parts[1].trim();
          
          // Find the next "to" keyword
          let originText = afterFrom;
          for (const toKeyword of [...TO_KEYWORDS_AR, ...TO_KEYWORDS_EN]) {
            const toIndex = afterFrom.toLowerCase().indexOf(toKeyword.toLowerCase());
            if (toIndex > 0) {
              originText = afterFrom.substring(0, toIndex).trim();
              break;
            }
          }
          
          // Split by "and" to get multiple origins
          const originParts = splitByAnd(originText);
          for (const part of originParts) {
            const trimmed = part.trim();
            if (trimmed) {
              pols.push(translateLocation(trimmed));
            }
          }
          
          remainingText = parts[0].trim() + ' ' + afterFrom.replace(originText, '').trim();
          break;
        }
      }
    }
  }
  
  if (pols.length > 0) {
    result.pol = pols;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Extract DESTINATION (POD)
  // Supports multiple destinations: "to Iraq and UAE"
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const pods: string[] = [];
  
  // Extract DESTINATION (POD) - Arabic
  for (const keyword of TO_KEYWORDS_AR) {
    const parts = remainingText.split(keyword);
    if (parts.length > 1) {
      const afterTo = parts[1].trim();
      
      // Split by "and" to get multiple destinations
      const destParts = splitByAnd(afterTo);
      for (const part of destParts) {
        const trimmed = part.trim();
        if (trimmed) {
          // Take only the first word/phrase from each part
          const words = trimmed.split(/\s+/);
          pods.push(translateLocation(words[0]));
        }
      }
      
      remainingText = parts[0].trim() + ' ' + afterTo.replace(destParts.join(' و '), '').trim();
      break;
    }
  }

  // Extract DESTINATION (POD) - English
  if (pods.length === 0) {
    for (const keyword of TO_KEYWORDS_EN) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const match = remainingText.match(regex);
      if (match) {
        const parts = remainingText.split(regex);
        if (parts.length > 1) {
          const afterTo = parts[1].trim();
          
          // Split by "and" to get multiple destinations
          const destParts = splitByAnd(afterTo);
          for (const part of destParts) {
            const trimmed = part.trim();
            if (trimmed) {
              // Take only the first word/phrase from each part
              const words = trimmed.split(/\s+/);
              pods.push(translateLocation(words[0]));
            }
          }
          
          remainingText = parts[0].trim() + ' ' + afterTo.replace(destParts.join(' and '), '').trim();
          break;
        }
      }
    }
  }
  
  if (pods.length > 0) {
    result.pod = pods;
  }

  // Clean up remaining text (remove extra spaces, punctuation at edges)
  remainingText = remainingText
    .replace(/\s+/g, ' ')
    .replace(/^[,،\s]+|[,،\s]+$/g, '')
    .trim();

  // Remove common meta-words that are just natural language filler
  // These don't represent actual data to search for
  const metaWords = [
    // Arabic meta-words
    'شحنات', 'شحنة', 'منتجات', 'منتج', 'بضائع', 'بضاعة', 'سلع', 'سلعة',
    'عقود', 'عقد', 'طلبات', 'طلب',
    // English meta-words
    'shipments', 'shipment', 'products', 'product', 'goods', 'cargo',
    'containers', 'container', 'orders', 'order', 'items', 'item'
  ];

  // Remove meta-words from remaining text
  // Split by spaces and filter out exact matches (case-insensitive)
  let cleanedText = remainingText
    .split(/\s+/)
    .filter(word => {
      const lowerWord = word.toLowerCase().trim();
      return !metaWords.some(meta => meta.toLowerCase() === lowerWord);
    })
    .join(' ')
    .trim();

  // Clean up again after removing meta-words
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/^[,،\s]+|[,،\s]+$/g, '')
    .trim();

  // If there's remaining text after filtering meta-words, process it
  // (Exclusions were already extracted at the beginning)
  if (cleanedText && cleanedText.length > 0) {
    // Split by "and" to get multiple products
    const productParts = splitByAnd(cleanedText);
    const products: string[] = [];
    
    for (const part of productParts) {
      const trimmed = part.trim();
      if (trimmed) {
        // First translate Arabic to English (for searching English product data from OCR)
        // Then translate English to Arabic as a fallback (for searching Arabic product data)
        const translatedToEn = translateArabicToEnglish(trimmed);
        const translatedToAr = translateProductNames(trimmed);
        // Use the Arabic->English translation if it changed, otherwise try English->Arabic
        const translated = translatedToEn !== trimmed ? translatedToEn : translatedToAr;
        products.push(translated);
      }
    }
    
    // If we found multiple products, store them separately
    if (products.length > 1) {
      result.products = products;
    } else if (products.length === 1) {
      // Single product goes to generalSearch for backward compatibility
      result.generalSearch = products[0];
    }
  }

  // Also translate any remaining generalSearch terms from Arabic to English
  if (result.generalSearch) {
    const translatedToEn = translateArabicToEnglish(result.generalSearch);
    if (translatedToEn !== result.generalSearch) {
      result.generalSearch = translatedToEn;
    }
  }

  return result;
}

/**
 * Translate common English product names to Arabic
 * This allows users to search in English even though data is in Arabic
 */
function translateProductNames(text: string): string {
  const translations: Record<string, string> = {
    // Spices (English -> Arabic)
    'spices': 'بهار',
    'spice': 'بهار',
    'pepper': 'فلفل',
    'black pepper': 'فلفل أسود',
    'white pepper': 'فلفل أبيض',
    'cumin': 'كمون',
    'coriander': 'كزبرة',
    'turmeric': 'كركم',
    'cardamom': 'هيل',
    'cinnamon': 'قرفة',
    'cloves': 'قرنفل',
    'nutmeg': 'جوزة الطيب',
    'ginger': 'زنجبيل',
    'saffron': 'زعفران',
    'paprika': 'فلفل حلو',
    'chili': 'فلفل حار',
    'fennel': 'شمر',
    'anise': 'ينسون',
    'bay leaf': 'ورق غار',
    'thyme': 'زعتر',
    'oregano': 'أوريجانو',
    'basil': 'ريحان',
    'mint': 'نعناع',
    'parsley': 'بقدونس',
    
    // Grains & Legumes
    'rice': 'رز',
    'basmati': 'بسمتي',
    'jasmine rice': 'رز ياسمين',
    'wheat': 'قمح',
    'flour': 'طحين',
    'lentils': 'عدس',
    'chickpeas': 'حمص',
    'beans': 'فاصوليا',
    'corn': 'ذرة',
    'barley': 'شعير',
    'oats': 'شوفان',
    'quinoa': 'كينوا',
    
    // Wood & Timber
    'merbau': 'ميرباو',
    'teak': 'خشب الساج',
    'oak': 'خشب البلوط',
    'pine': 'خشب الصنوبر',
    'timber': 'أخشاب',
    'wood': 'خشب',
    
    // Other common products
    'sugar': 'سكر',
    'salt': 'ملح',
    'oil': 'زيت',
    'olive oil': 'زيت زيتون',
    'vegetable oil': 'زيت نباتي',
    'tea': 'شاي',
    'coffee': 'قهوة',
    'dates': 'تمر',
    'nuts': 'مكسرات',
    'almonds': 'لوز',
    'cashews': 'كاجو',
    'pistachios': 'فستق',
    'walnuts': 'جوز',
    'sesame': 'سمسم',
    'tahini': 'طحينة',
    'honey': 'عسل',
  };

  let translatedText = text;
  
  // Try to translate each word in the text
  const words = text.toLowerCase().split(/\s+/);
  const translatedWords = words.map(word => {
    // Remove punctuation for matching
    const cleanWord = word.replace(/[.,;:!?]/g, '');
    return translations[cleanWord] || word;
  });
  
  // If any words were translated, use the translated version
  if (translatedWords.some((word, i) => word !== words[i])) {
    translatedText = translatedWords.join(' ');
  }
  
  return translatedText;
}

/**
 * Translate Arabic product names to English for search
 * This allows users to search in Arabic and find English product data (from OCR)
 */
function translateArabicToEnglish(text: string): string {
  const translations: Record<string, string> = {
    // Spices
    'بهار': 'spice',
    'بهارات': 'spices',
    'فلفل': 'pepper',
    'فلفل أسود': 'black pepper',
    'فلفل اسود': 'black pepper',
    'فلفل أبيض': 'white pepper',
    'فلفل ابيض': 'white pepper',
    'كمون': 'cumin',
    'كزبرة': 'coriander',
    'كركم': 'turmeric',
    'هيل': 'cardamom',
    'قرفة': 'cinnamon',
    'قرنفل': 'cloves',
    'زنجبيل': 'ginger',
    'زعفران': 'saffron',
    'شمر': 'fennel',
    'ينسون': 'anise',
    'زعتر': 'thyme',
    'ريحان': 'basil',
    'نعناع': 'mint',
    
    // Grains & Seeds
    'أرز': 'rice',
    'ارز': 'rice',
    'رز': 'rice',
    'بسمتي': 'basmati',
    'قمح': 'wheat',
    'طحين': 'flour',
    'عدس': 'lentils',
    'حمص': 'chickpeas',
    'فاصوليا': 'beans',
    'فاصولياء': 'beans',
    'ذرة': 'corn',
    'شعير': 'barley',
    'شوفان': 'oats',
    'سمسم': 'sesame',
    'بذور سمسم': 'sesame seeds',
    'بذور سمسم أبيض': 'white sesame seeds',
    'بذور سمسم ابيض': 'white sesame seeds',
    'بذور دوار الشمس': 'sunflower seeds',
    'بذور اليقطين': 'pumpkin seeds',
    'بذور الكناري': 'canary seed',
    
    // Sugar & Sweeteners
    'سكر': 'sugar',
    'سكر أبيض': 'white sugar',
    'سكر ابيض': 'white sugar',
    'سكر بني': 'brown sugar',
    'سكر مكعبات': 'lump sugar',
    'سكر حبيبي': 'granulated sugar',
    'عسل': 'honey',
    
    // Oils
    'زيت': 'oil',
    'زيت زيتون': 'olive oil',
    'زيت نباتي': 'vegetable oil',
    'زيت دوار الشمس': 'sunflower oil',
    'زيت ذرة': 'corn oil',
    'زيت نخيل': 'palm oil',
    'زيت جوز الهند': 'coconut oil',
    'زيت فول الصويا': 'soybean oil',
    
    // Nuts & Legumes
    'مكسرات': 'nuts',
    'لوز': 'almonds',
    'كاجو': 'cashews',
    'فستق': 'pistachios',
    'جوز': 'walnuts',
    'فول سوداني': 'peanuts',
    'حبات فول سوداني': 'peanut kernels',
    'حبات فول سوداني مقشرة': 'blanched peanut kernels',
    'مكاديميا': 'macadamia',
    
    // Beverages
    'شاي': 'tea',
    'شاي أخضر': 'green tea',
    'شاي اخضر': 'green tea',
    'شاي أسود': 'black tea',
    'شاي اسود': 'black tea',
    'شاي سيلاني': 'ceylon tea',
    'قهوة': 'coffee',
    
    // Dairy
    'حليب': 'milk',
    'حليب مجفف': 'milk powder',
    'حليب مجفف خالي الدسم': 'skimmed milk powder',
    'حليب مجفف كامل الدسم': 'full cream milk powder',
    'زبدة': 'butter',
    'جبنة': 'cheese',
    
    // Other Products
    'جوز هند': 'coconut',
    'جوز هند مبشور': 'desiccated coconut',
    'مرقة': 'bouillon',
    'مرقة دجاج': 'chicken bouillon',
    'ملح': 'salt',
    'تمر': 'dates',
    'طحينة': 'tahini',
    'ذرة فشار': 'popcorn',
    'دواء': 'medicine',
    'أدوية': 'medicine',
    'ادوية': 'medicine',
  };

  let result = text;
  
  // Sort by length (longest first) to match longer phrases first
  const sortedKeys = Object.keys(translations).sort((a, b) => b.length - a.length);
  
  for (const arabic of sortedKeys) {
    if (result.includes(arabic)) {
      result = result.replace(new RegExp(arabic, 'g'), translations[arabic]);
    }
  }
  
  return result;
}

/**
 * Translate English location names (countries, ports) to Arabic
 */
function translateLocation(location: string): string {
  const locationTranslations: Record<string, string> = {
    // Countries
    'egypt': 'مصر',
    'india': 'الهند',
    'iraq': 'العراق',
    'turkey': 'تركيا',
    'iran': 'إيران',
    'syria': 'سوريا',
    'jordan': 'الأردن',
    'lebanon': 'لبنان',
    'uae': 'الإمارات',
    'saudi': 'السعودية',
    'kuwait': 'الكويت',
    'qatar': 'قطر',
    'bahrain': 'البحرين',
    'oman': 'عمان',
    'yemen': 'اليمن',
    'palestine': 'فلسطين',
    'china': 'الصين',
    'pakistan': 'باكستان',
    'afghanistan': 'أفغانستان',
    
    // Major ports
    'mersin': 'مرسين',
    'alexandria': 'الإسكندرية',
    'mumbai': 'مومباي',
    'karachi': 'كراتشي',
    'dubai': 'دبي',
    'jeddah': 'جدة',
    'beirut': 'بيروت',
    'aqaba': 'العقبة',
    'basra': 'البصرة',
    'umm qasr': 'أم قصر',
    'bandar abbas': 'بندر عباس',
    'istanbul': 'اسطنبول',
  };

  const lowerLocation = location.toLowerCase().trim();
  return locationTranslations[lowerLocation] || location;
}

/**
 * Format parsed search back to readable text for display
 */
export function formatParsedSearch(parsed: ParsedSearch, language: 'ar' | 'en' = 'ar'): string {
  const parts: string[] = [];

  if (parsed.generalSearch) {
    parts.push(parsed.generalSearch);
  }
  
  if (parsed.products && parsed.products.length > 0) {
    parts.push(parsed.products.join(language === 'ar' ? ' و ' : ' and '));
  }

  if (parsed.pol && parsed.pol.length > 0) {
    const polText = parsed.pol.join(language === 'ar' ? ' و ' : ' and ');
    parts.push(language === 'ar' ? `من ${polText}` : `from ${polText}`);
  }

  if (parsed.pod && parsed.pod.length > 0) {
    const podText = parsed.pod.join(language === 'ar' ? ' و ' : ' and ');
    parts.push(language === 'ar' ? `إلى ${podText}` : `to ${podText}`);
  }
  
  if (parsed.excludeProducts && parsed.excludeProducts.length > 0) {
    const excludeText = parsed.excludeProducts.join(language === 'ar' ? ' و ' : ' and ');
    parts.push(language === 'ar' ? `عدا ${excludeText}` : `except ${excludeText}`);
  }

  if (parsed.month) {
    const monthName = language === 'ar' 
      ? Object.keys(ARABIC_MONTHS).find(k => ARABIC_MONTHS[k] === parsed.month)
      : Object.keys(ENGLISH_MONTHS).find(k => ENGLISH_MONTHS[k] === parsed.month);
    if (monthName) {
      parts.push(monthName);
    }
  }

  if (parsed.year) {
    parts.push(parsed.year.toString());
  }

  return parts.join(' ');
}

/**
 * Generate helpful search examples
 */
export function getSearchExamples(language: 'ar' | 'en' = 'ar'): string[] {
  if (language === 'ar') {
    return [
      'بهار من الهند والصين عدا القرفة',
      'رز وفلفل من مصر',
      'أدنى سعر تثبيت فلفل',
      'شحنات إلى العراق والإمارات',
      'شحنات إلى مرسين القيمة أقل من 50000',
      'أعلى رصيد متبقي',
    ];
  } else {
    return [
      'spices from India and China except cinnamon',
      'rice and pepper from Egypt',
      'lowest price per ton for pepper',
      'shipments to Iraq and UAE',
      'shipments to Mersin value less than 50000',
      'highest remaining balance',
    ];
  }
}

