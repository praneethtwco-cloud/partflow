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
      'email',
      'outstanding_balance',
      'secondary_discount_rate',
      'created_at',
      'updated_at',
      'sync_status'
    ],
    exampleRow: [
      'cust_123456',
      'John\'s Auto Repair',
      '123 Main St, City, Country',
      '+1234567890',
      'john@example.com',
      '0.00',
      '0',
      '2023-01-01T00:00:00.000Z',
      '2023-01-01T00:00:00.000Z',
      'pending'
    ]
  },
  items: {
    name: 'Items',
    description: 'Template for importing inventory items',
    headers: [
      'item_id',
      'item_display_name',
      'item_name',
      'item_number',
      'vehicle_model',
      'source_brand',
      'category',
      'unit_value',
      'current_stock_qty',
      'low_stock_threshold',
      'is_out_of_stock',
      'status',
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
      '45.99',
      '25',
      '5',
      'false',
      'active',
      '2023-01-01T00:00:00.000Z',
      '2023-01-01T00:00:00.000Z',
      'pending'
    ]
  },
  orders: {
    name: 'Orders',
    description: 'Template for importing order data',
    headers: [
      'order_id',
      'customer_id',
      'order_date',
      'order_status',
      'delivery_status',
      'payment_status',
      'net_total',
      'paid_amount',
      'balance_due',
      'approval_status',
      'invoice_number',
      'original_invoice_number',
      'lines',
      'payments',
      'delivery_notes',
      'created_at',
      'updated_at',
      'sync_status'
    ],
    exampleRow: [
      'ord_123456',
      'cust_123456',
      '2023-01-01',
      'confirmed',
      'pending',
      'unpaid',
      '123.45',
      '0.00',
      '123.45',
      'approved',
      'INV0001',
      'INV0001',
      '[]',
      '[]',
      'Handle with care',
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
    const cells = row.split(',').map(cell => cell.trim());
    
    if (cells.length !== headers.length) {
      errors.push(`Row ${i + 1} has ${cells.length} columns, expected ${headers.length}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}