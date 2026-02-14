// SQLite Database Service for PartFlow Pro
// This file provides the database interface using SQLite instead of IndexedDB

import { sqliteDB } from './sqlite-db';
import { Customer, Item, Order, CompanySettings, SyncStats, User, StockAdjustment } from '../types';
import { supabaseService } from './supabase';
import { jsonToCsv, downloadCsv } from '../utils/csv';
import { connectionService } from './connection';

// Keys for LocalStorage
const STORAGE_KEYS = {
  LAST_SYNC: 'fieldaudit_last_sync',
  USER: 'fieldaudit_current_user',
  DB_MODE: 'partflow_db_mode', // 'sqlite' or 'indexeddb'
};

// Local cache for fast reads
class LocalCache {
  customers: Customer[] = [];
  items: Item[] = [];
  orders: Order[] = [];
  settings: CompanySettings | null = null;
  users: User[] = [];
  adjustments: StockAdjustment[] = [];
}

class LocalDB {
  private cache = new LocalCache();
  private isInitialized = false;
  private useIndexedDB = false;
  private indexedDBInstance: any = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Check if we should use IndexedDB fallback
    const dbMode = localStorage.getItem(STORAGE_KEYS.DB_MODE);
    if (dbMode === 'indexeddb') {
      console.log('[DB] Using IndexedDB fallback');
      this.useIndexedDB = true;
      await this.initIndexedDB();
      return;
    }
    
    // Try SQLite with timeout
    try {
      console.log('[DB] Attempting SQLite initialization...');
      const sqliteInitPromise = sqliteDB.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SQLite initialization timeout')), 5000)
      );
      
      await Promise.race([sqliteInitPromise, timeoutPromise]);
      console.log('[DB] SQLite initialized successfully');
      await this.refreshCache();
      this.isInitialized = true;
    } catch (error: any) {
      console.warn('[DB] SQLite failed, falling back to IndexedDB:', error.message);
      localStorage.setItem(STORAGE_KEYS.DB_MODE, 'indexeddb');
      this.useIndexedDB = true;
      await this.initIndexedDB();
    }
  }
  
  private async initIndexedDB(): Promise<void> {
    // Dynamically import the old IndexedDB service as fallback
    const { db: oldDb } = await import('./db-indexeddb');
    this.indexedDBInstance = oldDb;
    await this.indexedDBInstance.initialize();
    await this.refreshCache();
    this.isInitialized = true;
    console.log('[DB] IndexedDB fallback initialized');
  }

  // Refresh cache from database
  private async refreshCache(): Promise<void> {
    this.cache.customers = await sqliteDB.getCustomers();
    this.cache.items = await sqliteDB.getItems();
    this.cache.orders = await sqliteDB.getOrders();
    this.cache.settings = await sqliteDB.getSettings();
    this.cache.users = await sqliteDB.getUsers();
  }

  // --- Customers ---
  getCustomers(): Customer[] {
    return this.cache.customers;
  }

  getCustomer(customerId: string): Customer | undefined {
    return this.cache.customers.find(c => c.customer_id === customerId);
  }

  async saveCustomer(customer: Customer): Promise<void> {
    customer.sync_status = 'pending';
    customer.updated_at = new Date().toISOString();
    await sqliteDB.saveCustomer(customer);
    await this.refreshCache();
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await sqliteDB.deleteCustomer(customerId);
    await this.refreshCache();
  }

  // --- Items ---
  getItems(): Item[] {
    return this.cache.items;
  }

  getItem(itemId: string): Item | undefined {
    return this.cache.items.find(i => i.item_id === itemId);
  }

  async saveItem(item: Item): Promise<void> {
    item.sync_status = 'pending';
    item.updated_at = new Date().toISOString();
    await sqliteDB.saveItem(item);
    await this.refreshCache();
  }

  async deleteItem(itemId: string): Promise<void> {
    await sqliteDB.deleteItem(itemId);
    await this.refreshCache();
  }

  async updateStock(itemId: string, quantityChange: number): Promise<void> {
    await sqliteDB.updateStock(itemId, quantityChange);
    await this.refreshCache();
  }

  // --- Orders ---
  getOrders(): Order[] {
    return this.cache.orders;
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    return await sqliteDB.getOrder(orderId);
  }

  async saveOrder(order: Order): Promise<void> {
    order.sync_status = 'pending';
    order.updated_at = new Date().toISOString();
    await sqliteDB.saveOrder(order);
    await this.refreshCache();
  }

  async deleteOrder(orderId: string): Promise<void> {
    await sqliteDB.deleteOrder(orderId);
    await this.refreshCache();
  }

  // --- Settings ---
  getSettings(): CompanySettings {
    return this.cache.settings || {
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
    await sqliteDB.saveSettings(settings);
    await this.refreshCache();
  }

  // --- Sync Stats ---
  async getSyncStats(): Promise<SyncStats> {
    return await sqliteDB.getSyncStats();
  }

  // --- Users ---
  getUsers(): User[] {
    return this.cache.users;
  }

  async login(username: string, password: string): Promise<User | null> {
    const user = await sqliteDB.login(username, password);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    return user;
  }

  getCurrentUser(): User | null {
    const userJson = localStorage.getItem(STORAGE_KEYS.USER);
    return userJson ? JSON.parse(userJson) : null;
  }

  logout(): void {
