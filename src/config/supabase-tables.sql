-- =====================================================
-- PARTFLOW PRO - ADDITIONAL TABLES FOR SUPABASE
-- Copy and run this entire file in Supabase SQL Editor
-- =====================================================

-- 1. CREATE ROUTE PLANS TABLE
CREATE TABLE IF NOT EXISTS public.route_plans (
  id text NOT NULL,
  customer_id text,
  visit_time text,
  note text,
  route_date text,
  created_at timestamp with time zone DEFAULT now(),
  sync_status text DEFAULT 'pending',
  last_updated timestamp with time zone,
  PRIMARY KEY (id)
);

-- 2. CREATE VISITS TABLE
CREATE TABLE IF NOT EXISTS public.visits (
  id text NOT NULL,
  customer_id text,
  plan_id text,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  check_in_note text,
  check_out_note text,
  status text DEFAULT 'checked_in',
  route_date text,
  created_at timestamp with time zone DEFAULT now(),
  sync_status text DEFAULT 'pending',
  last_updated timestamp with time zone,
  PRIMARY KEY (id)
);

-- 3. CREATE MONTHLY TARGETS TABLE
CREATE TABLE IF NOT EXISTS public.monthly_targets (
  id text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  target_amount numeric DEFAULT 0,
  achieved_amount numeric DEFAULT 0,
  status text DEFAULT 'draft',
  is_ai_generated boolean DEFAULT false,
  ai_suggestion_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  locked_at timestamp with time zone,
  sync_status text DEFAULT 'pending',
  last_updated timestamp with time zone,
  PRIMARY KEY (id),
  UNIQUE(year, month)
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Route Plans Policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.route_plans;
CREATE POLICY "Allow all for authenticated users" ON public.route_plans
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for anon users" ON public.route_plans;
CREATE POLICY "Allow all for anon users" ON public.route_plans
  FOR ALL USING (true);

-- Visits Policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.visits;
CREATE POLICY "Allow all for authenticated users" ON public.visits
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for anon users" ON public.visits;
CREATE POLICY "Allow all for anon users" ON public.visits
  FOR ALL USING (true);

-- Monthly Targets Policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.monthly_targets;
CREATE POLICY "Allow all for authenticated users" ON public.monthly_targets
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for anon users" ON public.monthly_targets;
CREATE POLICY "Allow all for anon users" ON public.monthly_targets
  FOR ALL USING (true);

-- =====================================================
-- CONFIRMATION
-- =====================================================

SELECT 
  'route_plans' as table_name, count(*) as exists
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'route_plans'
UNION ALL
SELECT 
  'visits', count(*)
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'visits'
UNION ALL
SELECT 
  'monthly_targets', count(*)
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'monthly_targets';
