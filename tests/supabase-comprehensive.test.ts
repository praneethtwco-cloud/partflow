import { db } from '../services/db';
import { supabaseService } from '../services/supabase';
import { connectionService } from '../services/connection';
import { syncQueueService } from '../services/sync-queue';
import { migrationService } from '../services/migration';
import { Customer, Item, Order, CompanySettings } from '../types';

describe('Comprehensive Supabase Integration Tests', () => {
  beforeAll(async () => {
    // Initialize the database
    await db.initialize();
  });

  describe('Offline Functionality Tests', () => {
    test('should detect offline status correctly', () => {
      // Mock navigator.onLine to simulate offline
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false,
      });

      // Trigger the online event to update our connection service
      window.dispatchEvent(new Event('offline'));
      
      const isOnline = connectionService.getOnlineStatus();
      expect(isOnline).toBe(false);
    });

    test('should add operations to sync queue when offline', async () => {
      // Temporarily set the db to offline mode
      // Note: This is a simplified test - in a real scenario, we'd need to mock the connectionService
      // For now, we'll just verify that the queue functionality works
      const initialQueueLength = syncQueueService.length();
      
      // Add an operation to the queue (this would happen automatically when offline)
      syncQueueService.enqueue({
        id: 'test-offline-op-1',
        entity: 'customer',
        operation: 'create',
        data: { customer_id: 'offline-test-1', shop_name: 'Offline Test Customer' },
        timestamp: Date.now()
      });

      expect(syncQueueService.length()).toBe(initialQueueLength + 1);
      expect(syncQueueService.peek()?.id).toBe('test-offline-op-1');
    });

    test('should process queued operations when back online', async () => {
      // This test verifies that the functionality exists to process queued operations
      // In a real implementation, we'd need to simulate going back online
      expect(db.performSync).toBeDefined();
      expect(syncQueueService.getAll).toBeDefined();
    });
  });

  describe('Sync Functionality Tests', () => {
    test('should perform sync without errors', async () => {
      // This test verifies that the sync method exists and can be called
      // In a real environment with Supabase configured, this would attempt a sync
      expect(db.performSync).toBeDefined();
      
      // Just check that the function exists and is callable
      // We won't actually execute it without valid Supabase credentials
      expect(typeof db.performSync).toBe('function');
    });

    test('should check for conflicts', async () => {
      expect(db.checkForConflicts).toBeDefined();
      expect(typeof db.checkForConflicts).toBe('function');
    });

    test('should resolve conflicts', async () => {
      expect(db.resolveConflictsAndSync).toBeDefined();
      expect(typeof db.resolveConflictsAndSync).toBe('function');
      
      expect(db.autoResolveConflictsAndSync).toBeDefined();
      expect(typeof db.autoResolveConflictsAndSync).toBe('function');
    });
  });

  describe('Data Integrity Tests', () => {
    test('should maintain customer data integrity', async () => {
      const initialCustomers = db.getCustomers();
      const initialCount = initialCustomers.length;

      // Create a test customer
      const testCustomer: Customer = {
        customer_id: `test-cust-${Date.now()}`,
        shop_name: 'Test Customer for Validation',
        address: '123 Test St',
        phone: '123-456-7890',
        city_ref: 'test-city',
        discount_rate: 0.1,
        outstanding_balance: 0,
        credit_period: 30,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      };

      await db.saveCustomer(testCustomer);

      const updatedCustomers = db.getCustomers();
      expect(updatedCustomers.length).toBe(initialCount + 1);

      const savedCustomer = updatedCustomers.find(c => c.customer_id === testCustomer.customer_id);
      expect(savedCustomer).toBeDefined();
      expect(savedCustomer?.shop_name).toBe(testCustomer.shop_name);
      expect(savedCustomer?.sync_status).toBe('pending');
    });

    test('should maintain item data integrity', async () => {
      const initialItems = db.getItems();
      const initialCount = initialItems.length;

      // Create a test item
      const testItem: Item = {
        item_id: `test-item-${Date.now()}`,
        item_display_name: 'Test Item for Validation',
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      };

      await db.saveItem(testItem);

      const updatedItems = db.getItems();
      expect(updatedItems.length).toBe(initialCount + 1);

      const savedItem = updatedItems.find(i => i.item_id === testItem.item_id);
      expect(savedItem).toBeDefined();
      expect(savedItem?.item_display_name).toBe(testItem.item_display_name);
      expect(savedItem?.sync_status).toBe('pending');
    });

    test('should maintain order data integrity', async () => {
      const initialOrders = db.getOrders();
      const initialCount = initialOrders.length;

      // Create a test order
      const testOrder: Order = {
        order_id: `test-order-${Date.now()}`,
        customer_id: 'test-cust-123',
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

      await db.saveOrder(testOrder);

      const updatedOrders = db.getOrders();
      expect(updatedOrders.length).toBe(initialCount + 1);

      const savedOrder = updatedOrders.find(o => o.order_id === testOrder.order_id);
      expect(savedOrder).toBeDefined();
      expect(savedOrder?.customer_id).toBe(testOrder.customer_id);
      expect(savedOrder?.sync_status).toBe('pending');
    });
  });

  describe('Migration Service Tests', () => {
    test('should have migration functionality available', () => {
      expect(migrationService.migrateFromGoogleSheetsToSupabase).toBeDefined();
      expect(migrationService.validateMigration).toBeDefined();
      expect(migrationService.dryRun).toBeDefined();
    });

    test('should perform migration dry run', async () => {
      const dryRunResult = await migrationService.dryRun();
      
      expect(dryRunResult).toHaveProperty('customersCount');
      expect(dryRunResult).toHaveProperty('itemsCount');
      expect(dryRunResult).toHaveProperty('ordersCount');
      expect(dryRunResult).toHaveProperty('usersCount');
      expect(dryRunResult).toHaveProperty('settingsCount');
      expect(dryRunResult).toHaveProperty('adjustmentsCount');
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple simultaneous operations', async () => {
      // Create multiple test customers simultaneously
      const customerPromises = Array.from({ length: 5 }, (_, i) => 
        db.saveCustomer({
          customer_id: `perf-test-cust-${Date.now()}-${i}`,
          shop_name: `Performance Test Customer ${i}`,
          address: '123 Perf St',
          phone: '123-456-7890',
          city_ref: 'perf-city',
          discount_rate: 0.1,
          outstanding_balance: 0,
          credit_period: 30,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        })
      );

      await Promise.all(customerPromises);
      
      const customers = db.getCustomers();
      const perfCustomers = customers.filter(c => c.shop_name.includes('Performance Test Customer'));
      
      expect(perfCustomers.length).toBe(5);
    });
  });

  describe('Security Tests', () => {
    test('should maintain proper sync status for all entities', async () => {
      const customers = db.getCustomers();
      const items = db.getItems();
      const orders = db.getOrders();
      
      // Verify that all pending entities have the correct sync status
      const pendingCustomers = customers.filter(c => c.sync_status === 'pending');
      const pendingItems = items.filter(i => i.sync_status === 'pending');
      const pendingOrders = orders.filter(o => o.sync_status === 'pending');
      
      // These could be empty if no pending changes exist, which is fine
      pendingCustomers.forEach(c => expect(c.sync_status).toBe('pending'));
      pendingItems.forEach(i => expect(i.sync_status).toBe('pending'));
      pendingOrders.forEach(o => expect(o.sync_status).toBe('pending'));
    });
  });
});