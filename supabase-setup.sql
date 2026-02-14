-- PartFlow Pro - Supabase Database Setup
-- Run this SQL in your Supabase SQL Editor to create all tables, policies, and indexes

-- ============================================================================
-- ENUMS (Skip if already exists)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('synced', 'pending', 'conflict');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'invoiced');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('pending', 'shipped', 'out_for_delivery', 'delivered', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('cash', 'cheque', 'bank_transfer', 'credit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'rep');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE adjustment_type AS ENUM ('restock', 'damage', 'correction', 'return');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('draft', 'pending_approval', 'approved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  city_ref TEXT,
  city TEXT,
  discount_rate NUMERIC(5,2) DEFAULT 0,
  discount_1 NUMERIC(5,2),
  discount_2 NUMERIC(5,2),
  secondary_discount_rate NUMERIC(5,2) DEFAULT 0,
  outstanding_balance NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2),
  credit_period INTEGER DEFAULT 0,
  credit_limit NUMERIC(12,2),
  status entity_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status sync_status DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- ============================================================================
-- ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  item_display_name TEXT NOT NULL,
  item_name TEXT,
  internal_name TEXT,
  item_number TEXT UNIQUE,
  vehicle_model TEXT,
  source_brand TEXT,
  brand_origin TEXT,
  category TEXT,
  unit_value NUMERIC(12,2) DEFAULT 0,
  current_stock_qty INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 0,
  is_out_of_stock BOOLEAN DEFAULT FALSE,
  stock_qty INTEGER,
  low_stock_threshold_csv INTEGER,
  status entity_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status sync_status DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE CASCADE,
  rep_id TEXT,
  order_date DATE NOT NULL,
  disc_1_rate NUMERIC(5,2),
  disc_1_value NUMERIC(12,2),
  disc_2_rate NUMERIC(5,2),
  disc_2_value NUMERIC(12,2),
  discount_rate NUMERIC(5,2) DEFAULT 0,
  discount_value NUMERIC(12,2) DEFAULT 0,
  gross_total NUMERIC(12,2) DEFAULT 0,
  secondary_discount_rate NUMERIC(5,2) DEFAULT 0,
  secondary_discount_value NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_value NUMERIC(12,2) DEFAULT 0,
  net_total NUMERIC(12,2) DEFAULT 0,
  credit_period INTEGER DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  paid NUMERIC(12,2),
  balance_due NUMERIC(12,2) DEFAULT 0,
  payment_status payment_status DEFAULT 'unpaid',
  payments JSONB DEFAULT '[]',
  delivery_status delivery_status DEFAULT 'pending',
  delivery_notes TEXT,
  order_status order_status DEFAULT 'draft',
  status TEXT,
  invoice_number TEXT,
  approval_status approval_status DEFAULT 'draft',
  original_invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status sync_status DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- ============================================================================
-- ORDER LINES TABLE (Normalized)
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_lines (
  line_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(item_id) ON DELETE SET NULL,
  item_name TEXT,
  quantity INTEGER DEFAULT 0,
  unit_value NUMERIC(12,2) DEFAULT 0,
  unit_price NUMERIC(12,2),
  line_total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STOCK ADJUSTMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES items(item_id) ON DELETE CASCADE,
  adjustment_type adjustment_type NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status sync_status DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'rep',
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COMPANY SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  company_name TEXT,
  address TEXT,
  phone TEXT,
  rep_name TEXT,
  invoice_prefix TEXT DEFAULT 'INV',
  starting_invoice_number INTEGER DEFAULT 1,
  footer_note TEXT,
  currency_symbol TEXT DEFAULT '$',
  tax_rate NUMERIC(5,2) DEFAULT 0,
  auto_sku_enabled BOOLEAN DEFAULT TRUE,
  stock_tracking_enabled BOOLEAN DEFAULT FALSE,
  category_enabled BOOLEAN DEFAULT FALSE,
  show_sku_in_item_cards BOOLEAN DEFAULT FALSE,
  logo_base64 TEXT,
  show_advanced_sync_options BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status sync_status DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON customers(shop_name);
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Items indexes
CREATE INDEX IF NOT EXISTS idx_items_item_number ON items(item_number);
CREATE INDEX IF NOT EXISTS idx_items_item_display_name ON items(item_display_name);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_sync_status ON items(sync_status);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_low_stock ON items(current_stock_qty, low_stock_threshold);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Order Lines indexes
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_item_id ON order_lines(item_id);

-- Stock Adjustments indexes
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id ON stock_adjustments(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_sync_status ON stock_adjustments(sync_status);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CUSTOMERS POLICIES
-- ============================================================================

-- Allow all users (including anon) to read customers
CREATE POLICY "Allow read access to customers" ON customers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read customers" ON customers
  FOR SELECT
  TO anon
  USING (true);

-- Allow all users to insert customers
CREATE POLICY "Allow insert customers" ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert customers" ON customers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow all users to update customers
CREATE POLICY "Allow update customers" ON customers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon update customers" ON customers
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow all users to delete customers
CREATE POLICY "Allow delete customers" ON customers
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon delete customers" ON customers
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- ITEMS POLICIES
-- ============================================================================

CREATE POLICY "Allow read access to items" ON items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read items" ON items
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow insert items" ON items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert items" ON items
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow update items" ON items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon update items" ON items
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete items" ON items
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon delete items" ON items
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- ORDERS POLICIES
-- ============================================================================

CREATE POLICY "Allow read access to orders" ON orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read orders" ON orders
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow insert orders" ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert orders" ON orders
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow update orders" ON orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon update orders" ON orders
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete orders" ON orders
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon delete orders" ON orders
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- ORDER LINES POLICIES
-- ============================================================================

CREATE POLICY "Allow read access to order_lines" ON order_lines
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read order_lines" ON order_lines
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow insert order_lines" ON order_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert order_lines" ON order_lines
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow update order_lines" ON order_lines
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon update order_lines" ON order_lines
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete order_lines" ON order_lines
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon delete order_lines" ON order_lines
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- STOCK ADJUSTMENTS POLICIES
-- ============================================================================

CREATE POLICY "Allow read access to stock_adjustments" ON stock_adjustments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read stock_adjustments" ON stock_adjustments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow insert stock_adjustments" ON stock_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert stock_adjustments" ON stock_adjustments
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow update stock_adjustments" ON stock_adjustments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete stock_adjustments" ON stock_adjustments
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon delete stock_adjustments" ON stock_adjustments
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

CREATE POLICY "Allow read access to users" ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read users" ON users
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow insert users" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert users" ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow update users" ON users
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon update users" ON users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete users" ON users
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon delete users" ON users
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- SETTINGS POLICIES
-- ============================================================================

CREATE POLICY "Allow read access to settings" ON settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read settings" ON settings
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow insert settings" ON settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert settings" ON settings
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow update settings" ON settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon update settings" ON settings
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete settings" ON settings
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon delete settings" ON settings
  FOR DELETE
  TO anon
  USING (true);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_adjustments_updated_at BEFORE UPDATE ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT SETTINGS SEED DATA
-- ============================================================================

INSERT INTO settings (id, company_name, invoice_prefix, starting_invoice_number, currency_symbol, tax_rate, auto_sku_enabled, stock_tracking_enabled, category_enabled)
VALUES ('main', 'My Company', 'INV', 1, '$', 0, true, false, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DEFAULT ADMIN USER (Change password after first login!)
-- ============================================================================

INSERT INTO users (id, username, full_name, role, password)
VALUES ('usr_admin', 'admin', 'Administrator', 'admin', 'admin123')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- SUPABASE AUTHENTICATION SETUP
-- ============================================================================

-- Note: Authentication is handled by Supabase Auth. No custom setup needed.
-- Configure authentication providers in Supabase Dashboard > Authentication > Providers

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for customer orders summary
CREATE OR REPLACE VIEW customer_orders_summary AS
SELECT 
  c.customer_id,
  c.shop_name,
  c.city,
  c.outstanding_balance,
  COUNT(o.order_id) as total_orders,
  COALESCE(SUM(o.net_total), 0) as total_sales,
  COALESCE(SUM(o.paid_amount), 0) as total_paid
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.shop_name, c.city, c.outstanding_balance;

-- View for low stock items
CREATE OR REPLACE VIEW low_stock_items AS
SELECT 
  item_id,
  item_display_name,
  item_number,
  current_stock_qty,
  low_stock_threshold,
  category,
  status
FROM items
WHERE current_stock_qty <= low_stock_threshold
  AND status = 'active'
ORDER BY current_stock_qty ASC;

-- View for pending sync items
CREATE OR REPLACE VIEW pending_sync_summary AS
SELECT 
  'customers' as table_name,
  COUNT(*) as pending_count
FROM customers WHERE sync_status = 'pending'
UNION ALL
SELECT 
  'items' as table_name,
  COUNT(*) as pending_count
FROM items WHERE sync_status = 'pending'
UNION ALL
SELECT 
  'orders' as table_name,
  COUNT(*) as pending_count
FROM orders WHERE sync_status = 'pending'
UNION ALL
SELECT 
  'stock_adjustments' as table_name,
  COUNT(*) as pending_count
FROM stock_adjustments WHERE sync_status = 'pending';

-- ============================================================================
-- COMPLETED!
-- ============================================================================

-- Run this to verify setup:
-- SELECT 'Customers:' as table_name, COUNT(*) as count FROM customers
-- UNION ALL SELECT 'Items:', COUNT(*) FROM items
-- UNION ALL SELECT 'Orders:', COUNT(*) FROM orders
-- UNION ALL SELECT 'Order Lines:', COUNT(*) FROM order_lines
-- UNION ALL SELECT 'Stock Adjustments:', COUNT(*) FROM stock_adjustments
-- UNION ALL SELECT 'Users:', COUNT(*) FROM users
-- UNION ALL SELECT 'Settings:', COUNT(*) FROM settings;
