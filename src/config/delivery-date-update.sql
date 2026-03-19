-- Add delivery_date column to orders table for tracking delivery status timestamps

-- If using Supabase/SQL
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP WITH TIME ZONE;

-- If using local SQLite (Dexie), the field is automatically added on next sync

-- For reference, the delivery_status enum values are:
-- 'pending', 'shipped', 'out_for_delivery', 'delivered', 'failed', 'cancelled'

-- Example queries to update delivery dates:
-- Update a specific order's delivery date
-- UPDATE orders SET delivery_date = '2025-03-03 14:30:00+00' WHERE order_id = 'order-123';

-- View orders with delivery dates
-- SELECT order_id, delivery_status, delivery_date, order_date FROM orders WHERE delivery_date IS NOT NULL ORDER BY delivery_date DESC;
