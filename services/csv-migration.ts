import Dexie from 'dexie';
import { db } from './db';

/**
 * Migration script to update database schema for CSV import compatibility
 * This script adds missing columns to ensure compatibility with the required CSV formats
 */

export async function updateSchemaForCsvCompatibility(): Promise<void> {
  console.log('Starting schema update for CSV compatibility...');
  
  // Update the database version to add new fields
  // We'll create a temporary database instance with the new schema
  const tempDb = new Dexie('PartFlowDB_Migration');
  
  // Close the existing database connection temporarily
  await db.db.close();
  
  // Define the new schema with all required fields
  tempDb.version(11).stores({
    customers: 'customer_id, shop_name, sync_status, city, discount_1, discount_2, balance, last_updated',
    items: 'item_id, item_number, item_display_name, sync_status, status, internal_name, last_updated',
    orders: 'order_id, customer_id, order_date, sync_status, payment_status, delivery_status, invoice_number, original_invoice_number, approval_status, disc_1_rate, disc_1_value, disc_2_rate, disc_2_value, paid, status, last_updated',
    stockAdjustments: 'adjustment_id, item_id, sync_status',
    settings: 'id',
    users: 'id, username'
  });
  
  // Open the database with the new schema
  await tempDb.open();
  
  // Update existing customer records to include new fields
  await tempDb.table('customers').toCollection().modify((customer: any) => {
    customer.city = customer.city || customer.city_ref;
    customer.discount_1 = customer.discount_rate || 0;
    customer.discount_2 = customer.secondary_discount_rate || 0;
    customer.balance = customer.outstanding_balance || 0;
    customer.last_updated = customer.updated_at;
  });
  
  // Update existing item records to include new fields
  await tempDb.table('items').toCollection().modify((item: any) => {
    item.internal_name = item.item_name || '';
    item.last_updated = item.updated_at;
  });
  
  // Update existing order records to include new fields
  await tempDb.table('orders').toCollection().modify((order: any) => {
    order.disc_1_rate = order.discount_rate || 0;
    order.disc_1_value = order.discount_value || 0;
    order.disc_2_rate = order.secondary_discount_rate || 0;
    order.disc_2_value = order.secondary_discount_value || 0;
    order.paid = order.paid_amount || 0;
    order.status = order.order_status || 'draft';
    order.last_updated = order.updated_at;
  });
  
  // Close the temporary database
  await tempDb.close();
  
  // Reopen the original database to refresh the schema
  await db.initialize();
  
  console.log('Schema update for CSV compatibility completed.');
}

/**
 * Function to transform customer data from CSV format to database format
 */
export function transformCustomerFromCsv(csvData: any): any {
  return {
    customer_id: csvData.ID || csvData.customer_id,
    shop_name: csvData['Shop Name'] || csvData.shop_name,
    address: csvData.Address || csvData.address,
    phone: csvData.Phone || csvData.phone,
    city: csvData.City || csvData.city,
    discount_1: parseFloat(csvData['Discount 1']) || 0,
    discount_2: parseFloat(csvData['Discount 2']) || 0,
    balance: parseFloat(csvData.Balance) || 0,
    credit_period: parseInt(csvData['Credit Period']) || 0,
    status: csvData.Status || 'active',
    last_updated: csvData['Last Updated'] || new Date().toISOString(),
    
    // Standard fields
    created_at: csvData.created_at || new Date().toISOString(),
    updated_at: csvData.updated_at || new Date().toISOString(),
    sync_status: 'pending' as const
  };
}

/**
 * Function to transform item data from CSV format to database format
 */
export function transformItemFromCsv(csvData: any): any {
  return {
    item_id: csvData.ID || csvData.item_id,
    item_display_name: csvData['Display Name'] || csvData.item_display_name,
    internal_name: csvData['Internal Name'] || csvData.item_name || '',
    item_number: csvData.SKU || csvData.item_number,
    vehicle_model: csvData.Vehicle || csvData.vehicle_model,
    source_brand: csvData['Brand/Origin'] || csvData.source_brand,
    category: csvData.Category || csvData.category,
    unit_value: parseFloat(csvData['Unit Value']) || 0,
    current_stock_qty: parseInt(csvData['Stock Qty']) || 0,
    low_stock_threshold: parseInt(csvData['Low Stock Threshold']) || 0,
    is_out_of_stock: csvData['Out of Stock'] === 'true' || csvData.is_out_of_stock || false,
    status: csvData.Status || 'active',
    last_updated: csvData['Last Updated'] || new Date().toISOString(),
    
    // Standard fields
    created_at: csvData.created_at || new Date().toISOString(),
    updated_at: csvData.updated_at || new Date().toISOString(),
    sync_status: 'pending' as const
  };
}

/**
 * Function to transform order data from CSV format to database format
 */
export function transformOrderFromCsv(csvData: any): any {
  return {
    order_id: csvData['Order ID'] || csvData.order_id,
    customer_id: csvData['Customer ID'] || csvData.customer_id,
    rep_id: csvData['Rep ID'] || csvData.rep_id,
    order_date: csvData.Date || csvData.order_date,
    disc_1_rate: parseFloat(csvData['Disc 1 Rate']) || 0,
    disc_1_value: parseFloat(csvData['Disc 1 Value']) || 0,
    disc_2_rate: parseFloat(csvData['Disc 2 Rate']) || 0,
    disc_2_value: parseFloat(csvData['Disc 2 Value']) || 0,
    gross_total: parseFloat(csvData['Gross Total']) || 0,
    net_total: parseFloat(csvData['Net Total']) || 0,
    paid: parseFloat(csvData.Paid) || 0,
    balance_due: parseFloat(csvData['Balance Due']) || 0,
    payment_status: csvData['Payment Status'] || csvData.payment_status || 'unpaid',
    delivery_status: csvData['Delivery Status'] || csvData.delivery_status || 'pending',
    credit_period: parseInt(csvData['Credit Period']) || 0,
    status: csvData.Status || csvData.order_status || 'draft',
    last_updated: csvData['Last Updated'] || new Date().toISOString(),
    
    // Standard fields
    approval_status: csvData.approval_status || 'approved',
    invoice_number: csvData.invoice_number,
    original_invoice_number: csvData.original_invoice_number,
    order_status: csvData.order_status || 'draft',
    lines: csvData.lines || [],
    payments: csvData.payments || [],
    delivery_notes: csvData.delivery_notes,
    created_at: csvData.created_at || new Date().toISOString(),
    updated_at: csvData.updated_at || new Date().toISOString(),
    sync_status: 'pending' as const
  };
}

/**
 * Function to transform order line data from CSV format to database format
 */
export function transformOrderLineFromCsv(csvData: any): any {
  return {
    line_id: csvData['Line ID'] || csvData.line_id,
    order_id: csvData['Order ID'] || csvData.order_id,
    item_id: csvData['Item ID'] || csvData.item_id,
    item_name: csvData['Item Name'] || csvData.item_name,
    quantity: parseInt(csvData.Qty) || 0,
    unit_value: parseFloat(csvData['Unit Price']) || parseFloat(csvData.unit_value) || 0,
    line_total: parseFloat(csvData['Line Total']) || 0,
  };
}