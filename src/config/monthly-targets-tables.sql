-- Additional tables for Targets feature
-- Run this SQL in Supabase SQL Editor

-- Monthly Targets table
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

-- Enable RLS
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.monthly_targets;
CREATE POLICY "Allow all for authenticated users" ON public.monthly_targets
  FOR ALL USING (auth.role() = 'authenticated');
