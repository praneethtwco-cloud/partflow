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
  discount_rate: number; // Primary discount 0.0 to 1.0
  secondary_discount_rate?: number; // Secondary discount 0.0 to 1.0
  outstanding_balance: number; // Track credit
  credit_period: number; // New: Credit period in days (e.g. 30, 60, 90)
  status: EntityStatus;
}

export interface Order extends BaseEntity {
  order_id: string;
  customer_id: string;
  rep_id?: string;
  order_date: string;
  discount_rate: number;
  gross_total: number;
  discount_value: number;
  secondary_discount_rate?: number;
  secondary_discount_value?: number;
  net_total: number;
  credit_period?: number; // Snapshot of credit terms at time of order
  
  // Payment Tracking
  paid_amount: number;
  balance_due: number;
  payment_status: PaymentStatus;
  payments: Payment[];

  delivery_status: DeliveryStatus;
  delivery_notes?: string;

  order_status: OrderStatus;
  lines: OrderLine[];
}

export interface Item extends BaseEntity {
  item_id: string;
  item_display_name: string; // "Brake Pad (Toyota Corolla)"
  item_name: string; // Internal/Generic name
  item_number: string; // SKU
  vehicle_model: string;
  source_brand: string; // e.g. "China", "Japan", "Denso"
  category: string; // e.g. "Engine", "Brakes", "Suspension"
  unit_value: number;
  current_stock_qty: number;
  low_stock_threshold: number;
  is_out_of_stock: boolean; // New Manual Flag
  status: EntityStatus; // 'active' or 'discontinued'
}

export interface OrderLine {
  line_id: string;
  order_id: string;
  item_id: string;
  item_name: string; // Snapshot
  quantity: number;
  unit_value: number; // Snapshot
  line_total: number;
}

export interface CompanySettings {
  company_name: string;
  address: string;
  phone: string;
  rep_name: string;
  invoice_prefix: string;
  footer_note: string;
  currency_symbol: string;
  auto_sku_enabled: boolean;
  stock_tracking_enabled: boolean;
  category_enabled: boolean; // New Setting
  google_sheet_id?: string;
  logo_base64?: string;
}

export interface StockAdjustment extends BaseEntity {
  adjustment_id: string;
  item_id: string;
  adjustment_type: 'restock' | 'damage' | 'correction' | 'return';
  quantity: number; // Always positive
  reason: string;
}

export interface SyncStats {
  pendingCustomers: number;
  pendingItems: number;
  pendingOrders: number;
  pendingAdjustments: number;
  last_sync?: string;
}
