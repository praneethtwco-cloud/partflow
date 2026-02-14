import { parseCsv } from '../utils/csv';
import { 
  transformCustomerFromCsv, 
  transformItemFromCsv, 
  transformOrderFromCsv, 
  transformOrderLineFromCsv 
} from './csv-migration';
import { db } from './db';
import { Customer, Item, Order, OrderLine } from '../types';
import { importLogger } from './import-logger';

export interface CsvImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  updatedCount: number;
  errorCount: number;
  errors?: string[];
}

export class CsvImportService {
  /**
   * Imports customer data from a CSV file
   */
  async importCustomers(file: File): Promise<CsvImportResult> {
    try {
      const csvData = await parseCsv(file);
      let importedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (const row of csvData) {
        try {
          const customerData = transformCustomerFromCsv(row);
          
          // Check if customer already exists
          const existingCustomer = await db.db.customers.get(customerData.customer_id);
          
          if (existingCustomer) {
            // Update existing customer
            await db.saveCustomer(customerData);
            updatedCount++;
            importLogger.log({
              entityType: 'customers',
              action: 'update',
              entityId: customerData.customer_id,
              entityName: customerData.shop_name,
              message: `Updated customer ${customerData.shop_name} (${customerData.customer_id})`,
              success: true,
              originalData: row,
              processedData: customerData
            });
          } else {
            // Create new customer
            await db.saveCustomer(customerData);
            importedCount++;
            importLogger.log({
              entityType: 'customers',
              action: 'create',
              entityId: customerData.customer_id,
              entityName: customerData.shop_name,
              message: `Created customer ${customerData.shop_name} (${customerData.customer_id})`,
              success: true,
              originalData: row,
              processedData: customerData
            });
          }
        } catch (error) {
          const errorMsg = `Error processing customer ${row.ID || row.customer_id}: ${(error as Error).message}`;
          errors.push(errorMsg);
          importLogger.log({
            entityType: 'customers',
            action: 'error',
            message: errorMsg,
            success: false,
            originalData: row
          });
        }
      }

      const message = `Successfully imported ${importedCount} new customers and updated ${updatedCount} existing customers.`;
      importLogger.log({
        entityType: 'customers',
        action: 'import',
        message: message,
        success: true
      });

      return {
        success: true,
        message: message,
        importedCount,
        updatedCount,
        errorCount: errors.length,
        errors
      };
    } catch (error) {
      const errorMsg = `Failed to import customers: ${(error as Error).message}`;
      importLogger.log({
        entityType: 'customers',
        action: 'error',
        message: errorMsg,
        success: false
      });
      
      return {
        success: false,
        message: errorMsg,
        importedCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Imports item data from a CSV file
   */
  async importItems(file: File): Promise<CsvImportResult> {
    try {
      const csvData = await parseCsv(file);
      let importedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (const row of csvData) {
        try {
          const itemData = transformItemFromCsv(row);
          
          // Check if item already exists
          const existingItem = await db.db.items.get(itemData.item_id);
          
          if (existingItem) {
            // Update existing item
            await db.saveItem(itemData);
            updatedCount++;
            importLogger.log({
              entityType: 'items',
              action: 'update',
              entityId: itemData.item_id,
              entityName: itemData.item_display_name,
              message: `Updated item ${itemData.item_display_name} (${itemData.item_id})`,
              success: true,
              originalData: row,
              processedData: itemData
            });
          } else {
            // Create new item
            await db.saveItem(itemData);
            importedCount++;
            importLogger.log({
              entityType: 'items',
              action: 'create',
              entityId: itemData.item_id,
              entityName: itemData.item_display_name,
              message: `Created item ${itemData.item_display_name} (${itemData.item_id})`,
              success: true,
              originalData: row,
              processedData: itemData
            });
          }
        } catch (error) {
          const errorMsg = `Error processing item ${row.ID || row.item_id}: ${(error as Error).message}`;
          errors.push(errorMsg);
          importLogger.log({
            entityType: 'items',
            action: 'error',
            message: errorMsg,
            success: false,
            originalData: row
          });
        }
      }

      const message = `Successfully imported ${importedCount} new items and updated ${updatedCount} existing items.`;
      importLogger.log({
        entityType: 'items',
        action: 'import',
        message: message,
        success: true
      });

      return {
        success: true,
        message: message,
        importedCount,
        updatedCount,
        errorCount: errors.length,
        errors
      };
    } catch (error) {
      const errorMsg = `Failed to import items: ${(error as Error).message}`;
      importLogger.log({
        entityType: 'items',
        action: 'error',
        message: errorMsg,
        success: false
      });
      
      return {
        success: false,
        message: errorMsg,
        importedCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Imports order data from a CSV file
   */
  async importOrders(file: File): Promise<CsvImportResult> {
    try {
      const csvData = await parseCsv(file);
      let importedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (const row of csvData) {
        try {
          const orderData = transformOrderFromCsv(row);
          
          // Check if order already exists
          const existingOrder = await db.db.orders.get(orderData.order_id);
          
          if (existingOrder) {
            // Update existing order
            await db.saveOrder(orderData);
            updatedCount++;
            importLogger.log({
              entityType: 'orders',
              action: 'update',
              entityId: orderData.order_id,
              entityName: orderData.invoice_number || orderData.order_id,
              message: `Updated order ${orderData.invoice_number || orderData.order_id} (${orderData.order_id})`,
              success: true,
              originalData: row,
              processedData: orderData
            });
          } else {
            // Create new order
            await db.saveOrder(orderData);
            importedCount++;
            importLogger.log({
              entityType: 'orders',
              action: 'create',
              entityId: orderData.order_id,
              entityName: orderData.invoice_number || orderData.order_id,
              message: `Created order ${orderData.invoice_number || orderData.order_id} (${orderData.order_id})`,
              success: true,
              originalData: row,
              processedData: orderData
            });
          }
        } catch (error) {
          const errorMsg = `Error processing order ${row['Order ID'] || row.order_id}: ${(error as Error).message}`;
          errors.push(errorMsg);
          importLogger.log({
            entityType: 'orders',
            action: 'error',
            message: errorMsg,
            success: false,
            originalData: row
          });
        }
      }

      const message = `Successfully imported ${importedCount} new orders and updated ${updatedCount} existing orders.`;
      importLogger.log({
        entityType: 'orders',
        action: 'import',
        message: message,
        success: true
      });

      return {
        success: true,
        message: message,
        importedCount,
        updatedCount,
        errorCount: errors.length,
        errors
      };
    } catch (error) {
      const errorMsg = `Failed to import orders: ${(error as Error).message}`;
      importLogger.log({
        entityType: 'orders',
        action: 'error',
        message: errorMsg,
        success: false
      });
      
      return {
        success: false,
        message: errorMsg,
        importedCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Imports order line data from a CSV file
   */
  async importOrderLines(file: File): Promise<CsvImportResult> {
    try {
      const csvData = await parseCsv(file);
      let importedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      // For order lines, we need to associate them with existing orders
      for (const row of csvData) {
        try {
          const orderLineData = transformOrderLineFromCsv(row);
          
          // Get the order to update its lines
          const order = await db.db.orders.get(orderLineData.order_id);
          
          if (order) {
            // Add or update the order line in the order's lines array
            const existingLineIndex = order.lines.findIndex(line => line.line_id === orderLineData.line_id);
            
            if (existingLineIndex !== -1) {
              // Update existing line
              order.lines[existingLineIndex] = orderLineData;
              updatedCount++;
              importLogger.log({
                entityType: 'orderLines',
                action: 'update',
                entityId: orderLineData.line_id,
                entityName: `Order ${orderLineData.order_id} - Line ${orderLineData.line_id}`,
                message: `Updated order line ${orderLineData.line_id} for order ${orderLineData.order_id}`,
                success: true,
                originalData: row,
                processedData: orderLineData
              });
            } else {
              // Add new line
              order.lines.push(orderLineData);
              importedCount++;
              importLogger.log({
                entityType: 'orderLines',
                action: 'create',
                entityId: orderLineData.line_id,
                entityName: `Order ${orderLineData.order_id} - Line ${orderLineData.line_id}`,
                message: `Created order line ${orderLineData.line_id} for order ${orderLineData.order_id}`,
                success: true,
                originalData: row,
                processedData: orderLineData
              });
            }
            
            // Save the updated order
            await db.saveOrder(order);
          } else {
            const errorMsg = `Order with ID ${orderLineData.order_id} not found for order line ${orderLineData.line_id}`;
            errors.push(errorMsg);
            importLogger.log({
              entityType: 'orderLines',
              action: 'error',
              message: errorMsg,
              success: false,
              originalData: row
            });
          }
        } catch (error) {
          const errorMsg = `Error processing order line ${row['Line ID'] || row.line_id}: ${(error as Error).message}`;
          errors.push(errorMsg);
          importLogger.log({
            entityType: 'orderLines',
            action: 'error',
            message: errorMsg,
            success: false,
            originalData: row
          });
        }
      }

      const message = `Successfully imported ${importedCount} new order lines and updated ${updatedCount} existing order lines.`;
      importLogger.log({
        entityType: 'orderLines',
        action: 'import',
        message: message,
        success: true
      });

      return {
        success: true,
        message: message,
        importedCount,
        updatedCount,
        errorCount: errors.length,
        errors
      };
    } catch (error) {
      const errorMsg = `Failed to import order lines: ${(error as Error).message}`;
      importLogger.log({
        entityType: 'orderLines',
        action: 'error',
        message: errorMsg,
        success: false
      });
      
      return {
        success: false,
        message: errorMsg,
        importedCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Imports data from a CSV file based on the entity type
   */
  async importByEntityType(entityType: 'customers' | 'items' | 'orders' | 'orderLines', file: File): Promise<CsvImportResult> {
    // Log the import start
    importLogger.log({
      entityType,
      action: 'import',
      message: `Starting import of ${entityType} from CSV file`,
      success: true
    });

    let result: CsvImportResult;
    switch (entityType) {
      case 'customers':
        result = await this.importCustomers(file);
        break;
      case 'items':
        result = await this.importItems(file);
        break;
      case 'orders':
        result = await this.importOrders(file);
        break;
      case 'orderLines':
        result = await this.importOrderLines(file);
        break;
      default:
        result = {
          success: false,
          message: `Unsupported entity type: ${entityType}`,
          importedCount: 0,
          updatedCount: 0,
          errorCount: 1,
          errors: [`Unsupported entity type: ${entityType}`]
        };
    }

    // Log the import completion
    importLogger.log({
      entityType,
      action: 'import',
      message: result.message,
      success: result.success
    });

    return result;
  }
  /**
   * Gets the import summary with statistics
   */
  getImportSummary() {
    return importLogger.getSummary();
  }

  /**
   * Gets the recent import logs
   */
  getRecentLogs(limit: number = 50) {
    return importLogger.getRecentLogs(limit);
  }

  /**
   * Clears the import logs
   */
  clearLogs() {
    importLogger.clearLogs();
  }
}

export const csvImportService = new CsvImportService();