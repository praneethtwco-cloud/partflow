# Supabase Row Level Security (RLS) Setup Guide

This guide explains how to set up Row Level Security policies in Supabase to allow application users to insert/update data.

## Issue Description
The application is encountering a 401 error when trying to insert data into Supabase tables:
```
new row violates row-level security policy for table "customers"
```

## Solution Steps

### 1. Enable RLS on Tables
For each table that needs to be accessed by application users, you need to enable RLS:

1. Go to your Supabase Dashboard
2. Navigate to the "Table Editor" section
3. Select the table (e.g., `customers`, `items`, `orders`, etc.)
4. Click on the "Permissions" tab
5. Enable "Row Level Security"

### 2. Create RLS Policies
For each table, create policies that define who can access the data:

#### For `customers` table:
```sql
-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy for all users to insert data
CREATE POLICY "Allow all users to insert" ON customers
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy for all users to update their own data
CREATE POLICY "Allow all users to update" ON customers
FOR UPDATE TO authenticated
USING (true);

-- Policy for all users to select data
CREATE POLICY "Allow all users to select" ON customers
FOR SELECT TO authenticated
USING (true);

-- Policy for all users to delete data
CREATE POLICY "Allow all users to delete" ON customers
FOR DELETE TO authenticated
USING (true);
```

#### For `items` table:
```sql
-- Enable RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy for all users to insert data
CREATE POLICY "Allow all users to insert" ON items
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy for all users to update their own data
CREATE POLICY "Allow all users to update" ON items
FOR UPDATE TO authenticated
USING (true);

-- Policy for all users to select data
CREATE POLICY "Allow all users to select" ON items
FOR SELECT TO authenticated
USING (true);

-- Policy for all users to delete data
CREATE POLICY "Allow all users to delete" ON items
FOR DELETE TO authenticated
USING (true);
```

#### For `orders` table:
```sql
-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy for all users to insert data
CREATE POLICY "Allow all users to insert" ON orders
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy for all users to update their own data
CREATE POLICY "Allow all users to update" ON orders
FOR UPDATE TO authenticated
USING (true);

-- Policy for all users to select data
CREATE POLICY "Allow all users to select" ON orders
FOR SELECT TO authenticated
USING (true);

-- Policy for all users to delete data
CREATE POLICY "Allow all users to delete" ON orders
FOR DELETE TO authenticated
USING (true);
```

#### For `settings` table:
```sql
-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy for all users to insert data
CREATE POLICY "Allow all users to insert" ON settings
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy for all users to update their own data
CREATE POLICY "Allow all users to update" ON settings
FOR UPDATE TO authenticated
USING (true);

-- Policy for all users to select data
CREATE POLICY "Allow all users to select" ON settings
FOR SELECT TO authenticated
USING (true);

-- Policy for all users to delete data
CREATE POLICY "Allow all users to delete" ON settings
FOR DELETE TO authenticated
USING (true);
```

#### For `stock_adjustments` table:
```sql
-- Enable RLS
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy for all users to insert data
CREATE POLICY "Allow all users to insert" ON stock_adjustments
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy for all users to update their own data
CREATE POLICY "Allow all users to update" ON stock_adjustments
FOR UPDATE TO authenticated
USING (true);

-- Policy for all users to select data
CREATE POLICY "Allow all users to select" ON stock_adjustments
FOR SELECT TO authenticated
USING (true);

-- Policy for all users to delete data
CREATE POLICY "Allow all users to delete" ON stock_adjustments
FOR DELETE TO authenticated
USING (true);
```

### 3. Run SQL in Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to the "SQL Editor" section
3. Copy and paste the above SQL commands
4. Execute them one by one

### 4. Alternative: Disable RLS for Development
If you're in development and want to temporarily disable RLS for testing:

```sql
-- Disable RLS on a specific table
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Or disable for all tables (not recommended for production)
-- You would need to run this for each table
```

### 5. Authentication Setup
Make sure your Supabase authentication is properly configured:

1. Go to the "Authentication" section in your Supabase Dashboard
2. Ensure email/password authentication is enabled
3. Check that your application is properly authenticating users before attempting to sync data

## Troubleshooting Tips

1. **Check if user is authenticated**: Make sure your application is logging in users before attempting to sync data
2. **Verify JWT token**: Ensure your Supabase client is properly configured with the anon key
3. **Check table names**: Make sure the table names in your RLS policies match exactly with your actual table names
4. **Review policies**: Ensure your policies are permissive enough for your application's needs

## Security Considerations

While these policies allow all authenticated users to access all data, in a production environment you might want to implement more restrictive policies based on user roles or ownership of data.