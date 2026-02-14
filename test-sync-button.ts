// Test script to debug sync issues
// Run with: npx tsx test-sync-button.ts

const SUPABASE_URL = 'https://qoxkhmtkosiovrbdutag.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFveGtobXRrb3Npb3ZyYmR1dGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODkwMDgsImV4cCI6MjA4NjU2NTAwOH0.Pju7M920-pcVEJpA9KfOHYRvtHjMD1KYSelTjHjZqdo';

async function testSyncButton() {
  console.log('=== Testing Sync Button Flow ===\n');

  // Step 1: Check what's in local storage (simulating IndexedDB)
  console.log('1. Checking local pending data...');
  
  // Simulate pending customer
  const testCustomer = {
    customer_id: 'TEST_SYNC_' + Date.now(),
    shop_name: 'Test Shop Debug',
    address: '123 Test St',
    phone: '123456',
    city_ref: 'Test City',
    city: 'Test City',
    discount_rate: 0,
    outstanding_balance: 0,
    balance: 0,
    credit_period: 30,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
    last_updated: new Date().toISOString()
  };

  console.log('   Test customer:', testCustomer);

  // Step 2: Push to Supabase
  console.log('\n2. Attempting to push to Supabase...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(testCustomer)
    });

    const result = await response.text();
    
    if (response.ok) {
      console.log('   ✅ Push successful!');
      console.log('   Response:', result);
    } else {
      console.log('   ❌ Push failed!');
      console.log('   Status:', response.status);
      console.log('   Error:', result);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  // Step 3: Check what's in Supabase
  console.log('\n3. Checking Supabase data...');
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?customer_id=like.TEST_SYNC%25`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const data = await response.json();
    console.log('   Found', data.length, 'test customers');
    data.forEach((c: any) => {
      console.log(`   - ${c.shop_name} (${c.customer_id}) - sync_status: ${c.sync_status}`);
    });
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  // Step 4: Test pull
  console.log('\n4. Testing pull from Supabase...');
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?select=*&limit=5`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const data = await response.json();
    console.log('   Pulled', data.length, 'customers from Supabase');
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  // Step 5: Test items table
  console.log('\n5. Testing items table...');
  
  const testItem = {
    item_id: 'TEST_ITEM_' + Date.now(),
    item_display_name: 'Test Item Debug',
    item_name: 'Test Item',
    item_number: 'TEST-' + Date.now(),
    unit_value: 100,
    current_stock_qty: 50,
    low_stock_threshold: 10,
    is_out_of_stock: false,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
    last_updated: new Date().toISOString()
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(testItem)
    });

    if (response.ok) {
      console.log('   ✅ Item push successful!');
    } else {
      const result = await response.text();
      console.log('   ❌ Item push failed:', result);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.message);
  }

  console.log('\n=== Test Complete ===');
  console.log('\nSummary:');
  console.log('- If pushes work but app sync does not, the issue is in the app code');
  console.log('- Check: db.performSync() -> supabaseService.syncData()');
}

testSyncButton().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
