/**
 * Shipment Validation Module
 * 
 * Provides smart validation rules that catch illogical data combinations.
 * Used by both frontend (instant feedback) and backend (security).
 */

import type { ShipmentFormData } from '../components/shipments/wizard/types';

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

export interface ValidationRule {
  id: string;
  severity: ValidationSeverity;
  check: (data: Partial<ShipmentFormData>) => boolean; // Returns true if issue exists
  getMessage: (data: Partial<ShipmentFormData>) => { message: string; messageAr?: string; details?: string };
  field?: string;
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
// Validation Rules - Hard Blocks (Errors)
// ============================================================================

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

  // Weight must be greater than 0 (when cargo type requires it)
  {
    id: 'weight-required',
    severity: 'error',
    field: 'weight_ton',
    check: (data) => {
      // Skip for tankers (use barrels instead)
      if (data.cargo_type === 'tanker') return false;
      const weight = toNumber(data.weight_ton);
      // Only error if container_count or cargo_type is set (meaning user is filling this)
      const hasContainers = toNumber(data.container_count) > 0;
      const hasTrucks = toNumber(data.truck_count) > 0;
      const hasCargoType = !!data.cargo_type;
      return (hasContainers || hasTrucks || hasCargoType) && weight <= 0;
    },
    getMessage: () => ({
      message: 'Weight must be greater than 0',
      messageAr: 'الوزن يجب أن يكون أكبر من صفر',
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

// ============================================================================
// Validation Rules - Soft Warnings
// ============================================================================

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
      return weightPerContainer < 5; // Less than 5 MT per container is suspicious
    },
    getMessage: (data) => {
      const containers = toNumber(data.container_count);
      const weight = toNumber(data.weight_ton);
      const weightPerContainer = (weight / containers).toFixed(2);
      return {
        message: `Weight per container (~${weightPerContainer} MT) seems too low. Typical: 15-25 MT`,
        messageAr: `الوزن لكل حاوية (~${weightPerContainer} طن) يبدو منخفضاً جداً. المعتاد: 15-25 طن`,
        details: `${containers} containers × ~${weightPerContainer} MT = ${weight} MT total`,
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
      return weightPerContainer > 30; // More than 30 MT per container is suspicious
    },
    getMessage: (data) => {
      const containers = toNumber(data.container_count);
      const weight = toNumber(data.weight_ton);
      const weightPerContainer = (weight / containers).toFixed(2);
      return {
        message: `Weight per container (~${weightPerContainer} MT) seems too high. Typical: 15-25 MT`,
        messageAr: `الوزن لكل حاوية (~${weightPerContainer} طن) يبدو مرتفعاً جداً. المعتاد: 15-25 طن`,
        details: `${containers} containers × ~${weightPerContainer} MT = ${weight} MT total`,
      };
    },
  },

  // Price too low (suspicious)
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

  // Price too high (suspicious)
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

  // Bag weight unusual
  {
    id: 'bag-weight-unusual',
    severity: 'warning',
    field: 'weight_ton',
    check: (data) => {
      // Check from product lines if available
      const lines = data.lines || [];
      for (const line of lines) {
        const bags = toNumber(line.bags_count || line.number_of_packages);
        const weightMt = toNumber(line.quantity_mt);
        if (bags > 0 && weightMt > 0) {
          const kgPerBag = (weightMt * 1000) / bags;
          if (kgPerBag < 10 || kgPerBag > 100) {
            return true;
          }
        }
      }
      return false;
    },
    getMessage: (data) => {
      const lines = data.lines || [];
      for (const line of lines) {
        const bags = toNumber(line.bags_count || line.number_of_packages);
        const weightMt = toNumber(line.quantity_mt);
        if (bags > 0 && weightMt > 0) {
          const kgPerBag = (weightMt * 1000) / bags;
          if (kgPerBag < 10 || kgPerBag > 100) {
            return {
              message: `Bag weight (~${kgPerBag.toFixed(1)}kg) seems unusual. Typical: 25-50kg`,
              messageAr: `وزن الكيس (~${kgPerBag.toFixed(1)}كجم) يبدو غير اعتيادي. المعتاد: 25-50 كجم`,
            };
          }
        }
      }
      return { message: 'Bag weight seems unusual' };
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

  // Total value mismatch between lines and expected
  {
    id: 'value-mismatch',
    severity: 'warning',
    field: 'lines',
    check: (data) => {
      const lines = data.lines || [];
      if (lines.length === 0) return false;
      
      const weight = toNumber(data.weight_ton);
      const price = toNumber(data.fixed_price_usd_per_ton);
      if (weight <= 0 || price <= 0) return false;
      
      const expectedValue = weight * price;
      const linesTotal = lines.reduce((sum, line) => sum + toNumber(line.amount_usd), 0);
      
      if (linesTotal <= 0) return false;
      
      const diff = Math.abs(expectedValue - linesTotal) / expectedValue;
      return diff > 0.05; // More than 5% difference
    },
    getMessage: (data) => {
      const lines = data.lines || [];
      const weight = toNumber(data.weight_ton);
      const price = toNumber(data.fixed_price_usd_per_ton);
      const expectedValue = weight * price;
      const linesTotal = lines.reduce((sum, line) => sum + toNumber(line.amount_usd), 0);
      const diffPct = ((Math.abs(expectedValue - linesTotal) / expectedValue) * 100).toFixed(1);
      
      return {
        message: `Line totals ($${linesTotal.toLocaleString()}) differ from expected value ($${expectedValue.toLocaleString()}) by ${diffPct}%`,
        messageAr: `مجموع البنود (${linesTotal.toLocaleString()}$) يختلف عن القيمة المتوقعة (${expectedValue.toLocaleString()}$) بنسبة ${diffPct}%`,
      };
    },
  },

  // Truck count vs weight (for truck cargo)
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
      // Trucks typically carry 20-40 MT
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

export function validateShipment(data: Partial<ShipmentFormData>): ValidationResult {
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

// ============================================================================
// Field-Specific Validation (for individual step validation)
// ============================================================================

export function validateCommercialTerms(data: Partial<ShipmentFormData>): ValidationResult {
  const relevantRuleIds = [
    'weight-required',
    'negative-price',
    'container-weight-too-low',
    'container-weight-too-high',
    'price-too-low',
    'price-too-high',
    'truck-weight-unusual',
  ];
  
  return filterValidationResult(validateShipment(data), relevantRuleIds);
}

export function validateLogistics(data: Partial<ShipmentFormData>): ValidationResult {
  const relevantRuleIds = [
    'date-etd-after-eta',
    'date-clearance-before-eta',
    'eta-too-far-future',
    'etd-too-far-past',
    'lc-expiry-before-eta',
  ];
  
  return filterValidationResult(validateShipment(data), relevantRuleIds);
}

export function validateFinancials(data: Partial<ShipmentFormData>): ValidationResult {
  const relevantRuleIds = [
    'lc-number-required',
    'lc-expiry-before-eta',
  ];
  
  return filterValidationResult(validateShipment(data), relevantRuleIds);
}

export function validateProductLines(data: Partial<ShipmentFormData>): ValidationResult {
  const relevantRuleIds = [
    'bag-weight-unusual',
    'value-mismatch',
  ];
  
  return filterValidationResult(validateShipment(data), relevantRuleIds);
}

function filterValidationResult(result: ValidationResult, ruleIds: string[]): ValidationResult {
  const errors = result.errors.filter(e => ruleIds.includes(e.id));
  const warnings = result.warnings.filter(w => ruleIds.includes(w.id));
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Export individual rules for testing
// ============================================================================

export const rules = {
  error: errorRules,
  warning: warningRules,
};

