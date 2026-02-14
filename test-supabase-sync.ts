// Test script to verify Supabase sync functionality
import { db } from './services/db';
import { supabaseService } from './services/supabase';

async function testSupabaseSync() {
  console.log('Initializing database...');
  await db.initialize();
  
  console.log('Database initialized. Getting current data...');
  
  // Get current data
  const customers = db.getCustomers();
  const items = db.getItems();
  const orders = db.getOrders();
  const settings = [db.getSettings()];
  const users = db.getCurrentUser() ? [db.getCurrentUser()] : [];
  const adjustments = db.getStockAdjustments();
  
  console.log(`Found ${customers.length} customers`);
  console.log(`Found ${items.length} items`);
  console.log(`Found ${orders.length} orders`);
  console.log(`Found ${adjustments.length} adjustments`);
  
  console.log('Attempting to sync with Supabase...');
  
  try {
    const result = await supabaseService.syncData(
      customers,
      orders,
      items,
      settings,
      users as any[],
      adjustments
    );
    
    if (result.success) {
      console.log('✅ Sync successful!');
      console.log(`Pulled ${result.pulledItems?.length || 0} items`);
      console.log(`Pulled ${result.pulledCustomers?.length || 0} customers`);
      console.log(`Pulled ${result.pulledOrders?.length || 0} orders`);
      console.log(`Pulled ${result.pulledAdjustments?.length || 0} adjustments`);
      console.log(`Pulled ${result.pulledUsers?.length || 0} users`);
      console.log(`Pulled settings: ${!!result.pulledSettings}`);
      
      // Update local data with pulled data
      if (result.pulledItems) {
        console.log('Updating local items...');
        for (const item of result.pulledItems) {
          await db.saveItem(item);
        }
      }
      
      if (result.pulledCustomers) {
        console.log('Updating local customers...');
        for (const customer of result.pulledCustomers) {
          await db.saveCustomer(customer);
        }
      }
      
      if (result.pulledOrders) {
        console.log('Updating local orders...');
        for (const order of result.pulledOrders) {
          await db.saveOrder(order);
        }
      }
      
      console.log('All data updated successfully!');
    } else {
      console.error('❌ Sync failed:', result.message);
    }
  } catch (error) {
    console.error('❌ Error during sync:', error);
  }
}

// Run the test
testSupabaseSync().catch(console.error);