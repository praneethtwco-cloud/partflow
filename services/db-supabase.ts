import Dexie, { Table } from 'dexie';
import { Customer, Item, Order, OrderLine, CompanySettings, SyncStats, User, Payment, StockAdjustment } from '../types';
import { supabaseService } from './supabase';
import { jsonToCsv, downloadCsv } from '../utils/csv';
import { generateSKU } from '../utils/skuGenerator';
import SEED_DATA from '../src/config/seed-data.json';
import APP_SETTINGS from '../src/config/app-settings.json';

// Keys for LocalStorage (Legacy / Cache Flags)
const STORAGE_KEYS = {
  INIT: 'fieldaudit_initialized_v8', // Force re-init for V8 (Delivery Tracking)
  LAST_SYNC: 'fieldaudit_last_sync',
  USER: 'fieldaudit_current_user',
  // Legacy keys (will be migrated from)
  LEGACY_CUSTOMERS: 'fieldaudit_customers',
  LEGACY_ITEMS: 'fieldaudit_items',
  LEGACY_ORDERS: 'fieldaudit_orders',
  LEGACY_SETTINGS: 'fieldaudit_settings',
};

// Seed Data
const SEED_CUSTOMERS: Customer[] = (SEED_DATA.customers as any[]).map(c => ({...c, outstanding_balance: 0}));
const SEED_ITEMS: Item[] = SEED_DATA.items as Item[];
const SEED_SETTINGS: CompanySettings = {
    ...(APP_SETTINGS as any),
    auto_sku_enabled: true,
    stock_tracking_enabled: false,
    category_enabled: false,
    show_sku_in_item_cards: false,
    invoice_prefix: 'INV',
    starting_invoice_number: 1
};

// --- Dexie Database Schema ---
class PartFlowDB extends Dexie {
    customers!: Table<Customer, string>;
    items!: Table<Item, string>;
    orders!: Table<Order, string>;
    settings!: Table<CompanySettings, string>;
    stockAdjustments!: Table<StockAdjustment, string>;
    users!: Table<User, string>; // New users table

    constructor() {
        super('PartFlowDB');
        this.version(10).stores({
            customers: 'customer_id, shop_name, sync_status',
            items: 'item_id, item_number, item_display_name, sync_status, status',
            orders: 'order_id, customer_id, order_date, sync_status, payment_status, delivery_status, invoice_number, original_invoice_number, approval_status',
            stockAdjustments: 'adjustment_id, item_id, sync_status',
            settings: 'id',
            users: 'id, username'
        });
    }
}

// Database Service Implementation with In-Memory Cache
class LocalDB {
  private db: PartFlowDB;
  private cache: {
      customers: Customer[];
      items: Item[];
      orders: Order[];
      settings: CompanySettings;
      adjustments: StockAdjustment[];
      users: User[];
  };
  private initialized: boolean = false;

  constructor() {
    this.db = new PartFlowDB();
    // Initialize empty cache
    this.cache = {
        customers: [],
        items: [],
        orders: [],
        settings: {} as CompanySettings,
        adjustments: [],
        users: []
    };
  }

  // --- Initialization ---
  async initialize(): Promise<void> {
      if (this.initialized) return;

      // Check if migration is needed
      const isInitialized = localStorage.getItem(STORAGE_KEYS.INIT);

      if (!isInitialized) {
          await this.migrateOrSeed();
          localStorage.setItem(STORAGE_KEYS.INIT, 'true');
      }

      // Load data from Dexie to Memory Cache
      await this.refreshCache();

      // Migrate existing orders to use order_id as invoice_number
      await this.migrateInvoiceNumbersToOrderIds();

      this.initialized = true;
      console.log("Database initialized and cache loaded.");
  }

