-- ============================================================================
-- ORDERS TABLE (Run in Supabase SQL Editor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT,
  rep_id TEXT,
  order_date DATE NOT NULL,
  disc_1_rate NUMERIC(5,2) DEFAULT 0,
  disc_1_value NUMERIC(12,2) DEFAULT 0,
  disc_2_rate NUMERIC(5,2) DEFAULT 0,
  disc_2_value NUMERIC(12,2) DEFAULT 0,
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
  payment_status TEXT DEFAULT 'unpaid',
  payments JSONB DEFAULT '[]',
  delivery_status TEXT DEFAULT 'pending',
  delivery_notes TEXT,
  order_status TEXT DEFAULT 'draft',
  status TEXT,
  invoice_number TEXT,
  approval_status TEXT DEFAULT 'draft',
  original_invoice_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anon policies
CREATE POLICY "Allow anon read orders" ON public.orders FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert orders" ON public.orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update orders" ON public.orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete orders" ON public.orders FOR DELETE TO anon USING (true);

-- Authenticated policies
CREATE POLICY "Allow auth read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update orders" ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth delete orders" ON public.orders FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON public.orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON public.orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON public.orders(approval_status);

-- Trigger
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Orders table created successfully!' as result;
