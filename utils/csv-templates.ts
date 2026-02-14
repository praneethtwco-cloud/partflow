/**
 * CSV Template Generator for Akila Node
 * This module provides utilities to generate CSV templates for different data types
 */

export interface CsvTemplate {
  name: string;
  description: string;
  headers: string[];
  exampleRow: any[];
}

export const CSV_TEMPLATES: Record<string, CsvTemplate> = {
  customers: {
    name: 'Customers',
    description: 'Template for importing customer data',
    headers: [
      'customer_id',
      'shop_name',
      'address',
      'phone',
      'city_ref',
      'city',
      'discount_rate',
      'discount_1',
      'discount_2',
      'secondary_discount_rate',
      'outstanding_balance',
      'balance',
      'credit_period',
      'credit_limit',
      'status',
      'last_updated',
      'created_at',
      'updated_at',
      'sync_status'
    ],
    exampleRow: [
      'cust_123456',
      'John\'s Auto Repair',
      '123 Main St, City, Country',
      '+1234567890',
      'city_ref_001',
      'New York',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '30',
      '0',
      'active',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      'pending'
    ]
  },
  items: {
    name: 'Items',
    description: 'Template for importing inventory items',
    headers: [
      'ID',
      'Display Name',
      'Internal Name',
      'SKU',
      'Vehicle',
      'Brand/Origin',
      'Category',
      'Unit Value',
      'Stock Qty',
      'Low Stock Threshold',
      'Out of Stock',
      'Status',
      'Last Updated',
      'created_at',
      'updated_at',
      'sync_status'
    ],
    exampleRow: [
      'item_123456',
      'Brake Pads - Front',
      'Front Brake Pads',
      'BP-FRONT-001',
      'Toyota Camry',
      'Genuine Toyota',
      'Brakes',
      '1500.00',
      '50',
      '10',
      'false',
      'active',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      'pending'
    ]
  },
  orders: {
    name: 'Orders',
    description: 'Template for importing order data',
    headers: [
      'Order ID',
      'Customer ID',
      'Rep ID',
      'Date',
      'Gross Total',
      'Disc 1 Rate',
      'Disc 1 Value',
      'Disc 2 Rate',
      'Disc 2 Value',
      'Net Total',
      'Paid',
      'Balance Due',
      'Payment Status',
      'Delivery Status',
      'Credit Period',
      'Status',
      'Last Updated',
      'created_at',
      'updated_at',
      'sync_status',
      'approval_status',
      'invoice_number'
    ],
    exampleRow: [
      'ord_123456',
      'cust_123456',
      'rep_789',
      '2023-01-01',
      '150.00',
      '0.1',
      '15.00',
      '0.05',
      '7.50',
      '127.50',
      '0.00',
      '127.50',
      'unpaid',
      'pending',
      '30',
      'confirmed',
      '2023-01-01T00:00:00.000Z',
      '2023-01-01T00:00:00.000Z',
      '2023-01-01T00:00:00.000Z',
      'pending',
      'approved',
      'INV0001'
    ]
  },
  orderLines: {
    name: 'Order Lines',
    description: 'Template for importing order line items',
    headers: [
      'Line ID',
      'Order ID',
      'Item ID',
      'Item Name',
      'Qty',
      'Unit Price',
      'Line Total',
      'created_at',
      'updated_at',
      'sync_status'
    ],
    exampleRow: [
      'line_123',
      'ord_123456',
      'item_456789',
      'Brake Pads - Front',
      '2',
      '45.99',
      '91.98',
      '2023-01-01T00:00:00.000Z',
      '2023-01-01T00:00:00.000Z',
      'pending'
    ]
  },
  settings: {
    name: 'Settings',
    description: 'Template for importing company settings',
    headers: [
      'id',
      'company_name',
      'address',
      'phone',
      'email',
      'logo_url',
      'auto_sku_enabled',
      'stock_tracking_enabled',
      'category_enabled',
      'show_sku_in_item_cards',
      'invoice_prefix',
      'starting_invoice_number',
      'show_advanced_sync_options',
      'created_at',
      'updated_at',
      'sync_status'
    ],
    exampleRow: [
      'main',
      'My Company Ltd',
      '123 Business St, City, Country',
      '+1234567890',
      'info@company.com',
      'https://example.com/logo.png',
      'true',
      'true',
      'true',
      'true',
      'INV',
      '1',
      'false',
      '2023-01-01T00:00:00.000Z',
      '2023-01-01T00:00:00.000Z',
      'pending'
    ]
  }
};

/**
 * Generates a CSV string from a template
 * @param templateName The name of the template to use
 * @returns A CSV string with headers and one example row
 */
export function generateCsvTemplate(templateName: string): string {
  const template = CSV_TEMPLATES[templateName];
  
  if (!template) {
    throw new Error(`Template '${templateName}' not found`);
  }

  // Create CSV content with headers and example row
  const csvRows = [
    template.headers.join(','),
    template.exampleRow.map(cell => `"${cell}"`).join(',')
  ];

  return csvRows.join('\n');
}

/**
 * Downloads a CSV template file
 * @param templateName The name of the template to download
 * @param filename The name of the file to download
 */
export function downloadCsvTemplate(templateName: string, filename?: string) {
  const csvContent = generateCsvTemplate(templateName);
  const defaultFilename = filename || `${templateName}_template.csv`;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', defaultFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Validates a CSV string against a template
 * @param csvString The CSV string to validate
 * @param templateName The name of the template to validate against
 * @returns An object with validation results
 */
export function validateCsvAgainstTemplate(csvString: string, templateName: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const template = CSV_TEMPLATES[templateName];
  
  if (!template) {
    return {
      isValid: false,
      errors: [`Template '${templateName}' not found`],
      warnings: []
    };
  }

  // Split CSV into rows
  const rows = csvString.split('\n').filter(row => row.trim() !== '');
  
  if (rows.length < 2) {
    return {
      isValid: false,
      errors: ['CSV must contain at least one header row and one data row'],
      warnings: []
    };
  }

  // Check headers
  const headerRow = rows[0];
  const headers = headerRow.split(',').map(h => h.trim().replace(/"/g, ''));
  
  const missingHeaders = template.headers.filter(header => !headers.includes(header));
  const extraHeaders = headers.filter(header => !template.headers.includes(header));
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (missingHeaders.length > 0) {
    errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
  }
  
  if (extraHeaders.length > 0) {
    warnings.push(`Extra headers found (will be ignored): ${extraHeaders.join(', ')}`);
  }
  
  // Check that all rows have the same number of columns as headers
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Parse CSV properly handling quoted fields
    const cells = parseCsvRow(row);

    // Calculate expected columns (use template headers or actual header row)
    const expectedCols = headers.length;

    if (cells.length !== expectedCols) {
      errors.push(`Row ${i + 1} has ${cells.length} columns, expected ${expectedCols}`);
      if (errors.length > 5) {
        errors.push('...and more errors (fix first 5 and try again)');
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Parse a CSV row handling quoted fields
 */
function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}