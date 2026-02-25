-- Add missing columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_discount_rate numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS custom_discount_value numeric DEFAULT 0;

-- Verify the columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('custom_discount_rate', 'custom_discount_value');