  private async migrateOrSeed() {
      // 1. Check for legacy LocalStorage data
      const legCustomers = localStorage.getItem(STORAGE_KEYS.LEGACY_CUSTOMERS);
      const legItems = localStorage.getItem(STORAGE_KEYS.LEGACY_ITEMS);
      const legOrders = localStorage.getItem(STORAGE_KEYS.LEGACY_ORDERS);
      const legSettings = localStorage.getItem(STORAGE_KEYS.LEGACY_SETTINGS);

      let customersToSave = SEED_CUSTOMERS;
      let itemsToSave = SEED_ITEMS;
      let ordersToSave: Order[] = [];
      let settingsToSave = SEED_SETTINGS;

      if (legCustomers) {
          console.log("Migrating Customers from LocalStorage...");
          customersToSave = JSON.parse(legCustomers);
      }
      if (legItems) {
          console.log("Migrating Items from LocalStorage...");
          itemsToSave = JSON.parse(legItems);
      }
      if (legOrders) {
          console.log("Migrating Orders from LocalStorage...");
          ordersToSave = JSON.parse(legOrders);
      }
      if (legSettings) {
          console.log("Migrating Settings from LocalStorage...");
          settingsToSave = JSON.parse(legSettings);
      }

      // Bulk Add to Dexie
      try {
          await this.db.transaction('rw', [this.db.customers, this.db.items, this.db.orders, this.db.settings, this.db.users], async () => {
              // Clear existing to be safe
              await this.db.customers.clear();
              await this.db.items.clear();
              await this.db.orders.clear();
              await this.db.settings.clear();
              await this.db.users.clear();

              // Migration Logic: Ensure new fields exist
              const migratedCustomers = customersToSave.map(c => ({
                  ...c,
                  outstanding_balance: c.outstanding_balance || 0,
                  secondary_discount_rate: c.secondary_discount_rate || 0
              }));

              const migratedOrders = ordersToSave.map(o => ({
                  ...o,
                  paid_amount: o.paid_amount || 0,
                  balance_due: o.balance_due ?? o.net_total,
                  payment_status: o.payment_status || (o.net_total === 0 ? 'paid' : 'unpaid'),
                  payments: o.payments || [],
                  delivery_status: o.delivery_status || 'pending',
                  secondary_discount_rate: o.secondary_discount_rate || 0,
                  secondary_discount_value: o.secondary_discount_value || 0
              }));

              if (migratedCustomers.length > 0) await this.db.customers.bulkPut(migratedCustomers);
              if (itemsToSave.length > 0) await this.db.items.bulkPut(itemsToSave);
              if (migratedOrders.length > 0) await this.db.orders.bulkPut(migratedOrders);

              await this.db.settings.put({ ...settingsToSave, id: 'main' } as any);
          });
      } catch (e) {
          console.error("Migration Error:", e);
          throw new Error("Failed to migrate legacy data. Please clear browser cache and retry.");
      }

      // Clear legacy storage to free up space
      localStorage.removeItem(STORAGE_KEYS.LEGACY_CUSTOMERS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_ITEMS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_ORDERS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_SETTINGS);
  }

  private async refreshCache() {
      const [c, i, o, s, a, u] = await Promise.all([
          this.db.customers.toArray(),
          this.db.items.toArray(),
          this.db.orders.toArray(),
          this.db.settings.get('main'),
          this.db.stockAdjustments.toArray(),
          this.db.users.toArray()
      ]);

      // Migrate existing orders to include approval_status and invoice_number using the new sequential numbering system
      const settings = (s as CompanySettings) || SEED_SETTINGS;
      const migratedOrders = o.map(order => {
          let updatedOrder = { ...order };

          // Set approval_status if not already set
          if (!order.approval_status) {
              updatedOrder = {
                  ...updatedOrder,
                  approval_status: 'approved' // Default to approved for existing orders to maintain current behavior
              };
          }

          // If the order doesn't have an invoice number, we'll keep it as is for now
          // The sequential numbering will be applied when orders are saved going forward
          if (!order.invoice_number) {
              // For existing orders without invoice numbers, we could generate one based on the order date and ID
              // Or we can leave it empty and let it be generated when the order is next saved
              // For now, we'll leave it as is to avoid changing existing data unexpectedly
          }

          // Set original_invoice_number if not already set
          if (!order.original_invoice_number) {
              updatedOrder = {
                  ...updatedOrder,
                  original_invoice_number: order.invoice_number || order.order_id
              };
          }

          return updatedOrder;
      });

      this.cache.customers = c;
      this.cache.items = i;
      this.cache.orders = migratedOrders;
      this.cache.settings = (s as CompanySettings) || SEED_SETTINGS;
      this.cache.adjustments = a;
      this.cache.users = u;
  }

  // --- Customers ---
  getCustomers(): Customer[] {
    return this.cache.customers;
  }

  async saveCustomer(customer: Customer): Promise<void> {
    // Optimistic Update
    const index = this.cache.customers.findIndex(c => c.customer_id === customer.customer_id);
    const customerToSave = { ...customer, sync_status: 'pending' as const, updated_at: new Date().toISOString() };

    if (index >= 0) this.cache.customers[index] = customerToSave;
    else this.cache.customers.push(customerToSave);

    // Async Persist
    await this.db.customers.put(customerToSave);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    const orders = this.cache.orders.filter(o => o.customer_id === customerId);
    if (orders.length > 0) {
        throw new Error("Cannot delete customer with order history. Try disabling them instead.");
    }

    const index = this.cache.customers.findIndex(c => c.customer_id === customerId);
    if (index >= 0) {
        this.cache.customers.splice(index, 1);
        await this.db.customers.delete(customerId);
    }
  }

