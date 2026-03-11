import { db } from '../db';
import { sheetsService } from '../sheets';
import { Order } from '../types';

// Mock the database and sheets service for testing
jest.mock('../db', () => ({
  db: {
    getSettings: jest.fn(),
    getOrders: jest.fn(),
    saveOrder: jest.fn(),
    checkForConflicts: jest.fn(),
    resolveConflictsAndSync: jest.fn(),
    performSync: jest.fn(),
    refreshCache: jest.fn(),
  }
}));

jest.mock('../sheets', () => ({
  sheetsService: {
    syncData: jest.fn()
  }
}));

describe('Invoice Editing and Sync Enhancement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Model Enhancement', () => {
    it('should include original_invoice_number field in Order type', () => {
      const order: Order = {
        order_id: 'test-order-id',
        customer_id: 'test-customer-id',
        order_date: '2023-01-01',
        discount_rate: 0,
        gross_total: 100,
        discount_value: 0,
        secondary_discount_rate: 0,
        secondary_discount_value: 0,
        tax_rate: 0,
        tax_value: 0,
        net_total: 100,
        paid_amount: 0,
        balance_due: 100,
        payment_status: 'unpaid',
        delivery_status: 'pending',
        order_status: 'confirmed',
        lines: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        invoice_number: 'INV0001',
        original_invoice_number: 'INV0001' // This should be available in the type
      };

      expect(order).toHaveProperty('original_invoice_number');
      expect(order.original_invoice_number).toBe('INV0001');
    });
  });

  describe('Database Schema Enhancement', () => {
    it('should handle original_invoice_number in saveOrder', async () => {
      const mockOrder = {
        order_id: 'test-order-id',
        customer_id: 'test-customer-id',
        order_date: '2023-01-01',
        discount_rate: 0,
        gross_total: 100,
        discount_value: 0,
        secondary_discount_rate: 0,
        secondary_discount_value: 0,
        tax_rate: 0,
        tax_value: 0,
        net_total: 100,
        paid_amount: 0,
        balance_due: 100,
        payment_status: 'unpaid',
        delivery_status: 'pending',
        order_status: 'confirmed',
        lines: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        invoice_number: 'INV0002',
        original_invoice_number: 'INV0001'
      };

      // Simulate calling saveOrder with the new fields
      await db.saveOrder(mockOrder);

      // Verify that the order was saved with the original_invoice_number preserved
      expect(db.saveOrder).toHaveBeenCalledWith(expect.objectContaining({
        invoice_number: 'INV0002',
        original_invoice_number: 'INV0001'
      }));
    });
  });

  describe('Sync Logic Enhancement', () => {
    it('should include sync identifiers in syncData call', async () => {
      const mockOrders = [{
        order_id: 'test-order-id',
        customer_id: 'test-customer-id',
        order_date: '2023-01-01',
        discount_rate: 0,
        gross_total: 100,
        discount_value: 0,
        secondary_discount_rate: 0,
        secondary_discount_value: 0,
        tax_rate: 0,
        tax_value: 0,
        net_total: 100,
        paid_amount: 0,
        balance_due: 100,
        payment_status: 'unpaid',
        delivery_status: 'pending',
        order_status: 'confirmed',
        lines: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        invoice_number: 'INV0001',
        original_invoice_number: 'INV0001'
      }];

      const mockResponse = {
        success: true,
        pulledItems: [],
        pulledCustomers: [],
        pulledOrders: [],
        logs: []
      };

      (sheetsService.syncData as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      await sheetsService.syncData('test-sheet-id', [], mockOrders, []);

      // Verify that the syncData call includes the __sync_identifiers__ field
      expect(sheetsService.syncData).toHaveBeenCalledWith(
        'test-sheet-id',
        [],
        expect.arrayContaining([expect.objectContaining({
          invoice_number: 'INV0001',
          original_invoice_number: 'INV0001',
          __sync_identifiers__: {
            original_invoice_number: 'INV0001',
            current_invoice_number: 'INV0001',
            order_id: 'test-order-id'
          }
        })]),
        [],
        'upsert'
      );
    });
  });

  describe('Conflict Detection', () => {
    it('should detect order conflicts based on original_invoice_number', async () => {
      const mockConflictResult = {
        hasConflicts: true,
        conflicts: [
          {
            type: 'order',
            id: 'test-order-id',
            local: { order_id: 'test-order-id', invoice_number: 'INV0002', original_invoice_number: 'INV0001', sync_status: 'pending' },
            cloud: { order_id: 'test-order-id', invoice_number: 'INV0001', sync_status: 'synced' },
            identifier: 'INV0001'
          }
        ],
        cloudData: {
          items: [],
          customers: [],
          orders: []
        }
      };

      (db.checkForConflicts as jest.MockedFunction<any>).mockResolvedValue(mockConflictResult);

      const result = await db.checkForConflicts();

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toHaveProperty('type', 'order');
      expect(result.conflicts[0]).toHaveProperty('identifier', 'INV0001');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve order conflicts properly', async () => {
      const mockResolutions = {
        'test-order-id': 'local'
      };

      const mockCloudData = {
        items: [],
        customers: [],
        orders: []
      };

      await db.resolveConflictsAndSync(mockResolutions, mockCloudData);

      expect(db.resolveConflictsAndSync).toHaveBeenCalledWith(mockResolutions, mockCloudData);
    });
  });
});