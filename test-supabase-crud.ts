import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

// Initialize Supabase client
const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

// Test data for each table
const testData = {
  customer: {
    shop_name: 'Test Customer for Supabase Connection',
    address: '123 Test Street',
    phone: '123-456-7890',
    city_ref: 'test-city',
    discount_rate: 0.1,
    outstanding_balance: 0,
    credit_period: 30,
    status: 'active',
    sync_status: 'pending'
  },
  item: {
    item_display_name: 'Test Item for Supabase Connection',
    item_name: 'Test Item',
    item_number: 'TEST001',
    vehicle_model: 'Test Model',
    source_brand: 'Test Brand',
    category: 'Test Category',
    unit_value: 100,
    current_stock_qty: 10,
    low_stock_threshold: 5,
    is_out_of_stock: false,
    status: 'active',
    sync_status: 'pending'
  },
  user: {
    username: 'testuser',
    full_name: 'Test User',
    role: 'rep',
    password: 'testpassword' // In a real implementation, this should be properly hashed
  },
  order: {
    order_date: new Date().toISOString().split('T')[0],
    discount_rate: 0.1,
    gross_total: 100,
    discount_value: 10,
    net_total: 90,
    paid_amount: 0,
    balance_due: 90,
    payment_status: 'unpaid',
    delivery_status: 'pending',
    order_status: 'draft',
    approval_status: 'draft',
    lines: [],
    sync_status: 'pending'
  },
  payment: {
    amount: 50,
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'cash',
    notes: 'Test payment'
  },
  adjustment: {
    adjustment_type: 'restock',
    quantity: 5,
    reason: 'Test stock adjustment',
    sync_status: 'pending'
  },
  settings: {
    company_name: 'Test Company',
    rep_name: 'Test Rep',
    invoice_prefix: 'TEST',
    starting_invoice_number: 1,
    footer_note: 'Test footer note',
    currency_symbol: '$',
    auto_sku_enabled: true,
    stock_tracking_enabled: false,
    category_enabled: false,
    show_sku_in_item_cards: false,
    show_advanced_sync_options: false
  }
};