  // --- Items ---
  getItems(): Item[] {
    return this.cache.items;
  }

  async saveItem(item: Item): Promise<void> {
    const index = this.cache.items.findIndex(i => i.item_id === item.item_id);
    const itemToSave = { ...item, sync_status: 'pending' as const, updated_at: new Date().toISOString() };

    if (index >= 0) this.cache.items[index] = itemToSave;
    else this.cache.items.push(itemToSave);

    await this.db.items.put(itemToSave);
  }

  async deleteItem(itemId: string): Promise<void> {
    const index = this.cache.items.findIndex(i => i.item_id === itemId);
    if (index >= 0) {
      const item = this.cache.items[index];
      item.status = 'inactive';
      item.sync_status = 'pending';
      item.updated_at = new Date().toISOString();
      // Update cache
      this.cache.items[index] = item;
      // Persist
      await this.db.items.put(item);
    }
  }

  // Critical: Used during order confirmation
  async updateStock(itemId: string, qtyDelta: number): Promise<void> {
    const index = this.cache.items.findIndex(i => i.item_id === itemId);
    if (index >= 0) {
      this.cache.items[index].current_stock_qty += qtyDelta;
      this.cache.items[index].sync_status = 'pending';
      this.cache.items[index].updated_at = new Date().toISOString();
      await this.db.items.put(this.cache.items[index]);
    }
  }

  // --- Orders ---
  getOrders(): Order[] {
    return this.cache.orders;
  }

  async saveOrder(order: Order): Promise<void> {
    const index = this.cache.orders.findIndex(o => o.order_id === order.order_id);

    // Auto-calculate payment status if not set
    const paid = order.paid_amount || 0;
    const due = order.net_total - paid;
    const status: any = due <= 0.5 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'); // 0.5 tolerance

    // Ensure the approval status is set properly
    const approvalStatus = order.approval_status || 'draft';

    // For the new sequential invoice numbering system, we need to ensure proper invoice number
    // If the order doesn't have an invoice number yet, we might need to generate one
    // But typically, the invoice number would be set by the UI before saving
    // For existing orders, we should preserve the original order ID to update the correct record
    // The invoice number can change independently of the order ID
    const isExistingOrder = this.cache.orders.some(o => o.order_id === order.order_id);

    const orderToSave = {
        ...order,
        // Always preserve the original order ID for existing orders to ensure we update the correct record
        // For new orders, use the provided order_id (which might be generated by the UI)
        order_id: order.order_id,
        approval_status: approvalStatus, // Ensure approval status is included
        // Update the invoice number as provided by the UI
        invoice_number: order.invoice_number || (isExistingOrder ? order.invoice_number : this.generateNextInvoiceNumber()),
        original_invoice_number: order.original_invoice_number || (isExistingOrder ? order.original_invoice_number || order.invoice_number : order.invoice_number),
        paid_amount: paid,
        balance_due: due,
        payment_status: status,
        delivery_status: order.delivery_status || 'pending',
        sync_status: 'pending' as const,
        updated_at: new Date().toISOString()
    };

    if (index >= 0) this.cache.orders[index] = orderToSave;
    else this.cache.orders.push(orderToSave);

    await this.db.orders.put(orderToSave);

    // Update Customer Balance
    await this.recalcCustomerBalance(order.customer_id);
  }

  /**
   * Generate the next sequential invoice number based on settings
   */
  private generateNextInvoiceNumber(): string {
    const settings = this.cache.settings;
    const prefix = settings.invoice_prefix || 'INV';
    const startingNumber = settings.starting_invoice_number || 1;

    // Find the highest invoice number currently in the system
    const highestNumber = this.findHighestInvoiceNumber();

    // Determine the next number to use
    const nextNumber = highestNumber > 0 ? highestNumber + 1 : startingNumber;

    // Format the number with zero padding (minimum 4 digits)
    const paddedNumber = nextNumber.toString().padStart(4, '0');

    // Combine prefix and padded number
    return `${prefix}${paddedNumber}`;
  }

  /**
   * Find the highest invoice number in the database
   */
  private findHighestInvoiceNumber(): number {
    const orders = this.cache.orders;
    const invoiceNumbers = orders
      .filter(order => order.invoice_number) // Only consider orders with invoice numbers
      .map(order => this.extractInvoiceNumber(order.invoice_number!));

    if (invoiceNumbers.length === 0) {
      return 0;
    }

    return Math.max(...invoiceNumbers);
  }

  /**
   * Extract the numeric part from an invoice number
   */
  private extractInvoiceNumber(invoiceNumber: string): number {
    const match = invoiceNumber.match(/\d+$/);
    if (match) {
      return parseInt(match[0], 10);
    }
    return 0;
  }

