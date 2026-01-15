/**
 * Cargo Display Utility
 * 
 * Provides dynamic cargo type and count display based on the cargo type.
 * Supports containers, trucks, tankers (barrels), and general cargo (units).
 */

export interface CargoDisplayInfo {
  count: number;
  unit: string;
  unitAr: string;
  cargoType: string;
  cargoTypeAr: string;
  /** Formatted display string in English */
  displayEn: string;
  /** Formatted display string in Arabic */
  displayAr: string;
}

export interface ShipmentCargoData {
  cargo_type?: string;
  tanker_type?: string;
  container_count?: number | string;
  truck_count?: number | string;
  barrels?: number | string;
  unit_count?: number | string;
  package_count?: number | string;
  // Weight for general cargo display
  weight_ton?: number | string;
}

const toNumber = (value: number | string | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

/**
 * Get cargo display information based on cargo type
 */
export function getCargoDisplay(data: ShipmentCargoData): CargoDisplayInfo {
  const cargoType = data.cargo_type || 'general_cargo';
  
  switch (cargoType) {
    case 'containers': {
      const count = toNumber(data.container_count);
      return {
        count,
        unit: count === 1 ? 'Container' : 'Containers',
        unitAr: count === 1 ? 'حاوية' : 'حاويات',
        cargoType: 'Freight Containers',
        cargoTypeAr: 'حاويات شحن',
        displayEn: `${formatNumber(count)} Container${count !== 1 ? 's' : ''}`,
        displayAr: `${formatNumber(count)} ${count === 1 ? 'حاوية' : 'حاويات'}`,
      };
    }
    
    case 'trucks': {
      const count = toNumber(data.truck_count);
      return {
        count,
        unit: count === 1 ? 'Truck' : 'Trucks',
        unitAr: count === 1 ? 'شاحنة' : 'شاحنات',
        cargoType: 'Trucks',
        cargoTypeAr: 'شاحنات',
        displayEn: `${formatNumber(count)} Truck${count !== 1 ? 's' : ''}`,
        displayAr: `${formatNumber(count)} ${count === 1 ? 'شاحنة' : 'شاحنات'}`,
      };
    }
    
    case 'tankers': {
      const count = toNumber(data.barrels);
      const tankerType = data.tanker_type;
      let typeLabel = 'Tanker';
      let typeLabelAr = 'ناقلة';
      
      if (tankerType === 'crude_oil') {
        typeLabel = 'Crude Oil';
        typeLabelAr = 'نفط خام';
      } else if (tankerType === 'lpg') {
        typeLabel = 'LPG';
        typeLabelAr = 'غاز مسال';
      }
      
      return {
        count,
        unit: count === 1 ? 'Barrel' : 'Barrels',
        unitAr: count === 1 ? 'برميل' : 'براميل',
        cargoType: typeLabel,
        cargoTypeAr: typeLabelAr,
        displayEn: `${formatNumber(count)} Barrel${count !== 1 ? 's' : ''} - ${typeLabel}`,
        displayAr: `${formatNumber(count)} ${count === 1 ? 'برميل' : 'براميل'} - ${typeLabelAr}`,
      };
    }
    
    case 'general_cargo':
    default: {
      // For general cargo, use unit_count, package_count, or container_count (legacy field reuse)
      const count = toNumber(data.unit_count) || toNumber(data.package_count) || toNumber(data.container_count) || 0;
      return {
        count,
        unit: count === 1 ? 'Unit' : 'Units',
        unitAr: count === 1 ? 'وحدة' : 'وحدات',
        cargoType: 'General Cargo',
        cargoTypeAr: 'بضائع عامة',
        displayEn: count > 0 
          ? `${formatNumber(count)} Unit${count !== 1 ? 's' : ''} - General Cargo`
          : 'General Cargo',
        displayAr: count > 0
          ? `${formatNumber(count)} ${count === 1 ? 'وحدة' : 'وحدات'} - بضائع عامة`
          : 'بضائع عامة',
      };
    }
  }
}

/**
 * Get a short cargo summary (just count + unit)
 */
export function getCargoSummary(data: ShipmentCargoData, locale: 'en' | 'ar' = 'en'): string {
  const info = getCargoDisplay(data);
  return locale === 'ar' ? info.displayAr : info.displayEn;
}

/**
 * Get the cargo type label
 */
export function getCargoTypeLabel(cargoType: string | undefined, locale: 'en' | 'ar' = 'en'): string {
  const labels: Record<string, { en: string; ar: string }> = {
    'containers': { en: 'Freight Containers', ar: 'حاويات شحن' },
    'trucks': { en: 'Trucks', ar: 'شاحنات' },
    'tankers': { en: 'Tankers', ar: 'ناقلات' },
    'general_cargo': { en: 'General Cargo', ar: 'بضائع عامة' },
  };
  
  const label = labels[cargoType || 'general_cargo'] || labels['general_cargo'];
  return locale === 'ar' ? label.ar : label.en;
}

