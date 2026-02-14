# Supabase Configuration Guide - Uploading All Local Data

This document explains how to properly configure and use the Supabase integration in the PartFlow Pro application, with emphasis on uploading all local data to Supabase.

## Prerequisites

1. A Supabase account and project
2. Access to the Supabase dashboard
3. Basic understanding of Supabase concepts (authentication, RLS, etc.)

## Step 1: Create Supabase Database Schema

Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
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
```

## Step 2: Configure Environment Variables

Add the following environment variables to your project:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend Configuration (existing)
VITE_BACKEND_URL=https://partflow-pro-akila.vercel.app
VITE_API_KEY=partflow_secret_token_2026_v2
```

## Step 3: Upload All Local Data to Supabase

The application now supports two sync modes:

### Upsert Mode (Default)
- Only uploads data with `sync_status: 'pending'`
- Preserves existing data in Supabase
- Recommended for regular sync operations

### Overwrite Mode
- Uploads ALL local data to Supabase, potentially overwriting existing records
- Use this mode to ensure all local data is uploaded to Supabase
- Accessible through the "Upload All to Cloud (Overwrite)" button in the Sync Dashboard

To trigger an overwrite sync programmatically:

```javascript
// This will upload ALL local data to Supabase
await db.performSync(null, 'overwrite');
```

## Step 4: Verify Data Upload

After performing a sync operation, you can verify that all data has been uploaded by:

1. Checking the Supabase dashboard
2. Looking at the activity logs in the Sync Dashboard
3. Verifying that sync_status is updated to 'synced' for all records

## Step 5: Enable Authentication (Optional)

If you want to use Supabase authentication:

1. Go to the Authentication section in your Supabase dashboard
2. Enable the sign-up providers you want to use (email, social, etc.)
3. Configure email templates if needed

## Troubleshooting

### Common Issues:

1. **Connection Errors**: Verify your Supabase URL and Anon Key are correct
2. **Permission Errors**: Check that your RLS policies are properly configured
3. **Sync Status Not Updating**: Make sure the sync_status field is properly managed in your application
4. **Incomplete Data Upload**: Ensure you're using the 'overwrite' mode when uploading all data

### Debugging Tips:

1. Check browser console for error messages
2. Verify that your Supabase project is not in "Disable anonymous access" mode if you're not using authentication
3. Check the Network tab in browser dev tools to see the actual API requests
4. Use the activity logs in the Sync Dashboard to track sync operations

## Security Considerations

1. **RLS Policies**: The provided schema includes basic RLS policies, but you may need to customize them based on your specific requirements
2. **Password Security**: The schema stores passwords in plain text. In a production environment, passwords should be properly hashed
3. **API Keys**: Keep your Supabase Anon Key secure and rotate it regularly

## Migration from Google Sheets

If you were previously using Google Sheets, you can use the migration service to transfer your data:

1. Ensure your existing data is properly loaded in the local database
2. Run the migration function: `await migrationService.migrateFromGoogleSheetsToSupabase()`
3. Verify the data has been transferred correctly

## Sync Status Management

The application now properly manages sync status for all entities:
- When data is modified locally, sync_status becomes 'pending'
- After successful sync, sync_status becomes 'synced'
- During conflicts, sync_status becomes 'conflict' (though this is rare with last-write-wins strategy)