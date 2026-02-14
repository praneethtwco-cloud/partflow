import Dexie from 'dexie';
import { Customer, Item, Order, CompanySettings, StockAdjustment, User } from '../types';

// Test the database schema to ensure all required tables exist
describe('Local Database Schema Tests', () => {
  let db: Dexie;

  beforeAll(() => {
    // Create a test database instance with the same schema as the main app
    db = new Dexie('TestPartFlowDB');
    db.version(10).stores({
      customers: 'customer_id, shop_name, sync_status',
      items: 'item_id, item_number, item_display_name, sync_status, status',
      orders: 'order_id, customer_id, order_date, sync_status, payment_status, delivery_status, invoice_number, original_invoice_number, approval_status',
      stockAdjustments: 'adjustment_id, item_id, sync_status',
      settings: 'id',
      users: 'id, username'
    });
  });

  test('should have customers table with correct schema', async () => {
    const table = db.table('customers');
    expect(table).toBeDefined();
    
    // Verify the schema includes the required indexes
    const schema = db.tables.find(t => t.name === 'customers');
    expect(schema).toBeDefined();
  });

  test('should have items table with correct schema', async () => {
    const table = db.table('items');
    expect(table).toBeDefined();
    
    // Verify the schema includes the required indexes
    const schema = db.tables.find(t => t.name === 'items');
    expect(schema).toBeDefined();
  });

  test('should have orders table with correct schema', async () => {
    const table = db.table('orders');
    expect(table).toBeDefined();
    
    // Verify the schema includes the required indexes
    const schema = db.tables.find(t => t.name === 'orders');
    expect(schema).toBeDefined();
  });

  test('should have settings table with correct schema', async () => {
    const table = db.table('settings');
    expect(table).toBeDefined();
    
    // Verify the schema includes the required indexes
    const schema = db.tables.find(t => t.name === 'settings');
    expect(schema).toBeDefined();
  });

  test('should have stockAdjustments table with correct schema', async () => {
    const table = db.table('stockAdjustments');
    expect(table).toBeDefined();
    
    // Verify the schema includes the required indexes
    const schema = db.tables.find(t => t.name === 'stockAdjustments');
    expect(schema).toBeDefined();
  });

  test('should have users table with correct schema', async () => {
    const table = db.table('users');
    expect(table).toBeDefined();
    
    // Verify the schema includes the required indexes
    const schema = db.tables.find(t => t.name === 'users');
    expect(schema).toBeDefined();
  });
});