  async addPayment(payment: Payment): Promise<void> {
      const orderIndex = this.cache.orders.findIndex(o => o.order_id === payment.order_id);
      if (orderIndex === -1) throw new Error("Order not found");

      const order = this.cache.orders[orderIndex];

      // Add payment
      order.payments = [...(order.payments || []), payment];
      order.paid_amount = order.payments.reduce((sum, p) => sum + p.amount, 0);

      await this.saveOrder(order);
  }

  async updateDeliveryStatus(orderId: string, status: any, notes?: string): Promise<void> {
      const index = this.cache.orders.findIndex(o => o.order_id === orderId);
      if (index === -1) throw new Error("Order not found");

      const order = this.cache.orders[index];
      const oldStatus = order.delivery_status;
      order.delivery_status = status;
      if (notes !== undefined) order.delivery_notes = notes;
      order.updated_at = new Date().toISOString();
      order.sync_status = 'pending';

      // Logical Fix: Restore stock if delivery failed or cancelled
      // only if it wasn't already failed/cancelled (to prevent double restoration)
      if ((status === 'failed' || status === 'cancelled') && (oldStatus !== 'failed' && oldStatus !== 'cancelled')) {
          for (const line of order.lines) {
              await this.updateStock(line.item_id, line.quantity);
          }
      }
      // If moving BACK to an active state, re-deduce stock
      else if ((status !== 'failed' && status !== 'cancelled') && (oldStatus === 'failed' || oldStatus === 'cancelled')) {
          for (const line of order.lines) {
              await this.updateStock(line.item_id, -line.quantity);
          }
      }

      await this.db.orders.put(order);

      // Update Customer Balance (Failed/Cancelled orders removed from balance)
      await this.recalcCustomerBalance(order.customer_id);
  }

  private async recalcCustomerBalance(customerId: string) {
      // Find all unpaid orders for this customer
      // Filter out 'failed' and 'cancelled' delivery statuses as requested
      const orders = this.cache.orders.filter(o =>
          o.customer_id === customerId &&
          o.order_status !== 'draft' &&
          o.delivery_status !== 'failed' &&
          o.delivery_status !== 'cancelled'
      );
      const totalDue = orders.reduce((sum, o) => sum + (o.balance_due || 0), 0);

      const customerIndex = this.cache.customers.findIndex(c => c.customer_id === customerId);
      if (customerIndex >= 0) {
          const customer = this.cache.customers[customerIndex];
          if (customer.outstanding_balance !== totalDue) {
              customer.outstanding_balance = totalDue;
              customer.updated_at = new Date().toISOString();
              customer.sync_status = 'pending';
              await this.db.customers.put(customer);
          }
      }
  }

  async deleteOrder(orderId: string): Promise<void> {
      const index = this.cache.orders.findIndex(o => o.order_id === orderId);

      if (index >= 0) {
          const order = this.cache.orders[index];

          // Restore Stock if order was confirmed
          if (order.order_status === 'confirmed') {
              for (const line of order.lines) {
                  await this.updateStock(line.item_id, line.quantity); // Positive qty to add back
              }
          }

          // Delete from Cache
          this.cache.orders.splice(index, 1);
          // Delete from DB
          await this.db.orders.delete(orderId);
      }
  }

  async addStockAdjustment(adjustment: StockAdjustment): Promise<void> {
      // 1. Save Adjustment Record
      const index = this.cache.adjustments.findIndex(a => a.adjustment_id === adjustment.adjustment_id);
      if (index >= 0) this.cache.adjustments[index] = adjustment;
      else this.cache.adjustments.push(adjustment);
      await this.db.stockAdjustments.put(adjustment);

      // 2. Update Actual Stock
      let qtyDelta = 0;
      if (adjustment.adjustment_type === 'restock' || adjustment.adjustment_type === 'return') {
          qtyDelta = adjustment.quantity;
      } else if (adjustment.adjustment_type === 'damage') {
          qtyDelta = -adjustment.quantity;
      } else if (adjustment.adjustment_type === 'correction') {
          // Correction logic is complex, for simplicity here assuming correction is absolute delta passed by UI
          // If the UI passes the *new* total, we need to calculate delta.
          // For now, let's assume 'correction' passes the signed delta directly, or we avoid 'correction' type for now.
          // Let's treat 'correction' as a direct delta for now (positive or negative)
          qtyDelta = adjustment.quantity;
      }

      await this.updateStock(adjustment.item_id, qtyDelta);
  }

  // --- Settings ---
  getSettings(): CompanySettings {
    return this.cache.settings;
  }

  async saveSettings(settings: CompanySettings): Promise<void> {
    this.cache.settings = settings;
    await this.db.settings.put({ ...settings, id: 'main' } as any);
  }

