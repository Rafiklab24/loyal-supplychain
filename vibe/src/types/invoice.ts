/**
 * Invoice Types
 * Types for generating purchase and sales invoices
 */

export type InvoiceType = 'purchase' | 'sales';
export type InvoiceLanguage = 'ar' | 'en' | 'bilingual';

export interface PartyInfo {
  name: string;
  name_ar?: string;
  address?: string;
  address_ar?: string;
  city?: string;
  country?: string;
  country_ar?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  registration_number?: string;
}

export interface BankDetails {
  bank_name: string;
  bank_name_ar?: string;
  account_name: string;
  account_number: string;
  iban?: string;
  swift_code?: string;
  branch?: string;
  currency: string;
}

export interface InvoiceItem {
  item_number: number;
  product_name: string;
  product_name_ar?: string;
  description?: string;
  description_ar?: string;
  origin?: string;
  origin_ar?: string;
  quantity: number;
  unit: string;
  unit_ar?: string;
  weight_kg?: number;
  unit_price: number;
  total_price: number;
  currency: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  type: InvoiceType;
  language: InvoiceLanguage;
  
  // Parties
  seller: PartyInfo;
  buyer: PartyInfo;
  
  // Items
  items: InvoiceItem[];
  
  // Totals
  subtotal: number;
  discount?: number;
  discount_percentage?: number;
  tax?: number;
  tax_percentage?: number;
  total_amount: number;
  currency: string;
  amount_in_words?: string;
  amount_in_words_ar?: string;
  
  // Shipping Details
  shipping?: {
    vessel_name?: string;
    voyage_number?: string;
    bl_number?: string;
    container_count?: number;
    port_of_loading?: string;
    port_of_loading_ar?: string;
    port_of_discharge?: string;
    port_of_discharge_ar?: string;
    eta?: string;
  };
  
  // Payment
  payment_terms?: string;
  payment_terms_ar?: string;
  bank_details?: BankDetails;
  
  // Reference
  shipment_id?: string;
  shipment_sn?: string;
  contract_id?: string;
  contract_number?: string;
  po_number?: string;
  
  // Notes
  notes?: string;
  notes_ar?: string;
  
  // Company Info (for header)
  company: {
    name: string;
    name_ar: string;
    logo_url?: string;
    address: string;
    address_ar: string;
    phone: string;
    email: string;
    website?: string;
    tax_id?: string;
  };
  
  // Metadata
  created_at?: string;
  created_by?: string;
}

export interface InvoiceGenerationOptions {
  shipment_id: string;
  type: InvoiceType;
  language: InvoiceLanguage;
  include_bank_details?: boolean;
  custom_notes?: string;
  custom_payment_terms?: string;
}

// Default company info for Loyal
export const LOYAL_COMPANY_INFO = {
  name: 'Loyal International Trading',
  name_ar: 'لويال للتجارة الدولية',
  address: 'Istanbul, Turkey',
  address_ar: 'اسطنبول، تركيا',
  phone: '+90 XXX XXX XXXX',
  email: 'info@loyal-trading.com',
  website: 'www.loyal-trading.com',
  tax_id: '',
};

// Default bank details
export const LOYAL_BANK_DETAILS: BankDetails = {
  bank_name: 'Bank Name',
  bank_name_ar: 'اسم البنك',
  account_name: 'Loyal International Trading',
  account_number: 'XXXX-XXXX-XXXX',
  iban: '',
  swift_code: '',
  currency: 'USD',
};

