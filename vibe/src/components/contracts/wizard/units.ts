/**
 * Comprehensive Units System for Supply Chain & Logistics
 * Covers ALL possible measurement types used in international trade
 * Date: 2025-11-18
 */

// ========== WEIGHT/MASS UNITS ==========

export type WeightUnit = 'MT' | 'KG' | 'LB' | 'TON' | 'G' | 'OZ';

export const WEIGHT_UNITS = [
  { value: 'MT', label: 'MT - Metric Ton (1000 kg)', symbol: 'MT', toKg: 1000 },
  { value: 'KG', label: 'KG - Kilogram', symbol: 'kg', toKg: 1 },
  { value: 'LB', label: 'LB - Pound', symbol: 'lb', toKg: 0.453592 },
  { value: 'TON', label: 'TON - US Ton (2000 lbs)', symbol: 'ton', toKg: 907.185 },
  { value: 'G', label: 'G - Gram', symbol: 'g', toKg: 0.001 },
  { value: 'OZ', label: 'OZ - Ounce', symbol: 'oz', toKg: 0.0283495 },
] as const;

// ========== VOLUME UNITS ==========

export type VolumeUnit = 'L' | 'ML' | 'GAL' | 'CBM' | 'CBF' | 'FL_OZ';

export const VOLUME_UNITS = [
  { value: 'L', label: 'L - Liter', symbol: 'L', toLiters: 1 },
  { value: 'ML', label: 'ML - Milliliter', symbol: 'ml', toLiters: 0.001 },
  { value: 'GAL', label: 'GAL - US Gallon', symbol: 'gal', toLiters: 3.78541 },
  { value: 'CBM', label: 'CBM - Cubic Meter', symbol: 'm³', toLiters: 1000 },
  { value: 'CBF', label: 'CBF - Cubic Foot', symbol: 'ft³', toLiters: 28.3168 },
  { value: 'FL_OZ', label: 'FL OZ - Fluid Ounce', symbol: 'fl oz', toLiters: 0.0295735 },
] as const;

// ========== PACKAGE SIZE UNITS (Combined) ==========

export type PackageSizeUnit = WeightUnit | VolumeUnit | 'PIECE';

export const PACKAGE_SIZE_UNITS = [
  // Weight-based
  { value: 'KG', label: 'KG - Kilogram', symbol: 'kg', type: 'weight' },
  { value: 'LB', label: 'LB - Pound', symbol: 'lb', type: 'weight' },
  { value: 'G', label: 'G - Gram', symbol: 'g', type: 'weight' },
  { value: 'OZ', label: 'OZ - Ounce', symbol: 'oz', type: 'weight' },
  
  // Volume-based
  { value: 'L', label: 'L - Liter', symbol: 'L', type: 'volume' },
  { value: 'ML', label: 'ML - Milliliter', symbol: 'ml', type: 'volume' },
  { value: 'GAL', label: 'GAL - Gallon', symbol: 'gal', type: 'volume' },
  { value: 'FL_OZ', label: 'FL OZ - Fluid Ounce', symbol: 'fl oz', type: 'volume' },
  
  // Count-based
  { value: 'PIECE', label: 'PIECE - Individual Item', symbol: 'pc', type: 'count' },
] as const;

// ========== PRICING METHODS (Expanded) ==========

export type PricingMethod = 
  | 'per_mt' 
  | 'per_kg' 
  | 'per_lb' 
  | 'per_ton'
  | 'per_barrel'
  | 'per_package' 
  | 'per_piece'
  | 'per_pallet'
  | 'per_cbm'
  | 'per_liter'
  | 'total';

