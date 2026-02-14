-- ============================================================================
-- ITEMS TABLE (Run in Supabase SQL Editor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.items (
  item_id TEXT PRIMARY KEY,
  item_display_name TEXT NOT NULL,
  item_name TEXT,
  internal_name TEXT,
  item_number TEXT,
  vehicle_model TEXT,
  source_brand TEXT,
  brand_origin TEXT,
  category TEXT,
  unit_value NUMERIC(12,2) DEFAULT 0,
  current_stock_qty INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 0,
  is_out_of_stock BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  last_updated TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Anon policies
CREATE POLICY "Allow anon read items" ON public.items
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert items" ON public.items
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update items" ON public.items
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete items" ON public.items
  FOR DELETE TO anon USING (true);

-- Authenticated policies
CREATE POLICY "Allow auth read items" ON public.items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow auth insert items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow auth update items" ON public.items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth delete items" ON public.items
  FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_item_number ON public.items(item_number);
CREATE INDEX IF NOT EXISTS idx_items_item_display_name ON public.items(item_display_name);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_sync_status ON public.items(sync_status);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);

-- Trigger for updated_at
CREATE TRIGGER update_items_updated_at 
  BEFORE UPDATE ON items 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

SELECT 'Items table created successfully!' as result;
