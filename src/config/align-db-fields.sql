-- Add missing fields to align with app database structure
-- Run this in Supabase SQL editor

-- 1. Add AI settings to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_model TEXT DEFAULT 'gemini-2.5-flash';

-- 2. Add last_updated to route_plans table
ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE;

-- 3. Add last_updated to visits table
ALTER TABLE visits ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE;

-- 4. Ensure delivery_date exists in orders (for delivery status timestamp tracking)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP WITH TIME ZONE;