export const PRICING_METHODS = [
  // Weight-based pricing
  { value: 'per_mt', label: 'Price per MT (Metric Ton)', icon: '⚖️', category: 'weight' },
  { value: 'per_kg', label: 'Price per KG (Kilogram)', icon: '⚖️', category: 'weight' },
  { value: 'per_lb', label: 'Price per LB (Pound)', icon: '⚖️', category: 'weight' },
  { value: 'per_ton', label: 'Price per TON (US Ton)', icon: '⚖️', category: 'weight' },
  
  // Volume-based pricing (for crude oil, liquids)
  { value: 'per_barrel', label: 'Price per Barrel', icon: '🛢️', category: 'volume' },
  
  // Package-based pricing
  { value: 'per_package', label: 'Price per Package/Bag/Carton', icon: '📦', category: 'package' },
  { value: 'per_piece', label: 'Price per Piece/Unit', icon: '🔢', category: 'package' },
  { value: 'per_pallet', label: 'Price per Pallet', icon: '🪵', category: 'package' },
  
  // Volume-based pricing
  { value: 'per_cbm', label: 'Price per CBM (Cubic Meter)', icon: '📐', category: 'volume' },
  { value: 'per_liter', label: 'Price per Liter', icon: '🧴', category: 'volume' },
  
  // Custom pricing
  { value: 'total', label: 'Total Amount (No calculation)', icon: '💰', category: 'custom' },
] as const;

// ========== CURRENCY UNITS (Comprehensive) ==========

export type CurrencyCode = 
  | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'AED' | 'SAR' | 'INR' 
  | 'TRY' | 'CAD' | 'AUD' | 'BRL' | 'MXN' | 'ZAR' | 'KRW' 
  | 'SGD' | 'HKD' | 'CHF' | 'SEK' | 'NOK' | 'DKK' | 'PLN'
  | 'THB' | 'MYR' | 'IDR' | 'PHP' | 'VND' | 'EGP' | 'PKR';

