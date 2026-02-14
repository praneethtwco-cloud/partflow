-- ============================================================================
-- CUSTOMERS TABLE (Run in Supabase SQL Editor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
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
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Anon policies
CREATE POLICY "Allow anon read customers" ON public.customers
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert customers" ON public.customers
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update customers" ON public.customers
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete customers" ON public.customers
  FOR DELETE TO anon USING (true);

-- Authenticated policies
CREATE POLICY "Allow auth read customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow auth insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow auth update customers" ON public.customers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth delete customers" ON public.customers
  FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON public.customers(shop_name);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON public.customers(sync_status);

SELECT 'Customers table created successfully!' as result;
