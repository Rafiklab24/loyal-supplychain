/**
 * Shipment Logic Validation
 * 
 * Server-side validation that mirrors frontend validation rules.
 * Used to validate shipment data before INSERT to catch illogical combinations.
 */

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  field?: string;
  message: string;
  messageAr?: string;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ShipmentData {
  // Cargo info
  cargo_type?: string;
  tanker_type?: string;
  container_count?: number | string;
  truck_count?: number | string;
  weight_ton?: number | string;
  barrels?: number | string;
  
  // Dates
  etd?: string;
  eta?: string;
  customs_clearance_date?: string;
  lc_expiry_date?: string;
  
  // Payment
  payment_method?: string;
  lc_number?: string;
  
  // Pricing
  fixed_price_usd_per_ton?: number | string;
  fixed_price_usd_per_barrel?: number | string;
  
  // Product lines
  lines?: Array<{
    quantity_mt?: number | string;
    bags_count?: number | string;
    number_of_packages?: number | string;
    amount_usd?: number | string;
    unit_price?: number | string;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

const toNumber = (value: number | string | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

const parseDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const daysDiff = (date1: Date, date2: Date): number => {
  return Math.round((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================================================
// Validation Rules
// ============================================================================

interface ValidationRule {
  id: string;
  severity: ValidationSeverity;
  check: (data: ShipmentData) => boolean;
  getMessage: (data: ShipmentData) => { message: string; messageAr?: string; details?: string };
  field?: string;
}

const errorRules: ValidationRule[] = [
  // ETD cannot be after ETA
  {
    id: 'date-etd-after-eta',
    severity: 'error',
    field: 'etd',
    check: (data) => {
      const etd = parseDate(data.etd);
      const eta = parseDate(data.eta);
      if (!etd || !eta) return false;
      return etd > eta;
    },
    getMessage: () => ({
      message: 'ETD cannot be after ETA',
      messageAr: 'تاريخ المغادرة لا يمكن أن يكون بعد تاريخ الوصول',
    }),
  },

  // Clearance date cannot be before ETA
  {
    id: 'date-clearance-before-eta',
    severity: 'error',
    field: 'customs_clearance_date',
    check: (data) => {
      const clearance = parseDate(data.customs_clearance_date);
      const eta = parseDate(data.eta);
      if (!clearance || !eta) return false;
      return clearance < eta;
    },
    getMessage: () => ({
      message: 'Clearance date cannot be before arrival (ETA)',
      messageAr: 'تاريخ التخليص لا يمكن أن يكون قبل تاريخ الوصول',
    }),
  },

  // LC number required when payment method is letter_of_credit
  {
    id: 'lc-number-required',
    severity: 'error',
    field: 'lc_number',
    check: (data) => {
      return data.payment_method === 'letter_of_credit' && !data.lc_number?.trim();
    },
    getMessage: () => ({
      message: 'LC number is required for Letter of Credit payment',
      messageAr: 'رقم الاعتماد المستندي مطلوب عند اختيار الدفع بالاعتماد',
    }),
  },

  // Negative prices not allowed
  {
    id: 'negative-price',
    severity: 'error',
    field: 'fixed_price_usd_per_ton',
    check: (data) => {
      const price = toNumber(data.fixed_price_usd_per_ton);
      return price < 0;
    },
    getMessage: () => ({
      message: 'Price cannot be negative',
      messageAr: 'السعر لا يمكن أن يكون سالباً',
    }),
  },

  // LC expiry cannot be before ETA
  {
    id: 'lc-expiry-before-eta',
    severity: 'error',
    field: 'lc_expiry_date',
    check: (data) => {
      if (data.payment_method !== 'letter_of_credit') return false;
      const lcExpiry = parseDate(data.lc_expiry_date);
      const eta = parseDate(data.eta);
      if (!lcExpiry || !eta) return false;
      return lcExpiry < eta;
    },
    getMessage: () => ({
      message: 'LC expiry date cannot be before ETA',
      messageAr: 'تاريخ انتهاء الاعتماد لا يمكن أن يكون قبل تاريخ الوصول',
    }),
  },
];

const warningRules: ValidationRule[] = [
  // Container weight too low - ONLY for container cargo type
  {
    id: 'container-weight-too-low',
    severity: 'warning',
    field: 'weight_ton',
    check: (data) => {
      // Only apply to freight containers cargo type
      if (data.cargo_type !== 'containers') return false;
      
      const containers = toNumber(data.container_count);
      const weight = toNumber(data.weight_ton);
      if (containers <= 0 || weight <= 0) return false;
      const weightPerContainer = weight / containers;
      return weightPerContainer < 5;
    },
    getMessage: (data) => {
      const containers = toNumber(data.container_count);
      const weight = toNumber(data.weight_ton);
      const weightPerContainer = (weight / containers).toFixed(2);
      return {
        message: `Weight per container (~${weightPerContainer} MT) seems too low. Typical: 15-25 MT`,
        messageAr: `الوزن لكل حاوية (~${weightPerContainer} طن) يبدو منخفضاً جداً. المعتاد: 15-25 طن`,
      };
    },
  },

  // Container weight too high - ONLY for container cargo type
  {
    id: 'container-weight-too-high',
    severity: 'warning',
    field: 'weight_ton',
    check: (data) => {
      // Only apply to freight containers cargo type
      if (data.cargo_type !== 'containers') return false;
      
      const containers = toNumber(data.container_count);
      const weight = toNumber(data.weight_ton);
      if (containers <= 0 || weight <= 0) return false;
      const weightPerContainer = weight / containers;
      return weightPerContainer > 30;
    },
    getMessage: (data) => {
      const containers = toNumber(data.container_count);
      const weight = toNumber(data.weight_ton);
      const weightPerContainer = (weight / containers).toFixed(2);
      return {
        message: `Weight per container (~${weightPerContainer} MT) seems too high. Typical: 15-25 MT`,
        messageAr: `الوزن لكل حاوية (~${weightPerContainer} طن) يبدو مرتفعاً جداً. المعتاد: 15-25 طن`,
      };
    },
  },

  // Price too low
  {
    id: 'price-too-low',
    severity: 'warning',
    field: 'fixed_price_usd_per_ton',
    check: (data) => {
      const price = toNumber(data.fixed_price_usd_per_ton);
      return price > 0 && price < 10;
    },
    getMessage: (data) => {
      const price = toNumber(data.fixed_price_usd_per_ton);
      return {
        message: `Price $${price}/MT seems unusually low`,
        messageAr: `السعر ${price}$/طن يبدو منخفضاً بشكل غير اعتيادي`,
      };
    },
  },

  // Price too high
  {
    id: 'price-too-high',
    severity: 'warning',
    field: 'fixed_price_usd_per_ton',
    check: (data) => {
      const price = toNumber(data.fixed_price_usd_per_ton);
      return price > 5000;
    },
    getMessage: (data) => {
      const price = toNumber(data.fixed_price_usd_per_ton);
      return {
        message: `Price $${price}/MT seems unusually high`,
        messageAr: `السعر ${price}$/طن يبدو مرتفعاً بشكل غير اعتيادي`,
      };
    },
  },

  // ETA too far in future
  {
    id: 'eta-too-far-future',
    severity: 'warning',
    field: 'eta',
    check: (data) => {
      const eta = parseDate(data.eta);
      if (!eta) return false;
      const today = new Date();
      return daysDiff(eta, today) > 365;
    },
    getMessage: (data) => {
      const eta = parseDate(data.eta);
      const today = new Date();
      const days = eta ? daysDiff(eta, today) : 0;
      return {
        message: `ETA is ${days} days (~${Math.round(days / 30)} months) in the future`,
        messageAr: `تاريخ الوصول بعد ${days} يوم (~${Math.round(days / 30)} شهر) في المستقبل`,
      };
    },
  },

  // ETD too far in past
  {
    id: 'etd-too-far-past',
    severity: 'warning',
    field: 'etd',
    check: (data) => {
      const etd = parseDate(data.etd);
      if (!etd) return false;
      const today = new Date();
      return daysDiff(today, etd) > 30;
    },
    getMessage: (data) => {
      const etd = parseDate(data.etd);
      const today = new Date();
      const days = etd ? daysDiff(today, etd) : 0;
      return {
        message: `ETD is ${days} days in the past`,
        messageAr: `تاريخ المغادرة منذ ${days} يوم في الماضي`,
      };
    },
  },

  // Truck weight unusual
  {
    id: 'truck-weight-unusual',
    severity: 'warning',
    field: 'weight_ton',
    check: (data) => {
      if (data.cargo_type !== 'trucks') return false;
      const trucks = toNumber(data.truck_count);
      const weight = toNumber(data.weight_ton);
      if (trucks <= 0 || weight <= 0) return false;
      const weightPerTruck = weight / trucks;
      return weightPerTruck < 10 || weightPerTruck > 50;
    },
    getMessage: (data) => {
      const trucks = toNumber(data.truck_count);
      const weight = toNumber(data.weight_ton);
      const weightPerTruck = (weight / trucks).toFixed(2);
      return {
        message: `Weight per truck (~${weightPerTruck} MT) seems unusual. Typical: 20-40 MT`,
        messageAr: `الوزن لكل شاحنة (~${weightPerTruck} طن) يبدو غير اعتيادي. المعتاد: 20-40 طن`,
      };
    },
  },
];

// ============================================================================
// Main Validation Function
// ============================================================================

export function validateShipmentLogic(data: ShipmentData): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Run error rules
  for (const rule of errorRules) {
    if (rule.check(data)) {
      const { message, messageAr, details } = rule.getMessage(data);
      errors.push({
        id: rule.id,
        severity: 'error',
        field: rule.field,
        message,
        messageAr,
        details,
      });
    }
  }

  // Run warning rules
  for (const rule of warningRules) {
    if (rule.check(data)) {
      const { message, messageAr, details } = rule.getMessage(data);
      warnings.push({
        id: rule.id,
        severity: 'warning',
        field: rule.field,
        message,
        messageAr,
        details,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export default validateShipmentLogic;