export const CURRENCIES = [
  // Major Global Currencies
  { value: 'USD', label: 'USD - US Dollar ($)', symbol: '$', region: 'Americas' },
  { value: 'EUR', label: 'EUR - Euro (€)', symbol: '€', region: 'Europe' },
  { value: 'GBP', label: 'GBP - British Pound (£)', symbol: '£', region: 'Europe' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)', symbol: '¥', region: 'Asia' },
  { value: 'CNY', label: 'CNY - Chinese Yuan (¥)', symbol: '¥', region: 'Asia' },
  
  // Middle East & Africa
  { value: 'AED', label: 'AED - UAE Dirham', symbol: 'د.إ', region: 'Middle East' },
  { value: 'SAR', label: 'SAR - Saudi Riyal', symbol: 'ر.س', region: 'Middle East' },
  { value: 'EGP', label: 'EGP - Egyptian Pound', symbol: 'E£', region: 'Africa' },
  { value: 'ZAR', label: 'ZAR - South African Rand', symbol: 'R', region: 'Africa' },
  
  // Asia Pacific
  { value: 'INR', label: 'INR - Indian Rupee (₹)', symbol: '₹', region: 'Asia' },
  { value: 'KRW', label: 'KRW - South Korean Won', symbol: '₩', region: 'Asia' },
  { value: 'SGD', label: 'SGD - Singapore Dollar', symbol: 'S$', region: 'Asia' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar', symbol: 'HK$', region: 'Asia' },
  { value: 'THB', label: 'THB - Thai Baht', symbol: '฿', region: 'Asia' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit', symbol: 'RM', region: 'Asia' },
  { value: 'IDR', label: 'IDR - Indonesian Rupiah', symbol: 'Rp', region: 'Asia' },
  { value: 'PHP', label: 'PHP - Philippine Peso', symbol: '₱', region: 'Asia' },
  { value: 'VND', label: 'VND - Vietnamese Dong', symbol: '₫', region: 'Asia' },
  { value: 'PKR', label: 'PKR - Pakistani Rupee', symbol: '₨', region: 'Asia' },
  
  // Americas
  { value: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$', region: 'Americas' },
  { value: 'BRL', label: 'BRL - Brazilian Real', symbol: 'R$', region: 'Americas' },
  { value: 'MXN', label: 'MXN - Mexican Peso', symbol: 'Mex$', region: 'Americas' },
  
  // Europe (non-Euro)
  { value: 'TRY', label: 'TRY - Turkish Lira', symbol: '₺', region: 'Europe' },
  { value: 'CHF', label: 'CHF - Swiss Franc', symbol: 'CHF', region: 'Europe' },
  { value: 'SEK', label: 'SEK - Swedish Krona', symbol: 'kr', region: 'Europe' },
  { value: 'NOK', label: 'NOK - Norwegian Krone', symbol: 'kr', region: 'Europe' },
  { value: 'DKK', label: 'DKK - Danish Krone', symbol: 'kr', region: 'Europe' },
  { value: 'PLN', label: 'PLN - Polish Zloty', symbol: 'zł', region: 'Europe' },
  
  // Australia
  { value: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$', region: 'Oceania' },
] as const;

// ========== CONVERSION UTILITIES ==========

/**
 * Convert any weight unit to Kilograms
 */
export function convertToKg(value: number, unit: WeightUnit): number {
  const unitData = WEIGHT_UNITS.find(u => u.value === unit);
  return value * (unitData?.toKg || 1);
}

/**
 * Convert any weight to Metric Tons (MT)
 */
export function convertToMT(value: number, unit: WeightUnit): number {
  return convertToKg(value, unit) / 1000;
}

/**
 * Convert any volume unit to Liters
 */
export function convertToLiters(value: number, unit: VolumeUnit): number {
  const unitData = VOLUME_UNITS.find(u => u.value === unit);
  return value * (unitData?.toLiters || 1);
}

/**
 * Calculate total weight in MT from packages
 */
export function calculateTotalMT(
  numberOfPackages: number,
  packageSize: number,
  packageUnit: PackageSizeUnit
): number {
  // If weight-based unit, convert to MT
  if (['KG', 'LB', 'G', 'OZ', 'MT', 'TON'].includes(packageUnit)) {
    const totalKg = convertToKg(numberOfPackages * packageSize, packageUnit as WeightUnit);
    return totalKg / 1000;
  }
  
  // If volume or count-based, return 0 (needs manual entry or density conversion)
  return 0;
}

/**
 * Get the appropriate quantity for a given pricing method
 */
export function getQuantityForPricing(
  line: {
    quantity_mt?: number;
    quantity_kg?: number;
    quantity_lb?: number;
    number_of_packages: number;
    number_of_containers?: number;
    number_of_pallets?: number;
    volume_cbm?: number;
    volume_liters?: number;
  },
  pricingMethod: PricingMethod
): number {
  switch (pricingMethod) {
    case 'per_mt':
      return line.quantity_mt || 0;
    case 'per_kg':
      return line.quantity_kg || (line.quantity_mt || 0) * 1000;
    case 'per_lb':
      return line.quantity_lb || (line.quantity_mt || 0) * 2204.62;
    case 'per_ton':
      return (line.quantity_mt || 0) * 1.10231; // MT to US Ton
    case 'per_package':
      return line.number_of_packages;
    case 'per_piece':
      return line.number_of_packages; // Assuming pieces = packages for now
    case 'per_pallet':
      return line.number_of_pallets || 0;
    case 'per_cbm':
      return line.volume_cbm || 0;
    case 'per_liter':
      return line.volume_liters || 0;
    case 'total':
      return 0; // Not applicable
    default:
      return 0;
  }
}

/**
 * Format unit display with symbol
 */
export function formatUnit(value: number, unit: string): string {
  const allUnits = [...WEIGHT_UNITS, ...VOLUME_UNITS, ...PACKAGE_SIZE_UNITS];
  const unitData = allUnits.find(u => u.value === unit);
  return `${value.toLocaleString('en-US')} ${unitData?.symbol || unit}`;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(code: CurrencyCode): string {
  const currency = CURRENCIES.find(c => c.value === code);
  return currency?.symbol || code;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, code: CurrencyCode): string {
  const symbol = getCurrencySymbol(code);
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

