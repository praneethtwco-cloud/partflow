// Hybrid Database Service - Uses SQLite on mobile, IndexedDB on web

import { sqliteDB } from './sqlite-db';
import Dexie, { Table } from 'dexie';
import { Customer, Item, Order, CompanySettings, SyncStats, User, StockAdjustment } from '../types';
import { supabaseService } from './supabase';
import { jsonToCsv, downloadCsv } from '../utils/csv';
import { connectionService } from './connection';

const STORAGE_KEYS = {
  LAST_SYNC: 'fieldaudit_last_sync',
  USER: 'fieldaudit_current_user',
};

// Detect if running on mobile (Capacitor)
const isMobile = () => {
  return !!(window as any).Capacitor;
};

// IndexedDB Setup (for web fallback)
class PartFlowDB extends Dexie {
  customers!: Table<Customer, string>;
  items!: Table<Item, string>;
  orders!: Table<Order, string>;
  settings!: Table<CompanySettings, string>;
  stockAdjustments!: Table<StockAdjustment, string>;
  users!: Table<User, string>;

  constructor() {
    super('PartFlowDB');
    this.version(11).stores({
      customers: 'customer_id, shop_name, sync_status',
      items: 'item_id, item_number, sync_status',
      orders: 'order_id, customer_id, sync_status',
      settings: 'id',
      stockAdjustments: 'adjustment_id, sync_status',
      users: 'id, username'
    });
  }
}

class HybridDB {
  private dexieDB: PartFlowDB;
  private useSQLite: boolean = false;
  private isInitialized = false;

  constructor() {
    this.dexieDB = new PartFlowDB();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Try SQLite only on mobile
    if (isMobile()) {
      try {
        await sqliteDB.initialize();
        this.useSQLite = true;
        console.log('[DB] Using SQLite (mobile)');
      } catch (error) {
        console.warn('[DB] SQLite failed, using IndexedDB:', error);
        this.useSQLite = false;
      }
    } else {
      console.log('[DB] Using IndexedDB (web)');
      this.useSQLite = false;
    }

    this.isInitialized = true;
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    if (this.useSQLite) {
      return await sqliteDB.getCustomers();
    }
    return await this.dexieDB.customers.toArray();
  }

  async saveCustomer(customer: Customer): Promise<void> {
    customer.sync_status = 'pending';
    customer.updated_at = new Date().toISOString();
    if (this.useSQLite) {
      await sqliteDB.saveCustomer(customer);
    } else {
      await this.dexieDB.customers.put(customer);
    }
  }

  // Items
  async getItems(): Promise<Item[]> {
    if (this.useSQLite) {
      return await sqliteDB.getItems();
    }
    return await this.dexieDB.items.toArray();
  }

  async getItem(itemId: string): Promise<Item | undefined> {
    if (this.useSQLite) {
      return await sqliteDB.getItem(itemId);
    }
    return await this.dexieDB.items.get(itemId);
  }

  async saveItem(item: Item): Promise<void> {
    item.sync_status = 'pending';
    item.updated_at = new Date().toISOString();
    if (this.useSQLite) {
      await sqliteDB.saveItem(item);
    } else {
      await this.dexieDB.items.put(item);
    }
  }

  async updateStock(itemId: string, quantityChange: number): Promise<void> {
    if (this.useSQLite) {
      await sqliteDB.updateStock(itemId, quantityChange);
    } else {
      const item = await this.dexieDB.items.get(itemId);
      if (item) {
        item.current_stock_qty += quantityChange;
        await this.dexieDB.items.put(item);
      }
    }
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    if (this.useSQLite) {
      return await sqliteDB.getOrders();
    }
    return await this.dexieDB.orders.toArray();
  }

  async saveOrder(order: Order): Promise<void> {
    order.sync_status = 'pending';
    order.updated_at = new Date().toISOString();
    if (this.useSQLite) {
      await sqliteDB.saveOrder(order);
    } else {
      await this.dexieDB.orders.put(order);
    }
  }

  // Settings
  async getSettings(): Promise<CompanySettings> {
    if (this.useSQLite) {
      return await sqliteDB.getSettings();
    }
    const settings = await this.dexieDB.settings.get('main');
    return settings || {
      company_name: 'My Company',
      address: '',
      phone: '',
      rep_name: '',
      invoice_prefix: 'INV',
      starting_invoice_number: 1,
      footer_note: '',
      currency_symbol: '$',
      tax_rate: 0,
      auto_sku_enabled: true,
      stock_tracking_enabled: false,
      category_enabled: false,
      show_sku_in_item_cards: false,
      show_advanced_sync_options: false
    };
  }

  async saveSettings(settings: CompanySettings): Promise<void> {
    if (this.useSQLite) {
      await sqliteDB.saveSettings(settings);
    } else {
      const settingsWithId = settings as any;
      settingsWithId.id = 'main';
      await this.dexieDB.settings.put(settingsWithId);
    }
  }

  // Users
  async getUsers(): Promise<User[]> {
    if (this.useSQLite) {
      return await sqliteDB.getUsers();
    }
    return await this.dexieDB.users.toArray();
  }

  async login(username: string, password: string): Promise<User | null> {
    if (this.useSQLite) {
      return await sqliteDB.login(username, password);
    }
    const user = await this.dexieDB.users.where({ username, password }).first();
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    return user || null;
  }

  getCurrentUser(): User | null {
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    return userJson ? JSON.parse(userJson) : null;
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  // Sync Stats
  async getSyncStats(): Promise<SyncStats> {
    const customers = await this.getCustomers();
    const items = await this.getItems();
    const orders = await this.getOrders();
    
    return {
      pendingCustomers: customers.filter(c => c.sync_status === 'pending').length,
      pendingItems: items.filter(i => i.sync_status === 'pending').length,
      pendingOrders: orders.filter(o => o.sync_status === 'pending').length,
      pendingAdjustments: 0
    };
  }

  // Sync
  async performSync(onLog?: (msg: string) => void, mode: 'upsert' | 'overwrite' = 'upsert'): Promise<void> {
    if (!connectionService.getOnlineStatus()) {
      throw new Error('Cannot sync while offline');
    }

    onLog?.('Starting sync...');
    
    const customers = (await this.getCustomers()).filter(c => c.sync_status === 'pending');
    const items = (await this.getItems()).filter(i => i.sync_status === 'pending');
    const orders = (await this.getOrders()).filter(o => o.sync_status === 'pending');

    const result = await supabaseService.syncData(
      customers, orders, items,
      [await this.getSettings()],
      await this.getUsers(),
      [],
      mode
    );

    if (!result.success) {
      throw new Error(result.message || 'Sync failed');
    }

    // Update sync status
    for (const c of customers) { c.sync_status = 'synced'; await this.saveCustomer(c); }
    for (const i of items) { i.sync_status = 'synced'; await this.saveItem(i); }
    for (const o of orders) { o.sync_status = 'synced'; await this.saveOrder(o); }

    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    onLog?.('Sync completed');
  }

  isDatabaseInitialized(): boolean {
    return this.isInitialized;
  }
}

export const db = new HybridDB();
