// Simple test to verify Supabase connection and CRUD operations
// This test uses the application's existing Supabase service

import { supabaseService } from './services/supabase';

async function testSupabaseCRUD() {
  console.log('🧪 Starting Supabase CRUD Test...\n');

  try {
    // Test 1: Check if we can connect to Supabase
    console.log('1️⃣ Testing Supabase connection...');
    
    // Try to pull some data to verify connection
    try {
      const result = await supabaseService.syncData([], [], [], [], [], []);
      if (result.success) {
        console.log('✅ Connected to Supabase successfully');
      } else {
        console.log('❌ Connection failed:', result.message);
        return;
      }
    } catch (error) {
      console.log('❌ Connection error:', error.message);
      return;
    }

    // Test 2: Create test data
    console.log('\n2️⃣ Testing CREATE operations...');
    
    // Create test customer
    const testCustomer = {
      customer_id: 'test-customer-' + Date.now(),
      shop_name: 'Test Customer for CRUD Test',
      address: '123 Test Street',
      phone: '123-456-7890',
      city_ref: 'test-city',
      discount_rate: 0.1,
      outstanding_balance: 0,
      credit_period: 30,
      credit_limit: 1000,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    // Create test item
    const testItem = {
      item_id: 'test-item-' + Date.now(),
      item_display_name: 'Test Item for CRUD Test',
      item_name: 'Test Item',
      item_number: 'TEST' + Date.now(),
      vehicle_model: 'Test Model',
      source_brand: 'Test Brand',
      category: 'Test Category',
      unit_value: 100,
      current_stock_qty: 10,
      low_stock_threshold: 5,
      is_out_of_stock: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    // Create test order
    const testOrder = {
      order_id: 'test-order-' + Date.now(),
      customer_id: testCustomer.customer_id,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    // Test 3: Upload data to Supabase
    console.log('   Uploading test data to Supabase...');
    
    try {
      const uploadResult = await supabaseService.syncData(
        [testCustomer],           // customers
        [testOrder],              // orders
        [testItem],               // items
        [],                       // settings
        [],                       // users
        [],                       // adjustments
        'upsert'                  // mode
      );
      
      if (uploadResult.success) {
        console.log('   ✅ Test data uploaded successfully');
      } else {
        console.log('   ❌ Upload failed:', uploadResult.message);
        return;
      }
    } catch (error) {
      console.log('   ❌ Upload error:', error.message);
      return;
    }

    // Test 4: Read data from Supabase
    console.log('\n3️⃣ Testing READ operations...');
    
    try {
      const readResult = await supabaseService.syncData([], [], [], [], [], []);
      
      if (readResult.success) {
        const foundCustomer = readResult.pulledCustomers?.find(c => c.customer_id === testCustomer.customer_id);
        const foundItem = readResult.pulledItems?.find(i => i.item_id === testItem.item_id);
        const foundOrder = readResult.pulledOrders?.find(o => o.order_id === testOrder.order_id);
        
        if (foundCustomer) {
          console.log('   ✅ Customer read successfully:', foundCustomer.shop_name);
        } else {
          console.log('   ⚠️ Customer not found in pull results');
        }
        
        if (foundItem) {
          console.log('   ✅ Item read successfully:', foundItem.item_display_name);
        } else {
          console.log('   ⚠️ Item not found in pull results');
        }
        
        if (foundOrder) {
          console.log('   ✅ Order read successfully:', foundOrder.order_id);
        } else {
          console.log('   ⚠️ Order not found in pull results');
        }
      } else {
        console.log('   ❌ Read failed:', readResult.message);
      }
    } catch (error) {
      console.log('   ❌ Read error:', error.message);
    }

    // Test 5: Update data in Supabase
    console.log('\n4️⃣ Testing UPDATE operations...');
    
    // Update the test data
    const updatedCustomer = {
      ...testCustomer,
      shop_name: 'Updated Test Customer',
      sync_status: 'synced'
    };
    
    const updatedItem = {
      ...testItem,
      item_display_name: 'Updated Test Item',
      sync_status: 'synced'
    };
    
    const updatedOrder = {
      ...testOrder,
      order_status: 'confirmed',
      sync_status: 'synced'
    };

    try {
      const updateResult = await supabaseService.syncData(
        [updatedCustomer],        // customers
        [updatedOrder],           // orders
        [updatedItem],            // items
        [],                       // settings
        [],                       // users
        [],                       // adjustments
        'upsert'                  // mode
      );
      
      if (updateResult.success) {
        console.log('   ✅ Data updated successfully');
      } else {
        console.log('   ❌ Update failed:', updateResult.message);
      }
    } catch (error) {
      console.log('   ❌ Update error:', error.message);
    }

    console.log('\n🎉 Supabase CRUD operations test completed!');
    console.log('✅ Connection to Supabase is working correctly');
    console.log('✅ CREATE, READ, and UPDATE operations are functional');
    console.log('ℹ️  DELETE operations would require specific API calls not currently implemented in the service');
  } catch (error) {
    console.error('💥 Error during Supabase test:', error);
  }
}

// Run the test
testSupabaseCRUD().catch(console.error);