/**
 * Finance Search Parser
 * Parses natural language queries for financial transactions in Arabic and English
 */

export interface ParsedFinanceSearch {
  generalSearch?: string;  // General search across description, party, fund
  fund?: string[];         // Fund/Account names
  party?: string[];        // Party names
  direction?: 'in' | 'out'; // Income or Expense
  transactionType?: string[]; // Transaction types
  currency?: string[];     // Currency types
  // Date range filters
  dateFrom?: string;       // Transaction date start (YYYY-MM-DD)
  dateTo?: string;         // Transaction date end (YYYY-MM-DD)
  // Numeric filters with operators
  amountUsd?: { operator: string; value: number };
  amountOther?: { operator: string; value: number };
  // Auto-sort instructions
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// Keywords for direction
const INCOME_KEYWORDS_AR = ['دخول', 'دخل', 'إيراد', 'وارد'];
const INCOME_KEYWORDS_EN = ['income', 'in', 'incoming', 'revenue', 'received'];
const EXPENSE_KEYWORDS_AR = ['خروج', 'مصروف', 'صادر', 'دفع', 'مدفوع'];
const EXPENSE_KEYWORDS_EN = ['expense', 'out', 'outgoing', 'payment', 'paid'];

// Transaction type keywords
const TRANSACTION_TYPE_MAP_AR: Record<string, string> = {
  'حوالة': 'bank_transfer',
  'بنكية': 'bank_transfer',
  'صراف': 'exchange',
  'نقد': 'cash',
  'شيك': 'check',
  'بطاقة': 'credit_card',
};

const TRANSACTION_TYPE_MAP_EN: Record<string, string> = {
  'transfer': 'bank_transfer',
  'bank': 'bank_transfer',
  'exchange': 'exchange',
  'cash': 'cash',
  'check': 'check',
  'cheque': 'check',
  'card': 'credit_card',
  'credit': 'credit_card',
};

// Month names in Arabic
const ARABIC_MONTHS: Record<string, number> = {
  'يناير': 1, 'كانون الثاني': 1,
  'فبراير': 2, 'شباط': 2,
  'مارس': 3, 'آذار': 3,
  'أبريل': 4, 'نيسان': 4,
  'مايو': 5, 'أيار': 5,
  'يونيو': 6, 'حزيران': 6,
  'يوليو': 7, 'تموز': 7,
  'أغسطس': 8, 'آب': 8,
  'سبتمبر': 9, 'أيلول': 9,
  'أكتوبر': 10, 'تشرين الأول': 10,
  'نوفمبر': 11, 'تشرين الثاني': 11,
  'ديسمبر': 12, 'كانون الأول': 12,
};

const ENGLISH_MONTHS: Record<string, number> = {
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12,
};

/**
 * Parse smart date keywords
 */
function parseSmartDate(text: string): { from?: string; to?: string } | null {
  const today = new Date();
  const lowerText = text.toLowerCase();
  
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // "Last X days"
  const lastDaysMatch = lowerText.match(/(?:last|آخر|اخر)\s+(\d+)\s+(?:days?|يوم|ايام)/);
  if (lastDaysMatch) {
    const days = parseInt(lastDaysMatch[1]);
    const from = new Date(today);
    from.setDate(today.getDate() - days);
    return { from: formatDate(from), to: formatDate(today) };
  }

  // "This month"
  if (/(?:this month|هذا الشهر)/.test(lowerText)) {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatDate(from), to: formatDate(today) };
  }

  // "Last month"
  if (/(?:last month|الشهر الماضي|الشهر السابق)/.test(lowerText)) {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: formatDate(from), to: formatDate(to) };
  }

  // "This year"
  if (/(?:this year|هذا العام|هذه السنة)/.test(lowerText)) {
    const from = new Date(today.getFullYear(), 0, 1);
    return { from: formatDate(from), to: formatDate(today) };
  }

  return null;
}

/**
 * Parse numeric comparisons (>, <, >=, <=, =)
 */
function parseNumericFilter(text: string): { operator: string; value: number } | null {
  // Match patterns like ">1000", "< 500", ">=2000"
  const match = text.match(/([><=]+)\s*(\d+(?:\.\d+)?)/);
  if (match) {
    return {
      operator: match[1].trim(),
      value: parseFloat(match[2])
    };
  }
  return null;
}

