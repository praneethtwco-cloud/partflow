import Dexie, { Table } from 'dexie';
import { Customer, Item, Order, OrderLine, CompanySettings, SyncStats, User, Payment, StockAdjustment, RoutePlanEntry, VisitEntry, MonthlyTarget } from '../types';
import { supabaseService } from './supabase';
import { supabaseSyncService } from './supabase-sync-service';
import { jsonToCsv, downloadCsv } from '../utils/csv';
import { generateSKU } from '../utils/skuGenerator';
import { connectionService } from './connection';
import { syncQueueService } from './sync-queue';
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
const SEED_CUSTOMERS: Customer[] = (SEED_DATA.customers as Omit<Customer, 'outstanding_balance'>[]).map(c => ({...c, outstanding_balance: 0}));
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
    users!: Table<User, string>;
    routePlans!: Table<RoutePlanEntry, string>;
    visits!: Table<VisitEntry, string>;
    targets!: Table<MonthlyTarget, string>;

    constructor() {
        super('PartFlowDB');
        this.version(13).stores({
            customers: 'customer_id, shop_name, sync_status, city, discount_1, discount_2, balance, last_updated',
            items: 'item_id, item_number, item_display_name, sync_status, status, internal_name, last_updated',
            orders: 'order_id, customer_id, order_date, sync_status, payment_status, delivery_status, invoice_number, original_invoice_number, approval_status, disc_1_rate, disc_1_value, disc_2_rate, disc_2_value, paid, status, last_updated',
            stockAdjustments: 'adjustment_id, item_id, sync_status',
            settings: 'id',
            users: 'id, username',
            routePlans: 'id, customer_id, route_date, sync_status',
            visits: 'id, customer_id, route_date, status, sync_status',
            targets: 'id, year, month, status, sync_status'
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
      routePlans: RoutePlanEntry[];
      visits: VisitEntry[];
      targets: MonthlyTarget[];
  };
  private initialized: boolean = false;
  private isOnline: boolean = true;

  constructor() {
    this.db = new PartFlowDB();
    // Initialize empty cache
    this.cache = {
        customers: [],
        items: [],
        orders: [],
        settings: {} as CompanySettings,
        adjustments: [],
        users: [],
        routePlans: [],
        visits: [],
        targets: []
    };
  }

  // --- Initialization ---
  async initialize(): Promise<void> {
      if (this.initialized) return;
      this.initialized = true;

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

      // Subscribe to connection status changes
      connectionService.subscribe(this.handleConnectionChange);

      console.log("Database initialized and cache loaded.");
  }

  private handleConnectionChange = (isOnline: boolean): void => {
    this.isOnline = isOnline;
    console.log(`Connection status changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

    // If we're back online and have queued operations, initiate sync
    if (isOnline && !syncQueueService.isEmpty()) {
      console.log(`Attempting to sync ${syncQueueService.length()} queued operations`);
      // Trigger a sync to process queued operations
      setTimeout(async () => {
        try {
          await this.performSync();
        } catch (err) {
          console.error('Error syncing queued operations:', err);
        }
      }, 1000); // Delay slightly to ensure connection is stable
    }
    
    // Process the new Supabase sync queue when coming online
    if (isOnline && !supabaseSyncService.isQueueEmpty()) {
      console.log(`Attempting to process ${supabaseSyncService.getQueueLength()} operations from Supabase sync queue`);
      setTimeout(async () => {
        try {
          await supabaseSyncService.processQueuedOperations();
        } catch (err) {
          console.error('Error processing Supabase queued operations:', err);
        }
      }, 1500); // Slightly longer delay to ensure connection stability
    }
  };

  private async migrateOrSeed(): Promise<void> {
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

  private async refreshCache(): Promise<void> {
      const [c, i, o, s, a, u, rp, v, t] = await Promise.all([
          this.db.customers.toArray(),
          this.db.items.toArray(),
          this.db.orders.toArray(),
          this.db.settings.get('main'),
          this.db.stockAdjustments.toArray(),
          this.db.users.toArray(),
          this.db.routePlans.toArray(),
          this.db.visits.toArray(),
          this.db.targets.toArray()
      ]);

      // Migrate existing customers to include new CSV-compatible fields
      const migratedCustomers = c.map(customer => {
          let updatedCustomer = { ...customer };

          // Add missing fields for CSV compatibility
          if (!updatedCustomer.city) {
              updatedCustomer = {
                  ...updatedCustomer,
                  city: updatedCustomer.city_ref || ''
              };
          }

          if (updatedCustomer.discount_rate !== undefined && updatedCustomer.discount_1 === undefined) {
              updatedCustomer = {
                  ...updatedCustomer,
                  discount_1: updatedCustomer.discount_rate
              };
          }

          if (updatedCustomer.secondary_discount_rate !== undefined && updatedCustomer.discount_2 === undefined) {
              updatedCustomer = {
                  ...updatedCustomer,
                  discount_2: updatedCustomer.secondary_discount_rate
              };
          }

          if (updatedCustomer.outstanding_balance !== undefined && updatedCustomer.balance === undefined) {
              updatedCustomer = {
                  ...updatedCustomer,
                  balance: updatedCustomer.outstanding_balance
              };
          }

          if (!updatedCustomer.last_updated) {
              updatedCustomer = {
                  ...updatedCustomer,
                  last_updated: updatedCustomer.updated_at
              };
          }

          return updatedCustomer;
      });

      // Migrate existing items to include new CSV-compatible fields
      const migratedItems = i.map(item => {
          let updatedItem = { ...item };

          // Add missing fields for CSV compatibility
          if (!updatedItem.internal_name) {
              updatedItem = {
                  ...updatedItem,
                  internal_name: updatedItem.item_name || ''
              };
          }

          if (!updatedItem.last_updated) {
              updatedItem = {
                  ...updatedItem,
                  last_updated: updatedItem.updated_at
              };
          }

          return updatedItem;
      });

      // Migrate existing orders to include new CSV-compatible fields and approval_status
      const settings = (s as CompanySettings) || SEED_SETTINGS;
      const migratedOrders = o.map(order => {
          let updatedOrder = { ...order };

          // Add missing fields for CSV compatibility
          if (updatedOrder.discount_rate !== undefined && updatedOrder.disc_1_rate === undefined) {
              updatedOrder = {
                  ...updatedOrder,
                  disc_1_rate: updatedOrder.discount_rate
              };
          }

          if (updatedOrder.discount_value !== undefined && updatedOrder.disc_1_value === undefined) {
              updatedOrder = {
                  ...updatedOrder,
                  disc_1_value: updatedOrder.discount_value
              };
          }

          if (updatedOrder.secondary_discount_rate !== undefined && updatedOrder.disc_2_rate === undefined) {
              updatedOrder = {
                  ...updatedOrder,
                  disc_2_rate: updatedOrder.secondary_discount_rate
              };
          }

          if (updatedOrder.secondary_discount_value !== undefined && updatedOrder.disc_2_value === undefined) {
              updatedOrder = {
                  ...updatedOrder,
                  disc_2_value: updatedOrder.secondary_discount_value
              };
          }

          if (updatedOrder.paid_amount !== undefined && updatedOrder.paid === undefined) {
              updatedOrder = {
                  ...updatedOrder,
                  paid: updatedOrder.paid_amount
              };
          }

          if (!updatedOrder.status) {
              updatedOrder = {
                  ...updatedOrder,
                  status: updatedOrder.order_status || 'draft'
              };
          }

          if (!updatedOrder.last_updated) {
              updatedOrder = {
                  ...updatedOrder,
                  last_updated: updatedOrder.updated_at
              };
          }

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

      this.cache.customers = migratedCustomers;
      this.cache.items = migratedItems;
      this.cache.orders = migratedOrders;
      this.cache.settings = (s as CompanySettings) || SEED_SETTINGS;
      this.cache.adjustments = a;
      this.cache.users = u;
      this.cache.routePlans = rp || [];
      this.cache.visits = v || [];
      this.cache.targets = t || [];
  }

  // --- Customers ---
  getCustomers(): Customer[] {
    return this.cache.customers;
  }

  async saveCustomer(customer: Customer): Promise<void> {
    // Optimistic Update
    const index = this.cache.customers.findIndex(c => c.customer_id === customer.customer_id);
    
    // Ensure all CSV-compatible fields are properly set
    const customerToSave = { 
      ...customer, 
      sync_status: 'pending' as const, 
      updated_at: new Date().toISOString(),
      last_updated: new Date().toISOString(), // Add last_updated for CSV compatibility
      city: customer.city || customer.city_ref, // Ensure city field is populated
      discount_1: customer.discount_1 !== undefined ? customer.discount_1 : customer.discount_rate,
      discount_2: customer.discount_2 !== undefined ? customer.discount_2 : customer.secondary_discount_rate,
      balance: customer.balance !== undefined ? customer.balance : customer.outstanding_balance
    };

    if (index >= 0) this.cache.customers[index] = customerToSave;
    else this.cache.customers.push(customerToSave);

    // Async Persist
    await this.db.customers.put(customerToSave);

    // Queue sync operation and keep CRUD fast (manual sync will push to Supabase)
    syncQueueService.enqueue({
      id: customer.customer_id,
      entity: 'customer',
      operation: index >= 0 ? 'update' : 'create',
      data: customerToSave
    });

    supabaseSyncService.enqueue({
      id: customer.customer_id,
      entity: 'customer',
      operation: index >= 0 ? 'update' : 'create',
      data: customerToSave
    });
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
    
    // Ensure all CSV-compatible fields are properly set
    const itemToSave = { 
      ...item, 
      sync_status: 'pending' as const, 
      updated_at: new Date().toISOString(),
      last_updated: new Date().toISOString(), // Add last_updated for CSV compatibility
      internal_name: item.internal_name || item.item_name // Ensure internal_name is populated
    };

    if (index >= 0) this.cache.items[index] = itemToSave;
    else this.cache.items.push(itemToSave);

    await this.db.items.put(itemToSave);

    // Queue sync operation and keep CRUD fast (manual sync will push to Supabase)
    syncQueueService.enqueue({
      id: item.item_id,
      entity: 'item',
      operation: index >= 0 ? 'update' : 'create',
      data: itemToSave
    });

    supabaseSyncService.enqueue({
      id: item.item_id,
      entity: 'item',
      operation: index >= 0 ? 'update' : 'create',
      data: itemToSave
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    const index = this.cache.items.findIndex(i => i.item_id === itemId);
    if (index >= 0) {
      const item = this.cache.items[index];
      item.status = 'inactive';
      item.sync_status = 'pending';
      item.updated_at = new Date().toISOString();
      item.last_updated = new Date().toISOString(); // Update last_updated for CSV compatibility
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
      this.cache.items[index].last_updated = new Date().toISOString(); // Update last_updated for CSV compatibility
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
        updated_at: new Date().toISOString(),
        // Add CSV-compatible fields
        disc_1_rate: order.disc_1_rate !== undefined ? order.disc_1_rate : order.discount_rate,
        disc_1_value: order.disc_1_value !== undefined ? order.disc_1_value : order.discount_value,
        disc_2_rate: order.disc_2_rate !== undefined ? order.disc_2_rate : order.secondary_discount_rate,
        disc_2_value: order.disc_2_value !== undefined ? order.disc_2_value : order.secondary_discount_value,
        paid: order.paid !== undefined ? order.paid : paid,
        status: order.status || order.order_status || 'draft',
        last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
    };

    if (index >= 0) this.cache.orders[index] = orderToSave;
    else this.cache.orders.push(orderToSave);

    await this.db.orders.put(orderToSave);

    // Queue sync operation and keep CRUD fast (manual sync will push to Supabase)
    syncQueueService.enqueue({
      id: order.order_id,
      entity: 'order',
      operation: index >= 0 ? 'update' : 'create',
      data: orderToSave
    });

    supabaseSyncService.enqueue({
      id: order.order_id,
      entity: 'order',
      operation: index >= 0 ? 'update' : 'create',
      data: orderToSave
    });

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
      order.paid = order.paid_amount; // Update paid for CSV compatibility

      await this.saveOrder(order);
  }

  async updateDeliveryStatus(orderId: string, status: any, notes?: string, deliveryDate?: string): Promise<void> {
      const index = this.cache.orders.findIndex(o => o.order_id === orderId);
      if (index === -1) throw new Error("Order not found");

      const order = this.cache.orders[index];
      const oldStatus = order.delivery_status;
      order.delivery_status = status;
      if (notes !== undefined) order.delivery_notes = notes;
      if (deliveryDate !== undefined) order.delivery_date = deliveryDate;
      else order.delivery_date = new Date().toISOString();
      order.updated_at = new Date().toISOString();
      order.last_updated = new Date().toISOString(); // Update last_updated for CSV compatibility
      order.sync_status = 'pending';

      // Logical Fix: Restore stock if delivery failed or cancelled
      // only if it wasn't already failed/cancelled (to prevent double restoration)
      if (this.cache.settings.stock_tracking_enabled && order.order_status === 'confirmed') {
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
      }

      await this.db.orders.put(order);

      // Update Customer Balance (Failed/Cancelled orders removed from balance)
      await this.recalcCustomerBalance(order.customer_id);
  }

  private async recalcCustomerBalance(customerId: string): Promise<void> {
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
              customer.balance = totalDue; // Update balance for CSV compatibility
              customer.updated_at = new Date().toISOString();
              customer.last_updated = new Date().toISOString(); // Update last_updated for CSV compatibility
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

  // --- Stock Adjustments ---
  getStockAdjustments(): StockAdjustment[] {
    return this.cache.adjustments;
  }

  async addStockAdjustment(adjustment: StockAdjustment): Promise<void> {
      // 1. Save Adjustment Record
      const index = this.cache.adjustments.findIndex(a => a.adjustment_id === adjustment.adjustment_id);
      const adjustmentToSave = { 
        ...adjustment, 
        sync_status: 'pending' as const, 
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
      };

      if (index >= 0) this.cache.adjustments[index] = adjustmentToSave;
      else this.cache.adjustments.push(adjustmentToSave);

      await this.db.stockAdjustments.put(adjustmentToSave);

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

      // If offline, add to sync queue
      if (!this.isOnline) {
        syncQueueService.enqueue({
          id: adjustment.adjustment_id,
          entity: 'adjustment',
          operation: index >= 0 ? 'update' : 'create',
          data: adjustmentToSave
        });

        // Also add to the new Supabase sync queue
        supabaseSyncService.enqueue({
          id: adjustment.adjustment_id,
          entity: 'adjustment',
          operation: index >= 0 ? 'update' : 'create',
          data: adjustmentToSave
        });
      } else {
        // If online, attempt to sync immediately
        try {
          // Check if user is authenticated before syncing
          const { data: { session } } = await supabaseService.getCurrentUser();
          if (!session) {
            // If not authenticated, add to queue for later sync
            supabaseSyncService.enqueue({
              id: adjustment.adjustment_id,
              entity: 'adjustment',
              operation: index >= 0 ? 'update' : 'create',
              data: adjustmentToSave
            });
            return; // Exit early, will sync when authenticated
          }

          const result = await supabaseService.syncData(
            [],
            [],
            [],
            [],
            [],
            [adjustmentToSave],
            [],
            [],
            'upsert'
          );
          
          if (result.success) {
            // Update sync status to 'synced'
            const updatedAdjustment = { 
              ...adjustmentToSave, 
              sync_status: 'synced' as const,
              last_updated: new Date().toISOString() // Update last_updated for CSV compatibility
            };
            await this.db.stockAdjustments.put(updatedAdjustment);
            const cacheIndex = this.cache.adjustments.findIndex(a => a.adjustment_id === adjustment.adjustment_id);
            if (cacheIndex >= 0) {
              this.cache.adjustments[cacheIndex] = updatedAdjustment;
            }
            console.log(`Successfully synced adjustment ${adjustment.adjustment_id} to Supabase`);
          } else {
            console.error('Failed to sync adjustment to Supabase:', result.message);
            // If sync fails, add to queue for later
            supabaseSyncService.enqueue({
              id: adjustment.adjustment_id,
              entity: 'adjustment',
              operation: index >= 0 ? 'update' : 'create',
              data: adjustmentToSave
            });
          }
        } catch (error) {
          console.error('Error syncing adjustment immediately:', error);
          // If immediate sync fails, add to queue for later
          supabaseSyncService.enqueue({
            id: adjustment.adjustment_id,
            entity: 'adjustment',
            operation: index >= 0 ? 'update' : 'create',
            data: adjustmentToSave
          });
        }
      }
  }

  // --- Clear All Data ---
  async clearAllData(): Promise<void> {
    await this.db.transaction('rw', [
      this.db.customers,
      this.db.items,
      this.db.orders,
      this.db.settings,
      this.db.stockAdjustments,
      this.db.users
    ], async () => {
      await this.db.customers.clear();
      await this.db.items.clear();
      await this.db.orders.clear();
      await this.db.settings.clear();
      await this.db.stockAdjustments.clear();
      await this.db.users.clear();
    });

    // Reset cache to defaults
    this.cache = {
      customers: [],
      items: [],
      orders: [],
      settings: {
        company_name: '',
        address: '',
        phone: '',
        rep_name: '',
        invoice_prefix: 'INV',
        starting_invoice_number: 1,
        footer_note: 'Thank you for your business. Goods once sold cannot be returned.',
        currency_symbol: 'Rs.',
        auto_sku_enabled: true,
        stock_tracking_enabled: false,
        category_enabled: false,
        show_sku_in_item_cards: false,
        show_advanced_sync_options: false
      },
      adjustments: [],
      users: [],
      routePlans: [],
      visits: [],
      targets: []
    };
  }

  // --- Settings ---
  getSettings(): CompanySettings {
    return this.cache.settings;
  }

  async saveSettings(settings: CompanySettings): Promise<void> {
    this.cache.settings = settings;
    const settingsToSave = { 
      ...settings, 
      id: 'main',
      updated_at: new Date().toISOString(),
      last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
    };
    await this.db.settings.put(settingsToSave as any);

    // If offline, add to sync queue
    if (!this.isOnline) {
      syncQueueService.enqueue({
        id: 'settings',
        entity: 'settings',
        operation: 'update',
        data: settingsToSave
      });

      // Also add to the new Supabase sync queue
      supabaseSyncService.enqueue({
        id: 'settings',
        entity: 'settings',
        operation: 'update',
        data: settingsToSave
      });
    } else {
      // If online, attempt to sync immediately
      try {
        // Check if user is authenticated before syncing
        const { data: { session } } = await supabaseService.getCurrentUser();
        if (!session) {
          // If not authenticated, add to queue for later sync
          supabaseSyncService.enqueue({
            id: 'settings',
            entity: 'settings',
            operation: 'update',
            data: settingsToSave
          });
          return; // Exit early, will sync when authenticated
        }

        await supabaseService.syncData(
          [],
          [],
          [],
          [settingsToSave],
          [],
          [],
          [],
          [],
          'upsert'
        );
        // Update sync status to 'synced'
        const updatedSettings = { ...settingsToSave, sync_status: 'synced' as const } as any;
        await this.db.settings.put(updatedSettings);
        this.cache.settings = { ...settingsToSave, sync_status: 'synced' as const };
      } catch (error) {
        console.error('Error syncing settings immediately:', error);
        // If immediate sync fails, add to queue for later
        supabaseSyncService.enqueue({
          id: 'settings',
          entity: 'settings',
          operation: 'update',
          data: settingsToSave
        });
      }
    }
  }

  // --- Route Plans ---
  getRoutePlans(): RoutePlanEntry[] {
    return this.cache.routePlans;
  }

  async saveRoutePlans(plans: RoutePlanEntry[]): Promise<void> {
    const plansWithSync = plans.map(p => ({
      ...p,
      sync_status: 'pending' as const,
      last_updated: new Date().toISOString()
    }));
    this.cache.routePlans = plansWithSync;
    await this.db.routePlans.clear();
    await this.db.routePlans.bulkPut(plansWithSync);
  }

  // --- Visits ---
  getVisits(): VisitEntry[] {
    return this.cache.visits;
  }

  async saveVisits(visits: VisitEntry[]): Promise<void> {
    const visitsWithSync = visits.map(v => ({
      ...v,
      sync_status: 'pending' as const,
      last_updated: new Date().toISOString()
    }));
    this.cache.visits = visitsWithSync;
    await this.db.visits.clear();
    await this.db.visits.bulkPut(visitsWithSync);
  }

  // --- Targets ---
  getTargets(): MonthlyTarget[] {
    return this.cache.targets;
  }

  getTarget(year: number, month: number): MonthlyTarget | undefined {
    return this.cache.targets.find(t => t.year === year && t.month === month);
  }

  getAllTargets(): MonthlyTarget[] {
    return this.cache.targets.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }

  async saveTarget(target: MonthlyTarget): Promise<void> {
    const targetWithSync = {
      ...target,
      sync_status: 'pending' as const,
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const existingIndex = this.cache.targets.findIndex(t => t.id === target.id);
    if (existingIndex >= 0) {
      this.cache.targets[existingIndex] = targetWithSync;
    } else {
      this.cache.targets.push(targetWithSync);
    }
    
    await this.db.targets.put(targetWithSync);
  }

  async lockTarget(targetId: string): Promise<void> {
    const target = this.cache.targets.find(t => t.id === targetId);
    if (target) {
      target.status = 'locked';
      target.locked_at = new Date().toISOString();
      target.sync_status = 'pending';
      await this.db.targets.put(target);
    }
  }

  async deleteTarget(targetId: string): Promise<void> {
    this.cache.targets = this.cache.targets.filter(t => t.id !== targetId);
    await this.db.targets.delete(targetId);
  }

  getSalesHistoryForTarget(months: number = 12): { year: number; month: number; total: number }[] {
    const history: { year: number; month: number; total: number }[] = [];
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const monthOrders = this.cache.orders.filter(o => {
        const orderDate = new Date(o.order_date);
        return orderDate.getFullYear() === year && 
               orderDate.getMonth() + 1 === month &&
               (o.approval_status === 'approved' || o.approval_status === 'pending_approval');
      });
      
      const total = monthOrders.reduce((sum, o) => sum + (o.net_total || 0), 0);
      history.push({ year, month, total });
    }
    
    return history.reverse();
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
  getDashboardStats(): { dailySales: number; monthlySales: number; criticalItems: number; totalOrders: number; monthlyOrders: number; totalCustomers: number; totalItems: number; } {
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

    const monthlyOrders = orders.filter(o => 
        o.order_date >= firstOfMonth &&
        o.delivery_status !== 'failed' && 
        o.delivery_status !== 'cancelled'
    ).length;

    const criticalItems = items.filter(i => i.current_stock_qty <= i.low_stock_threshold);

    return {
        dailySales,
        monthlySales,
        criticalItems: criticalItems.length,
        totalOrders,
        monthlyOrders,
        totalCustomers: this.cache.customers.length,
        totalItems: this.cache.items.length
    };
  }

  async reloadCache(): Promise<void> {
    await this.refreshCache();
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

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  // --- Real Sync Action ---
  async performSync(onLog?: (msg: string) => void, mode: 'upsert' | 'overwrite' = 'upsert', onProgress?: (progress: number) => void): Promise<void> {
    const updateProgress = (progress: number) => {
      if (onProgress) onProgress(progress);
    };

    // Process any queued operations first
    if (!syncQueueService.isEmpty()) {
      if (onLog) onLog(`Processing ${syncQueueService.length()} queued operations from offline period...`);
      
      // Process the queue
      await this.processSyncQueue(onLog);
    }
    updateProgress(5);

    // Create local backup (CSV)
    if (onLog) onLog("Creating local backup (CSV)...");
    updateProgress(10);
    const currentItems = this.getItems();
    const csvData = jsonToCsv(currentItems);
    downloadCsv(csvData, `inventory_backup_${new Date().toISOString().split('T')[0]}.csv`);

    // Use Cache for current state
    const customers = this.getCustomers();
    const pendingCustomers = mode === 'overwrite' ? customers : customers.filter(c => c.sync_status === 'pending');

    const orders = this.getOrders();
    const pendingOrders = mode === 'overwrite' ? orders : orders.filter(o => o.sync_status === 'pending');

    const items = this.getItems();
    const pendingItems = mode === 'overwrite' ? items : items.filter(i => i.sync_status === 'pending');

    const settings = [this.getSettings()];
    const users = this.cache.users;
    const adjustments = mode === 'overwrite' ? this.cache.adjustments : this.cache.adjustments.filter(a => a.sync_status === 'pending');
    const routePlans = this.cache.routePlans;
    const visits = this.cache.visits;

    const result = await supabaseService.syncData(
        pendingCustomers,
        pendingOrders,
        pendingItems,
        settings,
        users,
        adjustments,
        routePlans,
        visits,
        mode
    );

    if (onLog && result.logs) {
        result.logs.forEach(onLog);
    }

    if (!result.success) {
        throw new Error(result.message || "Sync failed");
    }

    updateProgress(75);

    // UPDATE STATUSES (Update Cache + DB)
    if (pendingCustomers.length > 0) {
        await this.db.transaction('rw', this.db.customers, async () => {
             for (const c of pendingCustomers) {
                 c.sync_status = 'synced';
                 c.last_updated = new Date().toISOString();
                 await this.db.customers.put(c);
                 // Update cache
                 const cacheIdx = this.cache.customers.findIndex(cx => cx.customer_id === c.customer_id);
                 if(cacheIdx >= 0) {
                   this.cache.customers[cacheIdx].sync_status = 'synced';
                   this.cache.customers[cacheIdx].last_updated = c.last_updated;
                 }
             }
        });
    }

    if (pendingOrders.length > 0) {
        await this.db.transaction('rw', this.db.orders, async () => {
            for (const o of pendingOrders) {
                o.sync_status = 'synced';
                o.last_updated = new Date().toISOString();
                await this.db.orders.put(o);
                const cacheIdx = this.cache.orders.findIndex(ox => ox.order_id === o.order_id);
                if(cacheIdx >= 0) {
                  this.cache.orders[cacheIdx].sync_status = 'synced';
                  this.cache.orders[cacheIdx].last_updated = o.last_updated;
                }
            }
        });
    }

    // UPDATE ITEMS STATUSES
    if (pendingItems.length > 0) {
        await this.db.transaction('rw', this.db.items, async () => {
            for (const i of pendingItems) {
                i.sync_status = 'synced';
                i.last_updated = new Date().toISOString();
                await this.db.items.put(i);
                const cacheIdx = this.cache.items.findIndex(ix => ix.item_id === i.item_id);
                if(cacheIdx >= 0) {
                  this.cache.items[cacheIdx].sync_status = 'synced';
                  this.cache.items[cacheIdx].last_updated = i.last_updated;
                }
            }
        });
    }

    // UPDATE ADJUSTMENTS STATUSES
    if (adjustments.length > 0) {
        await this.db.transaction('rw', this.db.stockAdjustments, async () => {
            for (const a of adjustments) {
                a.sync_status = 'synced';
                a.last_updated = new Date().toISOString();
                await this.db.stockAdjustments.put(a);
                const cacheIdx = this.cache.adjustments.findIndex(ax => ax.adjustment_id === a.adjustment_id);
                if(cacheIdx >= 0) {
                  this.cache.adjustments[cacheIdx].sync_status = 'synced';
                  this.cache.adjustments[cacheIdx].last_updated = a.last_updated;
                }
            }
        });
    }

    // FULLY REPLACE INVENTORY FROM PULL
    if (result.pulledItems) {
        if (onLog) onLog(`Replacing local inventory with ${result.pulledItems.length} items from cloud.`);
        
        // Auto-Generate Missing SKUs (Logic: V5)
        if (settings.auto_sku_enabled) {
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

        // Merge pulled items with local pending items
        // Don't clear the database - only update synced items and add new ones
        const processedItems = result.pulledItems!.map(item => ({
          ...item,
          sync_status: 'synced' as const,
          last_updated: item.last_updated || item.updated_at || new Date().toISOString(),
          internal_name: item.internal_name || item.item_name || ''
        }));

        await this.db.transaction('rw', this.db.items, async () => {
             // Upsert each pulled item (update if exists, add if new)
             for (const item of processedItems) {
               await this.db.items.put(item);
             }
        });
        
        // Update cache: merge pulled items with local pending items
        const localPendingItems = this.cache.items.filter(i => i.sync_status === 'pending');
        this.cache.items = [...processedItems, ...localPendingItems];
        updateProgress(82);
    }

    // FULLY REPLACE CUSTOMERS FROM PULL
    if (result.pulledCustomers && result.pulledCustomers.length > 0) {
        if (onLog) onLog(`Updating local shop directory with ${result.pulledCustomers.length} records.`);
        
        // Ensure new fields are properly set for pulled customers
        const processedCustomers = result.pulledCustomers!.map(customer => ({
          ...customer,
          sync_status: 'synced' as const,
          last_updated: customer.last_updated || customer.updated_at || new Date().toISOString(),
          city: customer.city || customer.city_ref || '',
          discount_1: customer.discount_1 !== undefined ? customer.discount_1 : customer.discount_rate,
          discount_2: customer.discount_2 !== undefined ? customer.discount_2 : customer.secondary_discount_rate,
          balance: customer.balance !== undefined ? customer.balance : customer.outstanding_balance
        }));
        
        await this.db.transaction('rw', this.db.customers, async () => {
            // Upsert each pulled customer (don't clear - preserve pending customers)
            for (const customer of processedCustomers) {
              await this.db.customers.put(customer);
            }
        });
        
        // Update cache: merge pulled customers with local pending customers
        const localPendingCustomers = this.cache.customers.filter(c => c.sync_status === 'pending');
        this.cache.customers = [...processedCustomers, ...localPendingCustomers];
        updateProgress(88);
    }

    // REPLACE ONLY SYNCED ORDERS FROM PULL, PRESERVE LOCAL DRAFT ORDERS
    if (result.pulledOrders && result.pulledOrders.length > 0) {
        if (onLog) onLog(`Restoring order history: ${result.pulledOrders.length} records found from cloud.`);

        // Get all local orders that should be preserved (not synced OR not approved/pending_approval)
        const localPreservedOrders = this.cache.orders.filter(order =>
            order.sync_status !== 'synced' ||
            order.approval_status === 'draft'
        );

        // Process cloud orders to ensure new fields are properly set
        const processedCloudOrders = result.pulledOrders!.map(order => ({
          ...order,
          sync_status: 'synced' as const,
          last_updated: order.last_updated || order.updated_at || new Date().toISOString(),
          disc_1_rate: order.disc_1_rate !== undefined ? order.disc_1_rate : order.discount_rate,
          disc_1_value: order.disc_1_value !== undefined ? order.disc_1_value : order.discount_value,
          disc_2_rate: order.disc_2_rate !== undefined ? order.disc_2_rate : order.secondary_discount_rate,
          disc_2_value: order.disc_2_value !== undefined ? order.disc_2_value : order.secondary_discount_value,
          paid: order.paid !== undefined ? order.paid : order.paid_amount,
          status: order.status || order.order_status || 'draft'
        }));

        await this.db.transaction('rw', this.db.orders, async () => {
            // Clear all orders from the database
            await this.db.orders.clear();

            // Add back the cloud orders
            await this.db.orders.bulkPut(processedCloudOrders);

            // Add back the local orders that should be preserved
            for (const preservedOrder of localPreservedOrders) {
                await this.db.orders.put(preservedOrder);
            }
        });

        // Update cache to include both cloud orders and local preserved orders
        this.cache.orders = [...processedCloudOrders, ...localPreservedOrders];
    }

    // UPDATE SETTINGS FROM PULL
    if (result.pulledSettings) {
        if (onLog) onLog(`Updating local settings from cloud.`);
        await this.db.transaction('rw', this.db.settings, async () => {
            const processedSettings = {
              ...result.pulledSettings,
              id: 'main',
              last_updated: result.pulledSettings.last_updated || result.pulledSettings.updated_at || new Date().toISOString() // Ensure last_updated for CSV compatibility
            };
            await this.db.settings.clear();
            await this.db.settings.put(processedSettings as any);
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
        // Process adjustments before transaction
        const processedAdjustments = result.pulledAdjustments!.map(adj => ({
          ...adj,
          sync_status: 'synced' as const,
          last_updated: adj.last_updated || adj.updated_at || new Date().toISOString()
        }));
        
        await this.db.transaction('rw', this.db.stockAdjustments, async () => {
            // Upsert each pulled adjustment (don't clear - preserve pending adjustments)
            for (const adj of processedAdjustments) {
              await this.db.stockAdjustments.put(adj);
            }
        });
        
        // Update cache: merge pulled adjustments with local pending adjustments
        const localPendingAdjustments = this.cache.adjustments.filter(a => a.sync_status === 'pending');
        this.cache.adjustments = [...processedAdjustments, ...localPendingAdjustments];
    }

    // UPDATE ROUTE PLANS FROM PULL
    if (result.pulledRoutePlans && result.pulledRoutePlans.length > 0) {
        if (onLog) onLog(`Updating local route plans from cloud: ${result.pulledRoutePlans.length} records.`);
        const processedRoutePlans = result.pulledRoutePlans.map(plan => ({
          ...plan,
          sync_status: 'synced' as const
        }));
        
        await this.db.transaction('rw', this.db.routePlans, async () => {
            for (const plan of processedRoutePlans) {
              await this.db.routePlans.put(plan);
            }
        });
        
        // Update cache: merge pulled route plans with local pending ones
        const localPendingPlans = this.cache.routePlans.filter(p => p.sync_status === 'pending');
        this.cache.routePlans = [...processedRoutePlans, ...localPendingPlans];
    }

    // UPDATE VISITS FROM PULL
    if (result.pulledVisits && result.pulledVisits.length > 0) {
        if (onLog) onLog(`Updating local visits from cloud: ${result.pulledVisits.length} records.`);
        const processedVisits = result.pulledVisits.map(visit => ({
          ...visit,
          sync_status: 'synced' as const
        }));
        
        await this.db.transaction('rw', this.db.visits, async () => {
            for (const visit of processedVisits) {
              await this.db.visits.put(visit);
            }
        });
        
        // Update cache: merge pulled visits with local pending ones
        const localPendingVisits = this.cache.visits.filter(v => v.sync_status === 'pending');
        this.cache.visits = [...processedVisits, ...localPendingVisits];
    }

    updateProgress(100);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  // --- Conflict Detection ---
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
                  localItem.current_stock_qty !== cloudItem.current_stock_qty ||
                  localItem.internal_name !== cloudItem.internal_name; // Check new CSV-compatible field

              if (hasDiff) {
                  // Determine which version is newer based on updated_at timestamp (last-write-wins)
                  const localTime = new Date(localItem.updated_at).getTime();
                  const cloudTime = new Date(cloudItem.updated_at).getTime();

                  const winner = localTime > cloudTime ? 'local' : 'cloud';

                  conflicts.push({
                      type: 'item',
                      id: localItem.item_id,
                      local: localItem,
                      cloud: cloudItem,
                      resolution: winner, // For logging purposes
                      localTimestamp: localItem.updated_at,
                      cloudTimestamp: cloudItem.updated_at
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
                  localCustomer.outstanding_balance !== cloudCustomer.outstanding_balance ||
                  localCustomer.city !== cloudCustomer.city || // Check new CSV-compatible field
                  localCustomer.discount_1 !== cloudCustomer.discount_1 || // Check new CSV-compatible field
                  localCustomer.discount_2 !== cloudCustomer.discount_2 || // Check new CSV-compatible field
                  localCustomer.balance !== cloudCustomer.balance; // Check new CSV-compatible field

              if (hasDiff) {
                  // Determine which version is newer based on updated_at timestamp (last-write-wins)
                  const localTime = new Date(localCustomer.updated_at).getTime();
                  const cloudTime = new Date(cloudCustomer.updated_at).getTime();

                  const winner = localTime > cloudTime ? 'local' : 'cloud';

                  conflicts.push({
                      type: 'customer',
                      id: localCustomer.customer_id,
                      local: localCustomer,
                      cloud: cloudCustomer,
                      resolution: winner, // For logging purposes
                      localTimestamp: localCustomer.updated_at,
                      cloudTimestamp: cloudCustomer.updated_at
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
                  localOrder.order_status !== cloudOrder.order_status ||
                  localOrder.disc_1_rate !== cloudOrder.disc_1_rate || // Check new CSV-compatible field
                  localOrder.disc_1_value !== cloudOrder.disc_1_value || // Check new CSV-compatible field
                  localOrder.disc_2_rate !== cloudOrder.disc_2_rate || // Check new CSV-compatible field
                  localOrder.disc_2_value !== cloudOrder.disc_2_value || // Check new CSV-compatible field
                  localOrder.paid !== cloudOrder.paid || // Check new CSV-compatible field
                  localOrder.status !== cloudOrder.status; // Check new CSV-compatible field

              if (hasDiff) {
                  // Determine which version is newer based on updated_at timestamp (last-write-wins)
                  const localTime = new Date(localOrder.updated_at).getTime();
                  const cloudTime = new Date(cloudOrder.updated_at).getTime();

                  const winner = localTime > cloudTime ? 'local' : 'cloud';

                  conflicts.push({
                      type: 'order',
                      id: localOrder.order_id,
                      local: localOrder,
                      cloud: cloudOrder,
                      identifier: localOrder.invoice_number || localOrder.order_id,
                      resolution: winner, // For logging purposes
                      localTimestamp: localOrder.updated_at,
                      cloudTimestamp: cloudOrder.updated_at
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
      await this.db.transaction('rw', [this.db.items, this.db.customers, this.db.orders, this.db.settings, this.db.users, this.db.stockAdjustments], async () => {

          // Apply Item Resolutions
          for (const item of cloudData.items) {
              const resolution = resolutions[item.item_id];
              if (resolution === 'cloud') {
                  // Overwrite local with cloud
                  const updatedItem = {
                      ...item,
                      last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
                  };
                  await this.db.items.put(updatedItem);
              } else if (resolution === 'local') {
                  // Keep local (it's already there and pending), do nothing.
                  // It will be pushed in the next step.
              } else {
                  // No conflict, just update (Last Write Wins from Cloud for non-conflicting)
                  const local = this.cache.items.find(i => i.item_id === item.item_id);
                  if (!local || local.sync_status !== 'pending') {
                      const updatedItem = {
                          ...item,
                          last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
                      };
                      await this.db.items.put(updatedItem);
                  }
              }
          }

          // Apply Customer Resolutions
          for (const cust of cloudData.customers) {
              const resolution = resolutions[cust.customer_id];
              if (resolution === 'cloud') {
                  const updatedCustomer = {
                      ...cust,
                      last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
                  };
                  await this.db.customers.put(updatedCustomer);
              } else if (resolution === 'local') {
                  // Keep local
              } else {
                  const local = this.cache.customers.find(c => c.customer_id === cust.customer_id);
                  if (!local || local.sync_status !== 'pending') {
                      const updatedCustomer = {
                          ...cust,
                          last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
                      };
                      await this.db.customers.put(updatedCustomer);
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
                      sync_status: 'synced' as const,
                      last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
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
                          sync_status: 'synced' as const,
                          last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
                      };
                      await this.db.orders.put(updatedOrder);
                  }
              }
          }

          // Apply Settings Resolutions
          for (const setting of cloudData.settings) {
              const resolution = resolutions['settings'];
              if (resolution === 'cloud') {
                  const updatedSetting = {
                      ...setting,
                      id: 'main',
                      last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
                  };
                  await this.db.settings.put(updatedSetting as any);
              }
          }

          // Apply User Resolutions
          for (const user of cloudData.users) {
              const resolution = resolutions[user.id];
              if (resolution === 'cloud') {
                  await this.db.users.put(user);
              }
          }

          // Apply Stock Adjustment Resolutions
          for (const adjustment of cloudData.adjustments) {
              const resolution = resolutions[adjustment.adjustment_id];
              if (resolution === 'cloud') {
                  const updatedAdjustment = {
                      ...adjustment,
                      last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
                  };
                  await this.db.stockAdjustments.put(updatedAdjustment);
              }
          }
      });

      // 2. Refresh Cache
      await this.refreshCache();

      // 3. Perform Normal Sync (Push pending)
      await this.performSync();
  }

  /**
   * Automatically resolve conflicts based on last-write-wins strategy
   */
  async autoResolveConflictsAndSync(): Promise<void> {
      // Get conflicts
      const conflictResult = await this.checkForConflicts();
      
      if (!conflictResult.hasConflicts) {
          console.log('No conflicts to resolve');
          // Still perform sync to push any pending changes
          await this.performSync();
          return;
      }

      console.log(`Auto-resolving ${conflictResult.conflicts.length} conflicts using last-write-wins strategy`);
      
      // Create resolution map based on the resolution field in conflicts
      const resolutions = conflictResult.conflicts.reduce((acc, conflict) => {
          acc[conflict.id] = conflict.resolution;
          console.log(`Conflict for ${conflict.type} ${conflict.id}: ${conflict.resolution} wins (Local: ${conflict.localTimestamp}, Cloud: ${conflict.cloudTimestamp})`);
          return acc;
      }, {} as { [id: string]: 'local' | 'cloud' });

      // Apply the resolutions
      await this.resolveConflictsAndSync(resolutions, conflictResult.cloudData!);
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
          sync_status: 'synced' as const,
          last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
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
        invoice_number: order.invoice_number || order.order_id, // Only update if not already set
        original_invoice_number: order.original_invoice_number || order.invoice_number || order.order_id,
        last_updated: new Date().toISOString() // Add last_updated for CSV compatibility
      };

      await this.db.orders.put(updatedOrder);
    }

    // Refresh cache to reflect changes
    await this.refreshCache();
  }

  private async processSyncQueue(onLog?: (msg: string) => void): Promise<void> {
    // Get all queued operations
    const queuedOps = syncQueueService.getAll();
    const supabaseQueuedOps = supabaseSyncService.getAllQueuedOperations();

    if (queuedOps.length === 0 && supabaseQueuedOps.length === 0) {
      return; // Nothing to process
    }

    if (onLog) onLog(`Processing ${queuedOps.length + supabaseQueuedOps.length} queued operations from offline period...`);

    // Process the legacy sync queue first
    if (queuedOps.length > 0) {
      // Collect all pending data to sync
      const customers = this.getCustomers();
      const items = this.getItems();
      const orders = this.getOrders();
      const settings = [this.getSettings()];
      const users = this.cache.users;
      // Only get pending adjustments to sync
      const adjustments = this.getStockAdjustments().filter(adj => adj.sync_status === 'pending');

      // Perform sync to push all pending changes
      const result = await supabaseService.syncData(
        customers,
        orders,
        items,
        settings,
        users,
        adjustments,
        [],
        [],
        'upsert'
      );

      if (result.success) {
        if (onLog) onLog(`Successfully synced ${queuedOps.length} operations from offline queue.`);

        // Update sync status for all entities after successful sync
        await this.updateAllSyncStatus();

        // Clear the legacy queue after successful sync
        syncQueueService.clear();
      } else {
        if (onLog) onLog(`Failed to sync queued operations: ${result.message}`);
        throw new Error(`Failed to sync queued operations: ${result.message}`);
      }
    }

    // Process the new Supabase sync queue
    if (supabaseQueuedOps.length > 0) {
      if (onLog) onLog(`Processing ${supabaseQueuedOps.length} operations from Supabase sync queue...`);

      try {
        const result = await supabaseSyncService.processQueuedOperations();
        
        if (result.success) {
          if (onLog) onLog(`Successfully processed ${supabaseQueuedOps.length} operations from Supabase sync queue.`);
          
          // Update sync status for all entities after successful sync
          await this.updateAllSyncStatus();
        } else {
          if (onLog) onLog(`Failed to process Supabase queued operations: ${result.message}`);
          throw new Error(`Failed to process Supabase queued operations: ${result.message}`);
        }
      } catch (error) {
        if (onLog) onLog(`Error processing Supabase queued operations: ${(error as Error).message}`);
        throw error;
      }
    }
  }
  
  private async updateAllSyncStatus(): Promise<void> {
    // Update sync status to 'synced' for all pending items
    const customers = this.getCustomers();
    const items = this.getItems();
    const orders = this.getOrders();
    const adjustments = this.getStockAdjustments();

    // Update customers
    for (const customer of customers) {
      if (customer.sync_status === 'pending') {
        await this.saveCustomer({ 
          ...customer, 
          sync_status: 'synced' as const,
          last_updated: new Date().toISOString() // Update last_updated for CSV compatibility
        });
      }
    }

    // Update items
    for (const item of items) {
      if (item.sync_status === 'pending') {
        await this.saveItem({ 
          ...item, 
          sync_status: 'synced' as const,
          last_updated: new Date().toISOString() // Update last_updated for CSV compatibility
        });
      }
    }

    // Update orders
    for (const order of orders) {
      if (order.sync_status === 'pending') {
        await this.saveOrder({ 
          ...order, 
          sync_status: 'synced' as const,
          last_updated: new Date().toISOString() // Update last_updated for CSV compatibility
        });
      }
    }

    // Update adjustments
    for (const adjustment of adjustments) {
      if (adjustment.sync_status === 'pending') {
        // Update adjustment sync status
        const updatedAdjustment = { 
          ...adjustment, 
          sync_status: 'synced' as const,
          last_updated: new Date().toISOString() // Update last_updated for CSV compatibility
        };
        await this.db.stockAdjustments.put(updatedAdjustment);

        // Update cache
        const index = this.cache.adjustments.findIndex(a => a.adjustment_id === adjustment.adjustment_id);
        if (index >= 0) {
          this.cache.adjustments[index] = updatedAdjustment;
        }
      }
    }
  }
  
  private async processEntityQueue(ops: any[], entityType: string): Promise<void> {
    // This method is now deprecated as we handle the queue in processSyncQueue
    // This is kept for compatibility but doesn't perform any action
    return;
  }

  getDatabaseInfo(): { path: string; platform: string; type: string } {
    return {
      path: 'IndexedDB (Browser)',
      platform: 'web',
      type: 'IndexedDB'
    };
  }
}

export const db = new LocalDB();