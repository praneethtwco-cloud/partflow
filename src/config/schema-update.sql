-- =============================================================================
-- PartFlow Pro - Supabase Schema Update
-- Run this SQL in Supabase SQL Editor to add missing columns
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ORDERS TABLE - Add missing discount columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_discount_rate numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_discount_value numeric DEFAULT 0;

-- Verify orders table columns
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- ITEMS TABLE - Verify all columns exist
-- -----------------------------------------------------------------------------
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'items'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- CUSTOMERS TABLE - Verify all columns exist
-- -----------------------------------------------------------------------------
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- ORDER_LINES TABLE - Verify all columns exist
-- -----------------------------------------------------------------------------
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'order_lines'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- STOCK_ADJUSTMENTS TABLE - Verify all columns exist
-- -----------------------------------------------------------------------------
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'stock_adjustments'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- SETTINGS TABLE - Verify all columns exist
-- -----------------------------------------------------------------------------
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'settings'
ORDER BY ordinal_position;
