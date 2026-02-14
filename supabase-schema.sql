-- Create tables for PartFlow Pro application

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    customer_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    city_ref TEXT,
    discount_rate DECIMAL(3,2) DEFAULT 0.00,
    secondary_discount_rate DECIMAL(3,2) DEFAULT 0.00,
    outstanding_balance DECIMAL(10,2) DEFAULT 0.00,
    credit_period INTEGER DEFAULT 0,
    credit_limit DECIMAL(10,2),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_display_name TEXT NOT NULL,
    item_name TEXT,
    item_number TEXT UNIQUE,
    vehicle_model TEXT,
    source_brand TEXT,
    category TEXT,
    unit_value DECIMAL(10,2) DEFAULT 0.00,
    current_stock_qty INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 0,
    is_out_of_stock BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'rep' CHECK (role IN ('admin', 'rep')),
    password TEXT, -- In production, passwords should be properly hashed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(customer_id),
    rep_id UUID REFERENCES users(id),
    order_date DATE NOT NULL,
    discount_rate DECIMAL(3,2) DEFAULT 0.00,
    secondary_discount_rate DECIMAL(3,2) DEFAULT 0.00,
    gross_total DECIMAL(10,2) DEFAULT 0.00,
    discount_value DECIMAL(10,2) DEFAULT 0.00,
    secondary_discount_value DECIMAL(10,2) DEFAULT 0.00,
    tax_rate DECIMAL(3,2) DEFAULT 0.00,
    tax_value DECIMAL(10,2) DEFAULT 0.00,
    net_total DECIMAL(10,2) DEFAULT 0.00,
    credit_period INTEGER, -- Snapshot of credit terms at time of order
    paid_amount DECIMAL(10,2) DEFAULT 0.00,
    balance_due DECIMAL(10,2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'shipped', 'out_for_delivery', 'delivered', 'failed', 'cancelled')),
    delivery_notes TEXT,
    order_status TEXT DEFAULT 'draft' CHECK (order_status IN ('draft', 'confirmed', 'invoiced')),
    approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved')),
    lines JSONB, -- Store order lines as JSON
    invoice_number TEXT, -- For sequential invoice numbering
    original_invoice_number TEXT, -- To track original invoice number for sync purposes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(order_id),
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_type TEXT CHECK (payment_type IN ('cash', 'cheque', 'bank_transfer', 'credit')),
    reference_number TEXT, -- Cheque number or Trans ID
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Adjustments table
CREATE TABLE IF NOT EXISTS stock_adjustments (
    adjustment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES items(item_id),
    adjustment_type TEXT CHECK (adjustment_type IN ('restock', 'damage', 'correction', 'return')),
    quantity INTEGER NOT NULL, -- Always positive, direction determined by adjustment_type
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict'))
);

-- Settings table (singleton)
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    company_name TEXT,
    address TEXT,
    phone TEXT,
    rep_name TEXT,
    invoice_prefix TEXT DEFAULT 'INV',
    starting_invoice_number INTEGER DEFAULT 1,
    footer_note TEXT,
    currency_symbol TEXT DEFAULT 'Rs.',
    tax_rate DECIMAL(3,2), -- Default tax rate (0.0 to 1.0)
    auto_sku_enabled BOOLEAN DEFAULT TRUE,
    stock_tracking_enabled BOOLEAN DEFAULT FALSE,
    category_enabled BOOLEAN DEFAULT FALSE,
    show_sku_in_item_cards BOOLEAN DEFAULT FALSE,
    logo_base64 TEXT,
    show_advanced_sync_options BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO settings (company_name, rep_name, invoice_prefix, starting_invoice_number, footer_note, currency_symbol)
SELECT 'Default Company', 'Default Rep', 'INV', 1, 'Thank you for your business. Goods once sold cannot be returned.', 'Rs.'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 'main');

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- For anonymous/public access (if needed)
-- CREATE POLICY "Allow public read access" ON customers FOR SELECT USING (true);
-- CREATE POLICY "Allow public read access" ON items FOR SELECT USING (true);

-- For authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON customers
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON items
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON users
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON orders
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON payments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON stock_adjustments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON settings
    FOR ALL USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON customers(shop_name);
CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status);
CREATE INDEX IF NOT EXISTS idx_items_item_number ON items(item_number);
CREATE INDEX IF NOT EXISTS idx_items_sync_status ON items(sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id ON stock_adjustments(item_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at 
    BEFORE UPDATE ON items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
    BEFORE UPDATE ON payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_adjustments_updated_at 
    BEFORE UPDATE ON stock_adjustments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();