  // --- Sync Stats (Read from Cache - Fast) ---
  getSyncStats(): SyncStats {
    const last_sync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC) || undefined;
    return {
      pendingCustomers: this.cache.customers.filter(c => c.sync_status === 'pending').length,
      pendingItems: this.cache.items.filter(i => i.sync_status === 'pending').length,
      pendingOrders: this.cache.orders.filter(o => o.sync_status === 'pending').length,
      pendingAdjustments: this.cache.adjustments.filter(a => a.sync_status === 'pending').length,
      last_sync
    };
  }

  // --- Analytics (Read from Cache - Fast) ---
  getDashboardStats() {
    const orders = this.cache.orders;
    const items = this.cache.items;
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const dailySales = orders
        .filter(o =>
            o.order_date === today &&
            o.delivery_status !== 'failed' &&
            o.delivery_status !== 'cancelled'
        )
        .reduce((sum, o) => sum + o.net_total, 0);

    const monthlySales = orders
        .filter(o =>
            o.order_date >= firstOfMonth &&
            o.delivery_status !== 'failed' &&
            o.delivery_status !== 'cancelled'
        )
        .reduce((sum, o) => sum + o.net_total, 0);

    const totalOrders = orders.filter(o =>
        o.delivery_status !== 'failed' &&
        o.delivery_status !== 'cancelled'
    ).length;

    const criticalItems = items.filter(i => i.current_stock_qty <= i.low_stock_threshold);

    return {
        dailySales,
        monthlySales,
        criticalItems: criticalItems.length,
        totalOrders
    };
  }

  // --- Auth (Keep in LocalStorage for now, simple) ---
  getCurrentUser(): User | null {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  }

  login(username: string, password?: string): User | null {
    const found = this.cache.users.find(u => u.username === username);
    if (!found) return null;
    if (password && found.password !== password) return null;

    const user: User = {
        id: found.id,
        username: found.username,
        role: found.role,
        full_name: found.full_name
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  }

  async changePassword(userId: string | number, oldPassword: string, newPassword: string): Promise<void> {
      const user = await this.db.users.get(userId.toString());
      if (!user) throw new Error("User not found");

      if (user.password !== oldPassword) {
          throw new Error("Incorrect old password");
      }

      user.password = newPassword;
      await this.db.users.put(user);

      // Update cache
      const idx = this.cache.users.findIndex(u => u.id === userId);
      if (idx >= 0) this.cache.users[idx].password = newPassword;
  }

  logout() {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  // --- Real Sync Action (Updated to use Supabase) ---
  async performSync(onLog?: (msg: string) => void, mode: 'upsert' | 'overwrite' = 'upsert', onProgress?: (progress: number) => void): Promise<void> {
    const updateProgress = (progress: number) => {
      if (onProgress) onProgress(progress);
    };

    // Create local backup (CSV)
    if (onLog) onLog("Creating local backup (CSV)...");
    updateProgress(5);
    const currentItems = this.getItems();
    const csvData = jsonToCsv(currentItems);
    downloadCsv(csvData, `inventory_backup_${new Date().toISOString().split('T')[0]}.csv`);

    // Use Cache for current state
    const customers = this.getCustomers();
    const pendingCustomers = mode === 'overwrite' ? customers : customers.filter(c => c.sync_status === 'pending');

    const orders = this.getOrders();
    const pendingOrders = orders.filter(o => o.sync_status === 'pending');

    const items = this.getItems();
    const pendingItems = mode === 'overwrite' ? items : items.filter(i => i.sync_status === 'pending');

    const settings = [this.getSettings()];
    const users = this.cache.users;
    const adjustments = this.cache.adjustments.filter(a => a.sync_status === 'pending');

    console.log("DEBUG: Pending Customers for Sync:", pendingCustomers);
    updateProgress(15);

    const result = await supabaseService.syncData(
        pendingCustomers,
        pendingOrders,
        pendingItems,
        settings,
        users,
        adjustments,
        [],
        [],
        mode,
        (p: number) => updateProgress(15 + Math.round(p * 0.5))
    );

    if (onLog && result.logs) {
        result.logs.forEach(onLog);
    }

    if (!result.success) {
        throw new Error(result.message || "Sync failed");
    }

    updateProgress(92);

    // UPDATE STATUSES (Update Cache + DB)
    if (pendingCustomers.length > 0) {
        await this.db.transaction('rw', this.db.customers, async () => {
             pendingCustomers.forEach(c => {
                 c.sync_status = 'synced';
                 this.db.customers.put(c);
                 // Safe way: update cache object directly
                 const cacheIdx = this.cache.customers.findIndex(cx => cx.customer_id === c.customer_id);
                 if(cacheIdx >= 0) this.cache.customers[cacheIdx].sync_status = 'synced';
             });
        });
    }

    if (pendingOrders.length > 0) {
        await this.db.transaction('rw', this.db.orders, async () => {
            pendingOrders.forEach(o => {
                o.sync_status = 'synced';
                this.db.orders.put(o);
                const cacheIdx = this.cache.orders.findIndex(ox => ox.order_id === o.order_id);
                if(cacheIdx >= 0) this.cache.orders[cacheIdx].sync_status = 'synced';
            });
        });
    }

    // FULLY REPLACE INVENTORY FROM PULL
    if (result.pulledItems) {
        if (onLog) onLog(`Replacing local inventory with ${result.pulledItems.length} items from cloud.`);

        // Auto-Generate Missing SKUs (Logic: V5)
        if (this.cache.settings.auto_sku_enabled) {
            const processedItems = result.pulledItems.map(item => {
                // If Item Number is missing or empty, generate it
                if (!item.item_number || item.item_number.trim() === '') {
                    return item;
                }
                return item;
            });

            // Sequential generation to handle duplicates within the batch
            const existingSKUs = new Set<string>(
                result.pulledItems
                    .map(i => i.item_number)
                    .filter(sku => sku && sku.trim() !== '')
            );

            for (let i = 0; i < processedItems.length; i++) {
                const item = processedItems[i];
                if (!item.item_number || item.item_number.trim() === '') {
                    const newSku = generateSKU(item.item_display_name, Array.from(existingSKUs));
                    item.item_number = newSku;
                    item.sync_status = 'pending'; // Mark as pending so it syncs back
                    item.updated_at = new Date().toISOString();
                    existingSKUs.add(newSku); // Add to set for next iterations
                }
            }
            result.pulledItems = processedItems;
        }

        await this.db.transaction('rw', this.db.items, async () => {
             // Conflict Resolution Logic:
             // If we have pending local changes that were NOT pushed (e.g. because of error or partial sync),
             // we need to decide.
             // BUT, performSync puts everything in 'pending' status into the push payload.
             // If push succeeded, status is 'synced'.
             // So if we are here, push succeeded. The only conflicts are if cloud has NEWER data
             // that overwrites our just-pushed data? No, last write wins.
             // REAL CONFLICT: We pulled data BEFORE pushing?
             // The current logic is Push (lines 532) THEN Pull (lines 574).
             // If Push succeeds, local items are 'synced'. Then we blindly overwrite with Cloud.
             // This is safe IF Cloud includes our just-pushed changes.

             // However, for robust Conflict Resolution feature request:
             // We need a mode to PULL FIRST, detect conflicts, then RESOLVE, then PUSH.
             // This method performSync is the "Blind Sync".

             await this.db.items.clear();
             await this.db.items.bulkPut(result.pulledItems!);
        });
        this.cache.items = result.pulledItems;
        updateProgress(94);
    }

    // FULLY REPLACE CUSTOMERS FROM PULL
    if (result.pulledCustomers && result.pulledCustomers.length > 0) {
        if (onLog) onLog(`Updating local shop directory with ${result.pulledCustomers.length} records.`);
        await this.db.transaction('rw', this.db.customers, async () => {
            // Logic: Upsert pulled data (Cloud is source of truth for synced data)
            // But we keep local pending changes if they exist?
            // Better: If user is pulling, they want to sync. For simplicity, match Item replacement.
            await this.db.customers.clear();
            await this.db.customers.bulkPut(result.pulledCustomers!);
        });
        this.cache.customers = result.pulledCustomers;
        updateProgress(96);
    }

    // REPLACE ONLY SYNCED ORDERS FROM PULL, PRESERVE LOCAL DRAFT ORDERS
    if (result.pulledOrders && result.pulledOrders.length > 0) {
        if (onLog) onLog(`Restoring order history: ${result.pulledOrders.length} records found from cloud.`);

        // Get all local orders that should be preserved (not synced OR not approved/pending_approval)
        const localPreservedOrders = this.cache.orders.filter(order =>
            order.sync_status !== 'synced' ||
            order.approval_status === 'draft'
        );

        await this.db.transaction('rw', this.db.orders, async () => {
            // Clear all orders from the database
            await this.db.orders.clear();

            // Add back the cloud orders
            await this.db.orders.bulkPut(result.pulledOrders!);

            // Add back the local orders that should be preserved
            for (const preservedOrder of localPreservedOrders) {
                await this.db.orders.put(preservedOrder);
            }
        });

        // Update cache to include both cloud orders and local preserved orders
        this.cache.orders = [...result.pulledOrders, ...localPreservedOrders];
    }

    // UPDATE SETTINGS FROM PULL
    if (result.pulledSettings) {
        if (onLog) onLog(`Updating local settings from cloud.`);
        await this.db.transaction('rw', this.db.settings, async () => {
            await this.db.settings.clear();
            await this.db.settings.put({ ...result.pulledSettings, id: 'main' } as any);
        });
        this.cache.settings = result.pulledSettings;
    }

    // UPDATE USERS FROM PULL
    if (result.pulledUsers && result.pulledUsers.length > 0) {
        if (onLog) onLog(`Updating local users from cloud.`);
        await this.db.transaction('rw', this.db.users, async () => {
            await this.db.users.clear();
            await this.db.users.bulkPut(result.pulledUsers!);
        });
        this.cache.users = result.pulledUsers;
    }

    // UPDATE STOCK ADJUSTMENTS FROM PULL
    if (result.pulledAdjustments && result.pulledAdjustments.length > 0) {
        if (onLog) onLog(`Updating local stock adjustments from cloud.`);
        await this.db.transaction('rw', this.db.stockAdjustments, async () => {
            await this.db.stockAdjustments.clear();
            await this.db.stockAdjustments.bulkPut(result.pulledAdjustments!);
        });
        this.cache.adjustments = result.pulledAdjustments;
    }

    updateProgress(100);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  // --- Conflict Detection (Updated to use Supabase) ---
  async checkForConflicts(): Promise<{
      hasConflicts: boolean;
      conflicts: any[]; // Typed as ConflictItem[] in UI
      cloudData?: { items: Item[], customers: Customer[], orders: Order[], settings: CompanySettings[], users: User[], adjustments: StockAdjustment[] };
  }> {
      // 1. Pull Cloud Data (without pushing)
      const result = await supabaseService.checkForConflicts({
          customers: this.getCustomers(),
          items: this.getItems(),
          orders: this.getOrders()
      });

      if (!result.success || !result.pulledItems || !result.pulledCustomers) {
          throw new Error("Failed to fetch cloud data for conflict check");
      }

      const conflicts: any[] = [];
      const localItems = this.getItems();
      const localCustomers = this.getCustomers();

      // Check Items
      result.pulledItems.forEach(cloudItem => {
          const localItem = localItems.find(i => i.item_id === cloudItem.item_id);
          if (localItem && localItem.sync_status === 'pending') {
              // Compare content (ignoring metadata)
              const hasDiff =
                  localItem.item_display_name !== cloudItem.item_display_name ||
                  localItem.unit_value !== cloudItem.unit_value ||
                  localItem.current_stock_qty !== cloudItem.current_stock_qty;

              if (hasDiff) {
                  conflicts.push({
                      type: 'item',
                      id: localItem.item_id,
                      local: localItem,
                      cloud: cloudItem
                  });
              }
          }
      });

      // Check Customers
      result.pulledCustomers.forEach(cloudCustomer => {
          const localCustomer = localCustomers.find(c => c.customer_id === cloudCustomer.customer_id);
          if (localCustomer && localCustomer.sync_status === 'pending') {
              const hasDiff =
                  localCustomer.shop_name !== cloudCustomer.shop_name ||
                  localCustomer.outstanding_balance !== cloudCustomer.outstanding_balance;

              if (hasDiff) {
                  conflicts.push({
                      type: 'customer',
                      id: localCustomer.customer_id,
                      local: localCustomer,
                      cloud: cloudCustomer
                  });
              }
          }
      });

      // Check Orders for conflicts based on order_id
      const localOrders = this.getOrders();
      result.pulledOrders?.forEach(cloudOrder => {
          // Look for local orders that have been modified since last sync
          // Only check for conflicts with orders that have been synced
          const localOrder = localOrders.find(o =>
              o.order_id === cloudOrder.order_id &&
              o.sync_status === 'pending' &&
              (o.approval_status === 'approved' || o.approval_status === 'pending_approval')
          );

          if (localOrder) {
              // Check if there are meaningful differences between local and cloud versions
              const hasDiff =
                  localOrder.invoice_number !== cloudOrder.invoice_number ||
                  localOrder.net_total !== cloudOrder.net_total ||
                  localOrder.order_date !== cloudOrder.order_date ||
                  localOrder.order_status !== cloudOrder.order_status;

              if (hasDiff) {
                  conflicts.push({
                      type: 'order',
                      id: localOrder.order_id,
                      local: localOrder,
                      cloud: cloudOrder,
                      identifier: localOrder.invoice_number || localOrder.order_id
                  });
              }
          }
      });

      return {
          hasConflicts: conflicts.length > 0,
          conflicts,
          cloudData: {
              items: result.pulledItems,
              customers: result.pulledCustomers,
              orders: result.pulledOrders || [],
              settings: result.pulledSettings ? [result.pulledSettings] : [],
              users: result.pulledUsers || [],
              adjustments: result.pulledAdjustments || []
          }
      };
  }

  async resolveConflictsAndSync(
      resolutions: { [id: string]: 'local' | 'cloud' },
      cloudData: { items: Item[], customers: Customer[], orders: Order[], settings: CompanySettings[], users: User[], adjustments: StockAdjustment[] }
  ): Promise<void> {
      // 1. Apply Resolutions
      await this.db.transaction('rw', [this.db.items, this.db.customers, this.db.orders], async () => {

          // Apply Item Resolutions
          for (const item of cloudData.items) {
              const resolution = resolutions[item.item_id];
              if (resolution === 'cloud') {
                  // Overwrite local with cloud
                  await this.db.items.put(item);
              } else if (resolution === 'local') {
                  // Keep local (it's already there and pending), do nothing.
                  // It will be pushed in the next step.
              } else {
                  // No conflict, just update (Last Write Wins from Cloud for non-conflicting)
                  const local = this.cache.items.find(i => i.item_id === item.item_id);
                  if (!local || local.sync_status !== 'pending') {
                      await this.db.items.put(item);
                  }
              }
          }

          // Apply Customer Resolutions
          for (const cust of cloudData.customers) {
              const resolution = resolutions[cust.customer_id];
              if (resolution === 'cloud') {
                  await this.db.customers.put(cust);
              } else if (resolution === 'local') {
                  // Keep local
              } else {
                  const local = this.cache.customers.find(c => c.customer_id === cust.customer_id);
                  if (!local || local.sync_status !== 'pending') {
                      await this.db.customers.put(cust);
                  }
              }
          }

          // Apply Order Resolutions
          for (const order of cloudData.orders) {
              const resolution = resolutions[order.order_id];
              if (resolution === 'cloud') {
                  // Overwrite local with cloud
                  // Preserve the original invoice number for sync tracking if this was previously synced
                  const updatedOrder = {
                      ...order,
                      original_invoice_number: order.original_invoice_number || order.invoice_number,
                      sync_status: 'synced' as const
                  };
                  await this.db.orders.put(updatedOrder);
              } else if (resolution === 'local') {
                  // Keep local (it's already there and pending), do nothing.
                  // It will be pushed in the next step.
              } else {
                  // No conflict, just update (Last Write Wins from Cloud for non-conflicting)
                  const local = this.cache.orders.find(o =>
                      o.order_id === order.order_id);
                  if (!local || local.sync_status !== 'pending') {
                      // Preserve the original invoice number for sync tracking
                      const updatedOrder = {
                          ...order,
                          original_invoice_number: order.original_invoice_number || order.invoice_number,
                          sync_status: 'synced' as const
                      };
                      await this.db.orders.put(updatedOrder);
                  }
              }
          }
      });

      // 2. Refresh Cache
      await this.refreshCache();

      // 3. Perform Normal Sync (Push pending)
      await this.performSync();
  }

  /**
   * Resolve order conflicts specifically using the order_id
   */
  async resolveOrderConflictsAndSync(
    resolutions: { [identifier: string]: 'local' | 'cloud' | 'merge' },
    resolvedOrders: Order[]
  ): Promise<void> {
    // Apply resolved orders based on user selections
    await this.db.transaction('rw', this.db.orders, async () => {
      for (const order of resolvedOrders) {
        // Preserve the original invoice number for sync tracking
        const updatedOrder = {
          ...order,
          original_invoice_number: order.original_invoice_number || order.invoice_number,
          sync_status: 'synced' as const
        };

        // Update the order in the database
        await this.db.orders.put(updatedOrder);

        // Update the cache
        const cacheIndex = this.cache.orders.findIndex(o => o.order_id === order.order_id);
        if (cacheIndex !== -1) {
          this.cache.orders[cacheIndex] = updatedOrder;
        } else {
          this.cache.orders.push(updatedOrder);
        }
      }
    });

    // Refresh cache to ensure consistency
    await this.refreshCache();

    // Perform sync to push any pending changes
    await this.performSync();
  }

  /**
   * Migrate existing orders to use order_id as invoice_number
   */
  async migrateInvoiceNumbersToOrderIds(): Promise<void> {
    const allOrders = this.getOrders();

    // Update each order to have invoice_number equal to order_id
    for (const order of allOrders) {
      const updatedOrder = {
        ...order,
        invoice_number: order.order_id,
        original_invoice_number: order.original_invoice_number || order.invoice_number
      };

      await this.db.orders.put(updatedOrder);
    }

    // Refresh cache to reflect changes
    await this.refreshCache();
  }
}
export const db = new LocalDB();