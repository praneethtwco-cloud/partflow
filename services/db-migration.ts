import { db } from './db';
import { sqliteDB } from './sqlite-db';

export interface MigrationProgress {
  phase: 'initializing' | 'customers' | 'items' | 'orders' | 'settings' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export type MigrationCallback = (progress: MigrationProgress) => void;

class DatabaseMigration {
  private isMigrating = false;

  async migrate(callback?: MigrationCallback): Promise<boolean> {
    if (this.isMigrating) {
      callback?.({
        phase: 'error',
        progress: 0,
        message: 'Migration already in progress',
        error: 'Migration already running'
      });
      return false;
    }

    this.isMigrating = true;

    try {
      // Phase 1: Initialize SQLite
      callback?.({
        phase: 'initializing',
        progress: 5,
        message: 'Initializing SQLite database...'
      });

      await sqliteDB.initialize();

      // Phase 2: Migrate Customers
      callback?.({
        phase: 'customers',
        progress: 10,
        message: 'Migrating customers...'
      });

      const customers = db.getCustomers();
      for (let i = 0; i < customers.length; i++) {
        await sqliteDB.saveCustomer(customers[i]);
        const progress = 10 + Math.floor((i / customers.length) * 20);
        callback?.({
          phase: 'customers',
          progress,
          message: `Migrating customer ${i + 1} of ${customers.length}...`
        });
      }

      // Phase 3: Migrate Items
      callback?.({
        phase: 'items',
        progress: 30,
        message: 'Migrating items...'
      });

      const items = db.getItems();
      for (let i = 0; i < items.length; i++) {
        await sqliteDB.saveItem(items[i]);
        const progress = 30 + Math.floor((i / items.length) * 20);
        callback?.({
          phase: 'items',
          progress,
          message: `Migrating item ${i + 1} of ${items.length}...`
        });
      }

      // Phase 4: Migrate Orders
      callback?.({
        phase: 'orders',
        progress: 50,
        message: 'Migrating orders...'
      });

      const orders = db.getOrders();
      for (let i = 0; i < orders.length; i++) {
        await sqliteDB.saveOrder(orders[i]);
        const progress = 50 + Math.floor((i / orders.length) * 30);
        callback?.({
          phase: 'orders',
          progress,
          message: `Migrating order ${i + 1} of ${orders.length}...`
        });
      }

      // Phase 5: Migrate Settings
      callback?.({
        phase: 'settings',
        progress: 80,
        message: 'Migrating settings...'
      });

      const settings = db.getSettings();
      await sqliteDB.saveSettings(settings);

      // Phase 6: Complete
      callback?.({
        phase: 'complete',
        progress: 100,
        message: `Migration complete! Migrated ${customers.length} customers, ${items.length} items, ${orders.length} orders.`
      });

      this.isMigrating = false;
      return true;

    } catch (error: any) {
      this.isMigrating = false;
      callback?.({
        phase: 'error',
        progress: 0,
        message: 'Migration failed',
        error: error.message
      });
      console.error('Migration error:', error);
      return false;
    }
  }

  async verifyMigration(): Promise<{
    success: boolean;
    indexedDBCounts: { customers: number; items: number; orders: number };
    sqliteCounts: { customers: number; items: number; orders: number };
    mismatches: string[];
  }> {
    try {
      // Get counts from IndexedDB
      const indexedDBCustomers = db.getCustomers().length;
      const indexedDBItems = db.getItems().length;
      const indexedDBOrders = db.getOrders().length;

      // Get counts from SQLite
      const sqliteCustomers = (await sqliteDB.getCustomers()).length;
      const sqliteItems = (await sqliteDB.getItems()).length;
      const sqliteOrders = (await sqliteDB.getOrders()).length;

      const mismatches: string[] = [];

      if (indexedDBCustomers !== sqliteCustomers) {
        mismatches.push(`Customers: ${indexedDBCustomers} in IndexedDB, ${sqliteCustomers} in SQLite`);
      }
      if (indexedDBItems !== sqliteItems) {
        mismatches.push(`Items: ${indexedDBItems} in IndexedDB, ${sqliteItems} in SQLite`);
      }
      if (indexedDBOrders !== sqliteOrders) {
        mismatches.push(`Orders: ${indexedDBOrders} in IndexedDB, ${sqliteOrders} in SQLite`);
      }

      return {
        success: mismatches.length === 0,
        indexedDBCounts: {
          customers: indexedDBCustomers,
          items: indexedDBItems,
          orders: indexedDBOrders
        },
        sqliteCounts: {
          customers: sqliteCustomers,
          items: sqliteItems,
          orders: sqliteOrders
        },
        mismatches
      };
    } catch (error: any) {
      return {
        success: false,
        indexedDBCounts: { customers: 0, items: 0, orders: 0 },
        sqliteCounts: { customers: 0, items: 0, orders: 0 },
        mismatches: [`Verification error: ${error.message}`]
      };
    }
  }

  isMigrationRunning(): boolean {
    return this.isMigrating;
  }
}

export const dbMigration = new DatabaseMigration();
