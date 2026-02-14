import { 
  extractInvoiceNumber, 
  findHighestInvoiceNumber, 
  generateNextInvoiceNumber, 
  formatInvoiceNumber, 
  validateInvoiceNumberUniqueness,
  validateInvoiceNumberFormat 
} from '../invoiceNumber';

// Mock the db module for testing
jest.mock('../../services/db', () => ({
  db: {
    getOrders: () => [],
    getSettings: () => ({
      invoice_prefix: 'TEST',
      starting_invoice_number: 1
    })
  }
}));

// Since we're mocking, we need to import after the mock
const mockedDb = require('../../services/db');

describe('Invoice Number Utilities', () => {
  beforeEach(() => {
    // Reset mock between tests
    mockedDb.db.getOrders.mockReset();
    mockedDb.db.getSettings.mockReset();
    
    // Default mocks
    mockedDb.db.getOrders.mockReturnValue([]);
    mockedDb.db.getSettings.mockReturnValue({
      invoice_prefix: 'TEST',
      starting_invoice_number: 1
    });
  });

  describe('extractInvoiceNumber', () => {
    it('should extract numeric part from invoice number', () => {
      expect(extractInvoiceNumber('TEST0001')).toBe(1);
      expect(extractInvoiceNumber('TEST0012')).toBe(12);
      expect(extractInvoiceNumber('TEST123')).toBe(123);
      expect(extractInvoiceNumber('TEST9999')).toBe(9999);
    });

    it('should return 0 for invoice numbers without numeric part', () => {
      expect(extractInvoiceNumber('TEST')).toBe(0);
      expect(extractInvoiceNumber('')).toBe(0);
    });
  });

  describe('findHighestInvoiceNumber', () => {
    it('should return 0 when no orders exist', () => {
      mockedDb.db.getOrders.mockReturnValue([]);
      expect(findHighestInvoiceNumber()).toBe(0);
    });

    it('should return 0 when no orders have invoice numbers', () => {
      mockedDb.db.getOrders.mockReturnValue([
        { order_id: '1', invoice_number: undefined },
        { order_id: '2', invoice_number: null as any },
      ]);
      expect(findHighestInvoiceNumber()).toBe(0);
    });

    it('should return highest invoice number from existing orders', () => {
      mockedDb.db.getOrders.mockReturnValue([
        { order_id: '1', invoice_number: 'TEST0001' },
        { order_id: '2', invoice_number: 'TEST0005' },
        { order_id: '3', invoice_number: 'TEST0003' },
      ]);
      expect(findHighestInvoiceNumber()).toBe(5);
    });
  });

  describe('generateNextInvoiceNumber', () => {
    it('should generate next number based on highest existing', () => {
      mockedDb.db.getOrders.mockReturnValue([
        { order_id: '1', invoice_number: 'TEST0001' },
        { order_id: '2', invoice_number: 'TEST0005' },
      ]);
      mockedDb.db.getSettings.mockReturnValue({
        invoice_prefix: 'TEST',
        starting_invoice_number: 1
      });
      
      expect(generateNextInvoiceNumber()).toBe('TEST0006');
    });

    it('should use starting number when no existing invoices', () => {
      mockedDb.db.getOrders.mockReturnValue([]);
      mockedDb.db.getSettings.mockReturnValue({
        invoice_prefix: 'TEST',
        starting_invoice_number: 10
      });
      
      expect(generateNextInvoiceNumber()).toBe('TEST0010');
    });

    it('should use default starting number when not configured', () => {
      mockedDb.db.getOrders.mockReturnValue([]);
      mockedDb.db.getSettings.mockReturnValue({
        invoice_prefix: 'TEST',
        starting_invoice_number: undefined as any
      });
      
      expect(generateNextInvoiceNumber()).toBe('TEST0001');
    });
  });

  describe('formatInvoiceNumber', () => {
    it('should format invoice number with prefix and zero-padded number', () => {
      expect(formatInvoiceNumber('TEST', 1)).toBe('TEST0001');
      expect(formatInvoiceNumber('TEST', 12)).toBe('TEST0012');
      expect(formatInvoiceNumber('TEST', 123)).toBe('TEST0123');
      expect(formatInvoiceNumber('TEST', 1234)).toBe('TEST1234');
    });
  });

  describe('validateInvoiceNumberUniqueness', () => {
    it('should return true for unique invoice number', () => {
      mockedDb.db.getOrders.mockReturnValue([
        { order_id: '1', invoice_number: 'TEST0001' },
        { order_id: '2', invoice_number: 'TEST0002' },
      ]);
      
      expect(validateInvoiceNumberUniqueness('TEST0003')).toBe(true);
    });

    it('should return false for duplicate invoice number', () => {
      mockedDb.db.getOrders.mockReturnValue([
        { order_id: '1', invoice_number: 'TEST0001' },
        { order_id: '2', invoice_number: 'TEST0002' },
      ]);
      
      expect(validateInvoiceNumberUniqueness('TEST0002')).toBe(false);
    });

    it('should return true when duplicate is for same order being edited', () => {
      mockedDb.db.getOrders.mockReturnValue([
        { order_id: '1', invoice_number: 'TEST0001' },
        { order_id: '2', invoice_number: 'TEST0002' },
      ]);
      
      // Should be unique if we're excluding the order with this same ID
      expect(validateInvoiceNumberUniqueness('TEST0002', '2')).toBe(true);
    });

    it('should return false when duplicate is for different order', () => {
      mockedDb.db.getOrders.mockReturnValue([
        { order_id: '1', invoice_number: 'TEST0001' },
        { order_id: '2', invoice_number: 'TEST0002' },
      ]);
      
      // Should not be unique if we're excluding a different order ID
      expect(validateInvoiceNumberUniqueness('TEST0002', '3')).toBe(false);
    });
  });

  describe('validateInvoiceNumberFormat', () => {
    it('should return true for valid format', () => {
      expect(validateInvoiceNumberFormat('TEST0001', 'TEST')).toBe(true);
      expect(validateInvoiceNumberFormat('TEST123', 'TEST')).toBe(true);
      expect(validateInvoiceNumberFormat('TEST9999', 'TEST')).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(validateInvoiceNumberFormat('DIFF0001', 'TEST')).toBe(false);
      expect(validateInvoiceNumberFormat('TESTABCD', 'TEST')).toBe(false);
      expect(validateInvoiceNumberFormat('TEST', 'TEST')).toBe(false);
      expect(validateInvoiceNumberFormat('', 'TEST')).toBe(false);
    });
  });
});