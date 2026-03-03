export type SyncStatus = 'synced' | 'pending' | 'conflict';
export type OrderStatus = 'draft' | 'confirmed' | 'invoiced';
export type EntityStatus = 'active' | 'inactive';

export interface BaseEntity {
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface User {
  id: string | number;
  username: string;
  full_name: string;
  role: 'admin' | 'rep';
  password?: string; // Optional for authenticated state, required for storage
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export type PaymentType = 'cash' | 'cheque' | 'bank_transfer' | 'credit';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type DeliveryStatus = 'pending' | 'shipped' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled';

export interface Payment {
  payment_id: string;
  order_id: string;
  amount: number;
  payment_date: string;
  payment_type: PaymentType;
  reference_number?: string; // Cheque number or Trans ID
  notes?: string;
}

export interface Customer extends BaseEntity {
  customer_id: string;
  shop_name: string;
  address: string;
  phone: string;
  city_ref: string;
  city?: string; // For CSV compatibility
  discount_rate: number; // Primary discount 0.0 to 1.0
  discount_1?: number; // For CSV compatibility - Primary discount
  discount_2?: number; // For CSV compatibility - Secondary discount
  secondary_discount_rate?: number; // Secondary discount 0.0 to 1.0
  outstanding_balance: number; // Track credit
  balance?: number; // For CSV compatibility
  credit_period: number; // New: Credit period in days (e.g. 30, 60, 90)
  credit_limit?: number; // Maximum credit allowed
  status: EntityStatus;
  last_updated?: string; // For CSV compatibility
}

export interface Order extends BaseEntity {
  order_id: string;
  customer_id: string;
  rep_id?: string;
  order_date: string;
  disc_1_rate?: number; // For CSV compatibility - Discount 1 Rate
  disc_1_value?: number; // For CSV compatibility - Discount 1 Value
  disc_2_rate?: number; // For CSV compatibility - Discount 2 Rate
  disc_2_value?: number; // For CSV compatibility - Discount 2 Value
  discount_rate: number;
  gross_total: number;
  discount_value: number;
  secondary_discount_rate?: number;
  secondary_discount_value?: number;
  custom_discount_rate?: number;
  custom_discount_value?: number;
  tax_rate?: number; // 0.0 to 1.0
  tax_value?: number;
  net_total: number;
  credit_period?: number; // Snapshot of credit terms at time of order

  // Payment Tracking
  paid_amount: number;
  paid?: number; // For CSV compatibility
  balance_due: number;
  payment_status: PaymentStatus;
  payments: Payment[];

  delivery_status: DeliveryStatus;
  delivery_date?: string; // Timestamp when delivery status was last changed
  delivery_notes?: string;

  order_status: OrderStatus;
  status?: string; // For CSV compatibility
  lines: OrderLine[];

  // Invoice Numbering
  invoice_number?: string;

  // Approval Status
  approval_status: 'draft' | 'pending_approval' | 'approved'; // New approval status field

  // Sync Tracking
  original_invoice_number?: string; // To track original invoice number for sync purposes
  
  // Additional fields for CSV compatibility
  last_updated?: string; // For CSV compatibility
}

export interface Item extends BaseEntity {
  item_id: string;
  item_display_name: string; // "Brake Pad (Toyota Corolla)"
  item_name: string; // Internal/Generic name
  internal_name?: string; // For CSV compatibility
  item_number: string; // SKU
  vehicle_model: string;
  source_brand: string; // e.g. "China", "Japan", "Denso"
  brand_origin?: string; // For CSV compatibility
  category: string; // e.g. "Engine", "Brakes", "Suspension"
  unit_value: number;
  current_stock_qty: number;
  low_stock_threshold: number;
  is_out_of_stock: boolean; // New Manual Flag
  stock_qty?: number; // For CSV compatibility
  low_stock_threshold_csv?: number; // For CSV compatibility
  status: EntityStatus; // 'active' or 'discontinued'
  last_updated?: string; // For CSV compatibility
}

export interface OrderLine {
  line_id: string;
  order_id: string;
  item_id: string;
  item_name: string; // Snapshot
  quantity: number;
  unit_value: number; // Snapshot
  unit_price?: number; // For CSV compatibility
  line_total: number;
}


export interface RoutePlanEntry {
  id: string;
  customer_id: string;
  visit_time: string;
  note?: string;
  route_date: string;
  created_at: string;
  sync_status?: 'pending' | 'synced';
  last_updated?: string;
}

export interface VisitEntry {
  id: string;
  customer_id: string;
  plan_id?: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_note?: string;
  check_out_note?: string;
  status: 'checked_in' | 'completed' | 'missed';
  route_date: string;
  created_at: string;
  sync_status?: 'pending' | 'synced';
  last_updated?: string;
}

export interface CompanySettings {
  id?: string;
  company_name: string;
  address: string;
  phone: string;
  rep_name: string;
  invoice_prefix: string;
  starting_invoice_number: number;
  footer_note: string;
  currency_symbol: string;
  tax_rate?: number; // Default tax rate (0.0 to 1.0)
  auto_sku_enabled: boolean;
  stock_tracking_enabled: boolean;
  category_enabled: boolean; // New Setting
  show_sku_in_item_cards?: boolean; // New Setting - default false
  logo_base64?: string;
  show_advanced_sync_options?: boolean; // New Setting for advanced sync options visibility
  gemini_api_key?: string; // For AI target suggestions
  gemini_model?: string; // Gemini model version (default: gemini-2.0-flash)
  route_plans?: RoutePlanEntry[];
  visits?: VisitEntry[];
  sync_status?: SyncStatus;
  last_updated?: string;
  updated_at?: string;
}

export interface MonthlyTarget {
  id: string;
  year: number;
  month: number;
  target_amount: number;
  achieved_amount: number;
  status: 'draft' | 'ai_suggested' | 'confirmed' | 'locked';
  is_ai_generated: boolean;
  ai_suggestion_reason?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  sync_status?: SyncStatus;
  last_updated?: string;
}

export interface StockAdjustment extends BaseEntity {
  adjustment_id: string;
  item_id: string;
  adjustment_type: 'restock' | 'damage' | 'correction' | 'return';
  quantity: number; // Always positive
  reason: string;
  last_updated?: string;
}

export interface SyncStats {
  pendingCustomers: number;
  pendingItems: number;
  pendingOrders: number;
  pendingAdjustments: number;
  last_sync?: string;
}