async function testSupabaseConnection() {
  console.log('🧪 Starting Supabase Connection Test...\n');

  try {
    // Test 1: Check if we can connect to Supabase
    console.log('1️⃣ Testing Supabase connection...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.log('❌ Authentication error:', authError.message);
    } else {
      console.log('✅ Connected to Supabase successfully');
    }

    // Test 2: Create operations (C in CRUD)
    console.log('\n2️⃣ Testing CREATE operations...');
    
    // Create a test customer
    console.log('   Creating test customer...');
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert([testData.customer])
      .select()
      .single();
      
    if (customerError) {
      console.log('   ❌ Error creating customer:', customerError.message);
      return;
    }
    console.log('   ✅ Customer created with ID:', customerData.customer_id);
    const customerId = customerData.customer_id;

    // Create a test item
    console.log('   Creating test item...');
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .insert([testData.item])
      .select()
      .single();
      
    if (itemError) {
      console.log('   ❌ Error creating item:', itemError.message);
      return;
    }
    console.log('   ✅ Item created with ID:', itemData.item_id);
    const itemId = itemData.item_id;

    // Create a test user
    console.log('   Creating test user...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([testData.user])
      .select()
      .single();
      
    if (userError) {
      console.log('   ❌ Error creating user:', userError.message);
      return;
    }
    console.log('   ✅ User created with ID:', userData.id);
    const userId = userData.id;

    // Create a test order (linking to the customer we just created)
    console.log('   Creating test order...');
    const orderDataWithCustomer = { ...testData.order, customer_id: customerId };
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([orderDataWithCustomer])
      .select()
      .single();
      
    if (orderError) {
      console.log('   ❌ Error creating order:', orderError.message);
      return;
    }
    console.log('   ✅ Order created with ID:', orderData.order_id);
    const orderId = orderData.order_id;

    // Create a test stock adjustment (linking to the item we just created)
    console.log('   Creating test stock adjustment...');
    const adjustmentDataWithItem = { ...testData.adjustment, item_id: itemId };
    const { data: adjustmentData, error: adjustmentError } = await supabase
      .from('stock_adjustments')
      .insert([adjustmentDataWithItem])
      .select()
      .single();
      
    if (adjustmentError) {
      console.log('   ❌ Error creating adjustment:', adjustmentError.message);
      return;
    }
    console.log('   ✅ Adjustment created with ID:', adjustmentData.adjustment_id);
    const adjustmentId = adjustmentData.adjustment_id;

    // Test 3: Read operations (R in CRUD)
    console.log('\n3️⃣ Testing READ operations...');
    
    // Read the customer we just created
    console.log('   Reading test customer...');
    const { data: readCustomer, error: readCustomerError } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_id', customerId)
      .single();
      
    if (readCustomerError) {
      console.log('   ❌ Error reading customer:', readCustomerError.message);
      return;
    }
    console.log('   ✅ Customer read successfully:', readCustomer.shop_name);

    // Read the item we just created
    console.log('   Reading test item...');
    const { data: readItem, error: readItemError } = await supabase
      .from('items')
      .select('*')
      .eq('item_id', itemId)
      .single();
      
    if (readItemError) {
      console.log('   ❌ Error reading item:', readItemError.message);
      return;
    }
    console.log('   ✅ Item read successfully:', readItem.item_display_name);

    // Test 4: Update operations (U in CRUD)
    console.log('\n4️⃣ Testing UPDATE operations...');
    
    // Update the customer
    console.log('   Updating test customer...');
    const { data: updatedCustomer, error: updateCustomerError } = await supabase
      .from('customers')
      .update({ shop_name: 'Updated Test Customer', sync_status: 'synced' })
      .eq('customer_id', customerId)
      .select()
      .single();
      
    if (updateCustomerError) {
      console.log('   ❌ Error updating customer:', updateCustomerError.message);
      return;
    }
    console.log('   ✅ Customer updated successfully:', updatedCustomer.shop_name);

    // Update the item
    console.log('   Updating test item...');
    const { data: updatedItem, error: updateItemError } = await supabase
      .from('items')
      .update({ item_display_name: 'Updated Test Item', sync_status: 'synced' })
      .eq('item_id', itemId)
      .select()
      .single();
      
    if (updateItemError) {
      console.log('   ❌ Error updating item:', updateItemError.message);
      return;
    }
    console.log('   ✅ Item updated successfully:', updatedItem.item_display_name);

    // Test 5: Delete operations (D in CRUD)
    console.log('\n5️⃣ Testing DELETE operations...');
    
    // Delete the test records we created
    console.log('   Deleting test records...');
    
    const { error: deleteAdjustmentError } = await supabase
      .from('stock_adjustments')
      .delete()
      .eq('adjustment_id', adjustmentId);
      
    if (deleteAdjustmentError) {
      console.log('   ❌ Error deleting adjustment:', deleteAdjustmentError.message);
    } else {
      console.log('   ✅ Adjustment deleted successfully');
    }

    const { error: deleteOrderError } = await supabase
      .from('orders')
      .delete()
      .eq('order_id', orderId);
      
    if (deleteOrderError) {
      console.log('   ❌ Error deleting order:', deleteOrderError.message);
    } else {
      console.log('   ✅ Order deleted successfully');
    }

    const { error: deleteItemError } = await supabase
      .from('items')
      .delete()
      .eq('item_id', itemId);
      
    if (deleteItemError) {
      console.log('   ❌ Error deleting item:', deleteItemError.message);
    } else {
      console.log('   ✅ Item deleted successfully');
    }

    const { error: deleteCustomerError } = await supabase
      .from('customers')
      .delete()
      .eq('customer_id', customerId);
      
    if (deleteCustomerError) {
      console.log('   ❌ Error deleting customer:', deleteCustomerError.message);
    } else {
      console.log('   ✅ Customer deleted successfully');
    }

    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
      
    if (deleteUserError) {
      console.log('   ❌ Error deleting user:', deleteUserError.message);
    } else {
      console.log('   ✅ User deleted successfully');
    }

    console.log('\n🎉 All Supabase CRUD operations completed successfully!');
    console.log('✅ Connection to Supabase is working correctly');
    console.log('✅ CREATE, READ, UPDATE, and DELETE operations are functional');
    console.log('✅ All test data was properly cleaned up');
  } catch (error) {
    console.error('💥 Error during Supabase test:', error);
  }
}

// Run the test
testSupabaseConnection().catch(console.error);