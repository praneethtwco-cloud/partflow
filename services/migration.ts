import { db } from './db';
import { supabaseService } from './supabase';
import { Customer, Item, Order, CompanySettings, User, StockAdjustment } from '../types';

// Note: This service is designed to migrate from the local database
// (which may have originated from Google Sheets) to Supabase.
// The actual data is already in the local database, so we're essentially
// syncing local data to Supabase.

class MigrationService {
  async migrateFromGoogleSheetsToSupabase(): Promise<{ success: boolean; message: string }> {
    try {
      // Get all current data from local database
      const customers = db.getCustomers();
      const items = db.getItems();
      const orders = db.getOrders();
      const settings = [db.getSettings()];
      const users = db.getCurrentUser() ? [db.getCurrentUser() as User] : [];
      
      // Get stock adjustments using the new getter method
      const adjustments = db.getStockAdjustments();
      
      // Upload all data to Supabase
      const result = await supabaseService.syncData(
        customers,
        orders,
        items,
        settings,
        users,
        adjustments,
        'upsert'
      );

      if (!result.success) {
        return {
          success: false,
          message: `Migration failed: ${result.message}`
        };
      }

      // Update sync status for all migrated records
      await this.updateSyncStatus(customers, items, orders);

      return {
        success: true,
        message: `Successfully migrated ${customers.length} customers, ${items.length} items, ${orders.length} orders, and ${users.length} users to Supabase.`
      };
    } catch (error: any) {
      console.error('Migration error:', error);
      return {
        success: false,
        message: `Migration failed with error: ${error.message}`
      };
    }
  }

  private async updateSyncStatus(customers: Customer[], items: Item[], orders: Order[]) {
    // Update sync status to 'synced' for all migrated records
    for (const customer of customers) {
      const updatedCustomer = { ...customer, sync_status: 'synced' as const };
      await db.saveCustomer(updatedCustomer);
    }

    for (const item of items) {
      const updatedItem = { ...item, sync_status: 'synced' as const };
      await db.saveItem(updatedItem);
    }

    for (const order of orders) {
      const updatedOrder = { ...order, sync_status: 'synced' as const };
      await db.saveOrder(updatedOrder);
    }
  }

  async validateMigration(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Pull data from Supabase
      const pullResult = await supabaseService.syncData([], [], [], [], [], []);
      
      if (!pullResult.success) {
        return {
          isValid: false,
          issues: [`Failed to pull data from Supabase: ${pullResult.message}`]
        };
      }

      // Compare counts
      const localCustomers = db.getCustomers();
      const localItems = db.getItems();
      const localOrders = db.getOrders();
      
      if (pullResult.pulledCustomers?.length !== localCustomers.length) {
        issues.push(`Customer count mismatch: Local ${localCustomers.length}, Supabase ${pullResult.pulledCustomers?.length || 0}`);
      }
      
      if (pullResult.pulledItems?.length !== localItems.length) {
        issues.push(`Item count mismatch: Local ${localItems.length}, Supabase ${pullResult.pulledItems?.length || 0}`);
      }
      
      if (pullResult.pulledOrders?.length !== localOrders.length) {
        issues.push(`Order count mismatch: Local ${localOrders.length}, Supabase ${pullResult.pulledOrders?.length || 0}`);
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error: any) {
      issues.push(`Validation error: ${error.message}`);
      return {
        isValid: false,
        issues
      };
    }
  }
  
  /**
   * Performs a dry run of the migration to estimate what would be migrated
   */
  async dryRun(): Promise<{ 
    customersCount: number; 
    itemsCount: number; 
    ordersCount: number; 
    usersCount: number; 
    settingsCount: number;
    adjustmentsCount: number;
  }> {
    const customers = db.getCustomers();
    const items = db.getItems();
    const orders = db.getOrders();
    const settings = [db.getSettings()];
    const users = db.getCurrentUser() ? [db.getCurrentUser() as User] : [];
    const adjustments = db.getStockAdjustments();
    
    return {
      customersCount: customers.length,
      itemsCount: items.length,
      ordersCount: orders.length,
      usersCount: users.length,
      settingsCount: settings.length,
      adjustmentsCount: adjustments.length
    };
  }
}

export const migrationService = new MigrationService();