/**
 * Main search parser
 */
export function parseFinanceSearch(query: string): ParsedFinanceSearch {
  if (!query || query.trim() === '') {
    return {};
  }

  const result: ParsedFinanceSearch = {};
  const lowerQuery = query.toLowerCase();
  let remainingText = query;

  // Parse direction (income/expense)
  const incomeMatch = [...INCOME_KEYWORDS_AR, ...INCOME_KEYWORDS_EN].some(kw => 
    lowerQuery.includes(kw.toLowerCase())
  );
  const expenseMatch = [...EXPENSE_KEYWORDS_AR, ...EXPENSE_KEYWORDS_EN].some(kw => 
    lowerQuery.includes(kw.toLowerCase())
  );
  
  if (incomeMatch && !expenseMatch) {
    result.direction = 'in';
  } else if (expenseMatch && !incomeMatch) {
    result.direction = 'out';
  }

  // Parse transaction types
  const transactionTypes: string[] = [];
  Object.entries({...TRANSACTION_TYPE_MAP_AR, ...TRANSACTION_TYPE_MAP_EN}).forEach(([keyword, type]) => {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      if (!transactionTypes.includes(type)) {
        transactionTypes.push(type);
      }
    }
  });
  if (transactionTypes.length > 0) {
    result.transactionType = transactionTypes;
  }

  // Parse smart dates
  const smartDate = parseSmartDate(query);
  if (smartDate) {
    if (smartDate.from) result.dateFrom = smartDate.from;
    if (smartDate.to) result.dateTo = smartDate.to;
  }

  // Parse month and year
  Object.entries({...ARABIC_MONTHS, ...ENGLISH_MONTHS}).forEach(([monthName, monthNum]) => {
    if (lowerQuery.includes(monthName.toLowerCase())) {
      const yearMatch = query.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        const to = new Date(year, monthNum, 0);
        result.dateFrom = `${year}-${String(monthNum).padStart(2, '0')}-01`;
        result.dateTo = `${year}-${String(monthNum).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
      }
    }
  });

  // Parse amount filters
  const amountMatch = query.match(/(?:amount|مبلغ|قيمة)\s*([><=]+\s*\d+(?:\.\d+)?)/i);
  if (amountMatch) {
    const numFilter = parseNumericFilter(amountMatch[1]);
    if (numFilter) {
      result.amountUsd = numFilter;
    }
  }

  // Parse sort instructions
  if (/(?:highest|أعلى|الأعلى)/i.test(query)) {
    result.sortBy = 'amount_usd';
    result.sortDir = 'desc';
  } else if (/(?:lowest|أقل|الأقل)/i.test(query)) {
    result.sortBy = 'amount_usd';
    result.sortDir = 'asc';
  } else if (/(?:newest|latest|أحدث|الأحدث)/i.test(query)) {
    result.sortBy = 'transaction_date';
    result.sortDir = 'desc';
  } else if (/(?:oldest|أقدم|الأقدم)/i.test(query)) {
    result.sortBy = 'transaction_date';
    result.sortDir = 'asc';
  }

  // Everything else becomes general search
  let generalSearch = remainingText;
  
  // Remove parsed keywords from general search
  [...INCOME_KEYWORDS_AR, ...INCOME_KEYWORDS_EN,
   ...EXPENSE_KEYWORDS_AR, ...EXPENSE_KEYWORDS_EN,
   ...Object.keys(TRANSACTION_TYPE_MAP_AR), ...Object.keys(TRANSACTION_TYPE_MAP_EN)
  ].forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    generalSearch = generalSearch.replace(regex, '');
  });

  generalSearch = generalSearch.trim().replace(/\s+/g, ' ');
  
  if (generalSearch) {
    result.generalSearch = generalSearch;
  }

  return result;
}

/**
 * Get search examples for the smart search hint
 */
export function getFinanceSearchExamples(language: 'en' | 'ar'): string[] {
  if (language === 'ar') {
    return [
      'دخول آخر 30 يوم',
      'مصروفات نوفمبر 2025',
      'حوالة بنكية أكثر من 1000',
      'صراف أبو يزن',
      'أعلى المبالغ هذا الشهر',
    ];
  }
  return [
    'income last 30 days',
    'expenses November 2025',
    'bank transfer > 1000',
    'exchange Abu Yazan',
    'highest amounts this month',
  ];
}

