import { z } from 'zod';

// Delivery status enum
export const deliveryStatusEnum = z.enum(['pending', 'in_transit', 'delivered', 'cancelled']);

// Delivery leg enum (for border crossings)
export const deliveryLegEnum = z.enum(['pod_to_border', 'border_to_fd', 'pod_to_fd']);

// ========== DELIVERY SCHEMAS ==========

// Create delivery schema
export const createDeliverySchema = z.object({
  delivery_date: z.string().optional(), // Defaults to current date in DB
  origin: z.string().optional(),
  destination: z.string().min(1, 'Destination is required'),
  shipment_id: z.string().uuid().optional().nullable(),
  container_id: z.string().optional().nullable(),
  transport_company_id: z.string().uuid().optional().nullable(),
  transport_company_name: z.string().optional().nullable(), // Free text company name
  driver_name: z.string().optional().nullable(),
  driver_phone: z.string().optional().nullable(),
  truck_plate_number: z.string().optional().nullable(),
  vehicle_type: z.string().optional().nullable(),
  transport_cost: z.number().min(0).optional().nullable(),
  transport_currency: z.string().optional().default('USD'), // Currency for transport/insurance costs (USD, TRY, EUR)
  insurance_cost: z.number().min(0).optional().nullable(),
  insurance_company: z.string().optional().nullable(), // Insurance company name
  package_count: z.number().int().min(0).optional().nullable(),
  weight_kg: z.number().min(0).optional().nullable(),
  goods_description: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_reference: z.string().optional().nullable(),
  selling_price: z.number().min(0).optional().nullable(),
  currency: z.string().default('USD'),
  status: deliveryStatusEnum.optional().default('pending'),
  notes: z.string().optional().nullable(),
  // Border crossing fields
  border_crossing_id: z.string().uuid().optional().nullable(),
  border_eta: z.string().optional().nullable(), // Date string
  delivery_leg: deliveryLegEnum.optional().default('pod_to_fd'),
});

// Update delivery schema
export const updateDeliverySchema = z.object({
  delivery_date: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  shipment_id: z.string().uuid().optional().nullable(),
  container_id: z.string().optional().nullable(),
  transport_company_id: z.string().uuid().optional().nullable(),
  transport_company_name: z.string().optional().nullable(),
  driver_name: z.string().optional().nullable(),
  driver_phone: z.string().optional().nullable(),
  truck_plate_number: z.string().optional().nullable(),
  vehicle_type: z.string().optional().nullable(),
  transport_cost: z.number().min(0).optional().nullable(),
  transport_currency: z.string().optional(), // Currency for transport/insurance costs (USD, TRY, EUR)
  insurance_cost: z.number().min(0).optional().nullable(),
  insurance_company: z.string().optional().nullable(),
  package_count: z.number().int().min(0).optional().nullable(),
  weight_kg: z.number().min(0).optional().nullable(),
  goods_description: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_reference: z.string().optional().nullable(),
  selling_price: z.number().min(0).optional().nullable(),
  currency: z.string().optional(),
  status: deliveryStatusEnum.optional(),
  notes: z.string().optional().nullable(),
  // Border crossing fields
  border_crossing_id: z.string().uuid().optional().nullable(),
  border_eta: z.string().optional().nullable(),
  delivery_leg: deliveryLegEnum.optional(),
});

// Update status only schema
export const updateDeliveryStatusSchema = z.object({
  status: deliveryStatusEnum,
});

// Delivery filters schema
export const deliveryFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: deliveryStatusEnum.optional(),
  transport_company_id: z.string().uuid().optional(),
  destination: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  shipment_id: z.string().uuid().optional(),
  sort_by: z.enum(['delivery_date', 'delivery_number', 'destination', 'status', 'created_at']).default('delivery_date'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
});

// Ready for delivery filters
export const readyForDeliveryFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// ========== TRANSPORT COMPANY SCHEMAS ==========

// Create transport company schema
export const createTransportCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  contact_person: z.string().optional().nullable(),
  vehicle_types: z.array(z.string()).optional().default([]),
  service_areas: z.array(z.string()).optional().default([]),
  is_active: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
});

// Update transport company schema
export const updateTransportCompanySchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  contact_person: z.string().optional().nullable(),
  vehicle_types: z.array(z.string()).optional(),
  service_areas: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// Transport company filters
export const transportCompanyFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
});

// Type exports
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type DeliveryFilters = z.infer<typeof deliveryFiltersSchema>;
export type ReadyForDeliveryFilters = z.infer<typeof readyForDeliveryFiltersSchema>;
export type CreateTransportCompanyInput = z.infer<typeof createTransportCompanySchema>;
export type UpdateTransportCompanyInput = z.infer<typeof updateTransportCompanySchema>;
export type TransportCompanyFilters = z.infer<typeof transportCompanyFiltersSchema>;

