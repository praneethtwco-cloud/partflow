import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { OrderBuilder } from '../components/OrderBuilder';
import { db } from '../services/db';
import { generateUUID } from '../utils/uuid';
import { Customer, Item, Order } from '../types';

// Mock the dependencies
jest.mock('../services/db', () => ({
  db: {
    getSettings: jest.fn(),
    getCustomers: jest.fn(),
    getItems: jest.fn(),
    saveOrder: jest.fn(),
    updateStock: jest.fn(),
    getOrders: jest.fn()
  }
}));

jest.mock('../utils/uuid', () => ({
  generateUUID: jest.fn(() => 'mock-uuid')
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', username: 'test-user' } })
}));

jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() })
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ themeClasses: { bg: 'bg-blue-500', text: 'text-blue-500' } })
}));

describe('OrderBuilder Invoice Number Functionality', () => {
  const mockCustomer: Customer = {
    customer_id: 'cust-1',
    shop_name: 'Test Shop',
    address: '123 Test St',
    phone: '123-456-7890',
    city_ref: 'Test City',
    discount_rate: 0,
    secondary_discount_rate: 0,
    outstanding_balance: 0,
    credit_period: 30,
    credit_limit: 1000,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'synced'
  };

  const mockItem: Item = {
    item_id: 'item-1',
    item_display_name: 'Test Item',
    item_name: 'Test',
    item_number: 'SKU-001',
    vehicle_model: 'Model A',
    source_brand: 'Brand X',
    category: 'Category A',
    unit_value: 100,
    current_stock_qty: 10,
    low_stock_threshold: 5,
    is_out_of_stock: false,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'synced'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock default settings
    (db.getSettings as jest.Mock).mockReturnValue({
      invoice_prefix: 'TEST',
      starting_invoice_number: 1,
      tax_rate: 0.1,
      auto_sku_enabled: true,
      stock_tracking_enabled: true,
      category_enabled: false,
      show_sku_in_item_cards: false,
      show_advanced_sync_options: false
    });

    (db.getCustomers as jest.Mock).mockReturnValue([mockCustomer]);
    (db.getItems as jest.Mock).mockReturnValue([mockItem]);
    (db.getOrders as jest.Mock).mockReturnValue([]);
  });

  it('should initialize with suggested invoice number', async () => {
    const mockOnOrderCreated = jest.fn();
    
    (db.getOrders as jest.Mock).mockReturnValue([]); // No existing orders
    
    const { getByPlaceholderText, getByDisplayValue } = render(
      <OrderBuilder 
        onCancel={jest.fn()} 
        onOrderCreated={mockOnOrderCreated} 
        existingCustomer={mockCustomer} 
      />
    );

    // Wait for the suggested invoice number to appear
    await waitFor(() => {
      expect(getByDisplayValue(/^TEST0001$/)).toBeInTheDocument();
    });
  });

  it('should allow manual override of invoice number', async () => {
    const mockOnOrderCreated = jest.fn();
    
    const { getByPlaceholderText, getByDisplayValue } = render(
      <OrderBuilder 
        onCancel={jest.fn()} 
        onOrderCreated={mockOnOrderCreated} 
        existingCustomer={mockCustomer} 
      />
    );

    // Initially should have suggested number
    await waitFor(() => {
      expect(getByDisplayValue(/^TEST0001$/)).toBeInTheDocument();
    });

    // Change to manual mode
    fireEvent.click(document.querySelector('button[title="Use suggested number"]')!);
    
    // Enter a custom invoice number
    const invoiceInput = getByPlaceholderText('Invoice #');
    fireEvent.change(invoiceInput, { target: { value: 'CUSTOM001' } });
    
    expect(invoiceInput).toHaveValue('CUSTOM001');
  });

  it('should validate invoice number format', async () => {
    const mockOnOrderCreated = jest.fn();
    
    const { getByPlaceholderText, getByText } = render(
      <OrderBuilder 
        onCancel={jest.fn()} 
        onOrderCreated={mockOnOrderCreated} 
        existingCustomer={mockCustomer} 
      />
    );

    // Change to manual mode
    fireEvent.click(document.querySelector('button[title="Use suggested number"]')!);
    
    // Enter an invalid invoice number
    const invoiceInput = getByPlaceholderText('Invoice #');
    fireEvent.change(invoiceInput, { target: { value: 'INVALID' } });
    
    // Should show validation error
    await waitFor(() => {
      expect(getByText(/Invalid format/)).toBeInTheDocument();
    });
  });

  it('should validate invoice number uniqueness', async () => {
    // Mock existing orders with an invoice number
    (db.getOrders as jest.Mock).mockReturnValue([
      {
        order_id: 'order-1',
        customer_id: 'cust-1',
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
        invoice_number: 'TEST0005',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'synced'
      }
    ]);

    const mockOnOrderCreated = jest.fn();
    
    const { getByPlaceholderText, getByText } = render(
      <OrderBuilder 
        onCancel={jest.fn()} 
        onOrderCreated={mockOnOrderCreated} 
        existingCustomer={mockCustomer} 
      />
    );

    // Change to manual mode
    fireEvent.click(document.querySelector('button[title="Use suggested number"]')!);
    
    // Enter a duplicate invoice number
    const invoiceInput = getByPlaceholderText('Invoice #');
    fireEvent.change(invoiceInput, { target: { value: 'TEST0005' } });
    
    // Should show uniqueness error
    await waitFor(() => {
      expect(getByText(/already exists/)).toBeInTheDocument();
    });
  });
});