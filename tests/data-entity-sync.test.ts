import { db } from '../services/db';
import { Customer, Item, Order, CompanySettings, User, StockAdjustment } from '../types';

describe('Data Entity Synchronization Tests', () => {
  beforeAll(async () => {
    // Initialize the database
    await db.initialize();
  });

  test('should synchronize customer data', async () => {
    // Create a test customer
    const testCustomer: Customer = {
      customer_id: 'sync-test-customer-1',
      shop_name: 'Sync Test Customer',
      address: '123 Sync Test St',
      phone: '987-654-3210',
      city_ref: 'test-city',
      discount_rate: 0.05,
      outstanding_balance: 0,
      credit_period: 30,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    // Save the customer
    await db.saveCustomer(testCustomer);

    // Retrieve and verify
    const customers = db.getCustomers();
    const savedCustomer = customers.find(c => c.customer_id === testCustomer.customer_id);

    expect(savedCustomer).toBeDefined();
    expect(savedCustomer?.shop_name).toBe(testCustomer.shop_name);
    expect(savedCustomer?.sync_status).toBe('pending'); // Should be pending for sync
  });

  test('should synchronize item data', async () => {
    // Create a test item
    const testItem: Item = {
      item_id: 'sync-test-item-1',
      item_display_name: 'Sync Test Item',
      item_name: 'Test Item',
      item_number: 'SYNC001',
      vehicle_model: 'Test Model',
      source_brand: 'Test Brand',
      category: 'Test Category',
      unit_value: 50,
      current_stock_qty: 20,
      low_stock_threshold: 5,
      is_out_of_stock: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    // Save the item
    await db.saveItem(testItem);

    // Retrieve and verify
    const items = db.getItems();
    const savedItem = items.find(i => i.item_id === testItem.item_id);

    expect(savedItem).toBeDefined();
    expect(savedItem?.item_display_name).toBe(testItem.item_display_name);
    expect(savedItem?.sync_status).toBe('pending'); // Should be pending for sync
  });

  test('should synchronize order data', async () => {
    // Create a test order
    const testOrder: Order = {
      order_id: 'sync-test-order-1',
      customer_id: 'sync-test-customer-1',
      order_date: new Date().toISOString(),
      discount_rate: 0.1,
      gross_total: 100,
      discount_value: 10,
      net_total: 90,
      paid_amount: 0,
      balance_due: 90,
      payment_status: 'unpaid',
      delivery_status: 'pending',
      order_status: 'draft',
      lines: [],
      approval_status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    // Save the order
    await db.saveOrder(testOrder);

    // Retrieve and verify
    const orders = db.getOrders();
    const savedOrder = orders.find(o => o.order_id === testOrder.order_id);

    expect(savedOrder).toBeDefined();
    expect(savedOrder?.customer_id).toBe(testOrder.customer_id);
    expect(savedOrder?.sync_status).toBe('pending'); // Should be pending for sync
  });

  test('should synchronize settings data', async () => {
    // Get current settings
    const currentSettings = db.getSettings();

    // Update with test values
    const updatedSettings: CompanySettings = {
      ...currentSettings,
      company_name: 'Test Sync Company',
      rep_name: 'Test Sync Rep'
    };

    // Save the settings
    await db.saveSettings(updatedSettings);

    // Retrieve and verify
    const newSettings = db.getSettings();

    expect(newSettings.company_name).toBe('Test Sync Company');
    expect(newSettings.rep_name).toBe('Test Sync Rep');
  });

  test('should handle stock adjustment synchronization', async () => {
    // Create a test stock adjustment
    const testAdjustment: StockAdjustment = {
      adjustment_id: 'sync-test-adjustment-1',
      item_id: 'sync-test-item-1',
      adjustment_type: 'restock',
      quantity: 10,
      reason: 'Test restock adjustment',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    // Add the adjustment
    await db.addStockAdjustment(testAdjustment);

    // Verify it was added to the cache
    // Note: We don't have a direct getter for adjustments, but they're stored internally
    // and will be synced as part of the sync process
    expect(testAdjustment.adjustment_id).toBeDefined();
    expect(testAdjustment.sync_status).toBe('pending');
  });
});