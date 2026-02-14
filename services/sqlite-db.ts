import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Customer, Item, Order, OrderLine, CompanySettings, User, StockAdjustment, Payment } from '../types';

class SQLiteDB {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // For web platform, the jeep-sqlite element must be in the DOM
      // Check if it exists and wait for it to be ready
      const jeepEl = document.querySelector('jeep-sqlite');
      if (!jeepEl) {
        throw new Error('jeep-sqlite element not found in DOM. Make sure it\'s added to index.html');
      }

      // Wait for jeep-sqlite to be ready (check isStoreOpen property)
      await this.waitForJeepSqliteReady();
      
      // Check if connection exists and close it
      const isConn = await this.sqlite.isConnection('partflow_db', false);
      if (isConn.result) {
        this.db = await this.sqlite.retrieveConnection('partflow_db', false);
      } else {
        this.db = await this.sqlite.createConnection('partflow_db', false, 'no-encryption', 1, false);
      }

      await this.db.open();
      
      // Create tables
      await this.createTables();
      
      this.isInitialized = true;
      console.log('[SQLite] Database initialized successfully');
    } catch (error) {
      console.error('[SQLite] Initialization error:', error);
      throw error;
    }
  }

  private async waitForJeepSqliteReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      
      const checkJeep = () => {
        attempts++;
        const jeepEl = document.querySelector('jeep-sqlite');
        if (jeepEl && (jeepEl as any).isStoreOpen) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('jeep-sqlite failed to initialize after 5 seconds'));
        } else {
          setTimeout(checkJeep, 100);
        }
      };
      checkJeep();
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS customers (
        customer_id TEXT PRIMARY KEY,
        shop_name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        city_ref TEXT,
        city TEXT,
        discount_rate REAL DEFAULT 0,
        discount_1 REAL,
        discount_2 REAL,
        secondary_discount_rate REAL DEFAULT 0,
        outstanding_balance REAL DEFAULT 0,
        balance REAL,
        credit_period INTEGER DEFAULT 0,
        credit_limit REAL,
        status TEXT DEFAULT 'active',
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_updated TEXT
      );

      CREATE TABLE IF NOT EXISTS items (
        item_id TEXT PRIMARY KEY,
        item_display_name TEXT NOT NULL,
        item_name TEXT,
        internal_name TEXT,
        item_number TEXT UNIQUE,
        vehicle_model TEXT,
        source_brand TEXT,
        brand_origin TEXT,
        category TEXT,
        unit_value REAL DEFAULT 0,
        current_stock_qty INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 0,
        is_out_of_stock INTEGER DEFAULT 0,
        stock_qty INTEGER,
        low_stock_threshold_csv INTEGER,
        status TEXT DEFAULT 'active',
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_updated TEXT
      );

      CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        customer_id TEXT,
        rep_id TEXT,
        order_date TEXT,
        disc_1_rate REAL,
        disc_1_value REAL,
        disc_2_rate REAL,
        disc_2_value REAL,
        discount_rate REAL DEFAULT 0,
        discount_value REAL DEFAULT 0,
        gross_total REAL DEFAULT 0,
        secondary_discount_rate REAL DEFAULT 0,
        secondary_discount_value REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_value REAL DEFAULT 0,
        net_total REAL DEFAULT 0,
        credit_period INTEGER DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        paid REAL,
        balance_due REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'unpaid',
        payments TEXT,
        delivery_status TEXT DEFAULT 'pending',
        delivery_notes TEXT,
        order_status TEXT DEFAULT 'draft',
        status TEXT,
        invoice_number TEXT,
        approval_status TEXT DEFAULT 'approved',
        original_invoice_number TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_updated TEXT
      );

      CREATE TABLE IF NOT EXISTS order_lines (
        line_id TEXT PRIMARY KEY,
        order_id TEXT,
        item_id TEXT,
        item_name TEXT,
        quantity INTEGER DEFAULT 0,
        unit_value REAL DEFAULT 0,
        unit_price REAL,
        line_total REAL DEFAULT 0,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS stock_adjustments (
        adjustment_id TEXT PRIMARY KEY,
        item_id TEXT,
        adjustment_type TEXT,
        quantity INTEGER,
        reason TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_updated TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        full_name TEXT,
        role TEXT DEFAULT 'rep',
        password TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        company_name TEXT,
        address TEXT,
        phone TEXT,
        rep_name TEXT,
        invoice_prefix TEXT DEFAULT 'INV',
        starting_invoice_number INTEGER DEFAULT 1,
        footer_note TEXT,
        currency_symbol TEXT DEFAULT '$',
        tax_rate REAL DEFAULT 0,
        auto_sku_enabled INTEGER DEFAULT 1,
        stock_tracking_enabled INTEGER DEFAULT 0,
        category_enabled INTEGER DEFAULT 0,
        show_sku_in_item_cards INTEGER DEFAULT 0,
        logo_base64 TEXT,
        show_advanced_sync_options INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_updated TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON customers(shop_name);
      CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status);
      CREATE INDEX IF NOT EXISTS idx_items_item_number ON items(item_number);
      CREATE INDEX IF NOT EXISTS idx_items_sync_status ON items(sync_status);
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
      CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
      CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
    `;

    await this.db.execute(createTablesSQL);
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.query('SELECT * FROM customers');
    return result.values?.map(row => this.mapCustomer(row)) || [];
  }

  async saveCustomer(customer: Customer): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const sql = `
      INSERT OR REPLACE INTO customers (
        customer_id, shop_name, address, phone, city_ref, city,
        discount_rate, discount_1, discount_2, secondary_discount_rate,
        outstanding_balance, balance, credit_period, credit_limit, status,
        created_at, updated_at, sync_status, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.run(sql, [
      customer.customer_id,
      customer.shop_name,
      customer.address,
      customer.phone,
      customer.city_ref,
      customer.city,
      customer.discount_rate,
      customer.discount_1,
      customer.discount_2,
      customer.secondary_discount_rate,
      customer.outstanding_balance,
      customer.balance,
      customer.credit_period,
      customer.credit_limit,
      customer.status,
      customer.created_at,
      customer.updated_at,
      customer.sync_status,
      customer.last_updated
    ]);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run('DELETE FROM customers WHERE customer_id = ?', [customerId]);
  }

  // Items
  async getItems(): Promise<Item[]> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.query('SELECT * FROM items');
    return result.values?.map(row => this.mapItem(row)) || [];
  }

  async getItem(itemId: string): Promise<Item | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.query('SELECT * FROM items WHERE item_id = ?', [itemId]);
    return result.values?.[0] ? this.mapItem(result.values[0]) : undefined;
  }

  async saveItem(item: Item): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const sql = `
      INSERT OR REPLACE INTO items (
        item_id, item_display_name, item_name, internal_name, item_number,
        vehicle_model, source_brand, brand_origin, category, unit_value,
        current_stock_qty, low_stock_threshold, is_out_of_stock, stock_qty,
        low_stock_threshold_csv, status, created_at, updated_at, sync_status, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.run(sql, [
      item.item_id,
      item.item_display_name,
      item.item_name,
      item.internal_name,
      item.item_number,
      item.vehicle_model,
      item.source_brand,
      item.brand_origin,
      item.category,
      item.unit_value,
      item.current_stock_qty,
      item.low_stock_threshold,
      item.is_out_of_stock ? 1 : 0,
      item.stock_qty,
      item.low_stock_threshold_csv,
      item.status,
      item.created_at,
      item.updated_at,
      item.sync_status,
      item.last_updated
    ]);
  }

  async deleteItem(itemId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run('DELETE FROM items WHERE item_id = ?', [itemId]);
  }

  async updateStock(itemId: string, quantityChange: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run(
      'UPDATE items SET current_stock_qty = current_stock_qty + ? WHERE item_id = ?',
      [quantityChange, itemId]
    );
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    if (!this.db) throw new Error('Database not initialized');
    const ordersResult = await this.db.query('SELECT * FROM orders');
    const orders = ordersResult.values || [];
    
    // Fetch lines for each order
    for (const order of orders) {
      const linesResult = await this.db.query('SELECT * FROM order_lines WHERE order_id = ?', [order.order_id]);
      order.lines = linesResult.values || [];
    }
    
    return orders.map(row => this.mapOrder(row));
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    if (!result.values?.[0]) return undefined;
    
    const order = result.values[0];
    const linesResult = await this.db.query('SELECT * FROM order_lines WHERE order_id = ?', [orderId]);
    order.lines = linesResult.values || [];
    
    return this.mapOrder(order);
  }

  async saveOrder(order: Order): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.execute('BEGIN TRANSACTION');
    
    try {
      // Save order
      const orderSql = `
        INSERT OR REPLACE INTO orders (
          order_id, customer_id, rep_id, order_date, disc_1_rate, disc_1_value,
          disc_2_rate, disc_2_value, discount_rate, discount_value, gross_total,
          secondary_discount_rate, secondary_discount_value, tax_rate, tax_value,
          net_total, credit_period, paid_amount, paid, balance_due, payment_status,
          payments, delivery_status, delivery_notes, order_status, status,
          invoice_number, approval_status, original_invoice_number, created_at,
          updated_at, sync_status, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.db.run(orderSql, [
        order.order_id, order.customer_id, order.rep_id, order.order_date,
        order.disc_1_rate, order.disc_1_value, order.disc_2_rate, order.disc_2_value,
        order.discount_rate, order.discount_value, order.gross_total,
        order.secondary_discount_rate, order.secondary_discount_value,
        order.tax_rate, order.tax_value, order.net_total, order.credit_period,
        order.paid_amount, order.paid, order.balance_due, order.payment_status,
        JSON.stringify(order.payments || []), order.delivery_status, order.delivery_notes,
        order.order_status, order.status, order.invoice_number, order.approval_status,
        order.original_invoice_number, order.created_at, order.updated_at,
        order.sync_status, order.last_updated
      ]);

      // Delete existing lines
      await this.db.run('DELETE FROM order_lines WHERE order_id = ?', [order.order_id]);

        // Insert new lines
      if (order.lines && order.lines.length > 0) {
        for (const line of order.lines) {
          await this.db.run(
            `INSERT INTO order_lines (line_id, order_id, item_id, item_name, quantity, unit_value, unit_price, line_total, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [line.line_id, line.order_id, line.item_id, line.item_name, line.quantity, 
             line.unit_value, line.unit_price, line.line_total, new Date().toISOString()]
          );
        }
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  async deleteOrder(orderId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execute('BEGIN TRANSACTION');
    try {
      await this.db.run('DELETE FROM order_lines WHERE order_id = ?', [orderId]);
      await this.db.run('DELETE FROM orders WHERE order_id = ?', [orderId]);
      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  // Settings
  async getSettings(): Promise<CompanySettings> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.query('SELECT * FROM settings WHERE id = ?', ['main']);
    
    if (result.values?.[0]) {
      return this.mapSettings(result.values[0]);
    }
    
    // Return default settings
    return {
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
    if (!this.db) throw new Error('Database not initialized');
    const sql = `
      INSERT OR REPLACE INTO settings (
        id, company_name, address, phone, rep_name, invoice_prefix,
        starting_invoice_number, footer_note, currency_symbol, tax_rate,
        auto_sku_enabled, stock_tracking_enabled, category_enabled,
        show_sku_in_item_cards, logo_base64, show_advanced_sync_options
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [
      'main', settings.company_name, settings.address, settings.phone,
      settings.rep_name, settings.invoice_prefix, settings.starting_invoice_number,
      settings.footer_note, settings.currency_symbol, settings.tax_rate,
      settings.auto_sku_enabled ? 1 : 0, settings.stock_tracking_enabled ? 1 : 0,
      settings.category_enabled ? 1 : 0, settings.show_sku_in_item_cards ? 1 : 0,
      settings.logo_base64 || '', settings.show_advanced_sync_options ? 1 : 0
    ]);
  }

  // Users
  async getUsers(): Promise<User[]> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.query('SELECT * FROM users');
    return result.values || [];
  }

  async login(username: string, password: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.query(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password]
    );
    return result.values?.[0] || null;
  }

  // Sync Stats
  async getSyncStats(): Promise<{
    pendingCustomers: number;
    pendingItems: number;
    pendingOrders: number;
    pendingAdjustments: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const [customers, items, orders, adjustments] = await Promise.all([
      this.db.query("SELECT COUNT(*) as count FROM customers WHERE sync_status = 'pending'"),
      this.db.query("SELECT COUNT(*) as count FROM items WHERE sync_status = 'pending'"),
      this.db.query("SELECT COUNT(*) as count FROM orders WHERE sync_status = 'pending'"),
      this.db.query("SELECT COUNT(*) as count FROM stock_adjustments WHERE sync_status = 'pending'")
    ]);

    return {
      pendingCustomers: customers.values?.[0]?.count || 0,
      pendingItems: items.values?.[0]?.count || 0,
      pendingOrders: orders.values?.[0]?.count || 0,
      pendingAdjustments: adjustments.values?.[0]?.count || 0
    };
  }

  // Utility methods
  private mapCustomer(row: any): Customer {
    return {
      customer_id: row.customer_id,
      shop_name: row.shop_name,
      address: row.address,
      phone: row.phone,
      city_ref: row.city_ref,
      city: row.city,
      discount_rate: row.discount_rate,
      discount_1: row.discount_1,
      discount_2: row.discount_2,
      secondary_discount_rate: row.secondary_discount_rate,
      outstanding_balance: row.outstanding_balance,
      balance: row.balance,
      credit_period: row.credit_period,
      credit_limit: row.credit_limit,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sync_status: row.sync_status,
      last_updated: row.last_updated
    };
  }

  private mapItem(row: any): Item {
    return {
      item_id: row.item_id,
      item_display_name: row.item_display_name,
      item_name: row.item_name,
      internal_name: row.internal_name,
      item_number: row.item_number,
      vehicle_model: row.vehicle_model,
      source_brand: row.source_brand,
      brand_origin: row.brand_origin,
      category: row.category,
      unit_value: row.unit_value,
      current_stock_qty: row.current_stock_qty,
      low_stock_threshold: row.low_stock_threshold,
      is_out_of_stock: row.is_out_of_stock === 1,
      stock_qty: row.stock_qty,
      low_stock_threshold_csv: row.low_stock_threshold_csv,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sync_status: row.sync_status,
      last_updated: row.last_updated
    };
  }

  private mapOrder(row: any): Order {
    return {
      order_id: row.order_id,
      customer_id: row.customer_id,
      rep_id: row.rep_id,
      order_date: row.order_date,
      disc_1_rate: row.disc_1_rate,
      disc_1_value: row.disc_1_value,
      disc_2_rate: row.disc_2_rate,
      disc_2_value: row.disc_2_value,
      discount_rate: row.discount_rate,
      discount_value: row.discount_value,
      gross_total: row.gross_total,
      secondary_discount_rate: row.secondary_discount_rate,
      secondary_discount_value: row.secondary_discount_value,
      tax_rate: row.tax_rate,
      tax_value: row.tax_value,
      net_total: row.net_total,
      credit_period: row.credit_period,
      paid_amount: row.paid_amount,
      paid: row.paid,
      balance_due: row.balance_due,
      payment_status: row.payment_status,
      payments: JSON.parse(row.payments || '[]'),
      delivery_status: row.delivery_status,
      delivery_notes: row.delivery_notes,
      order_status: row.order_status,
      status: row.status,
      invoice_number: row.invoice_number,
      approval_status: row.approval_status,
      original_invoice_number: row.original_invoice_number,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sync_status: row.sync_status,
      last_updated: row.last_updated,
      lines: row.lines || []
    };
  }

  private mapSettings(row: any): CompanySettings {
    return {
      company_name: row.company_name,
      address: row.address,
      phone: row.phone,
      rep_name: row.rep_name,
      invoice_prefix: row.invoice_prefix,
      starting_invoice_number: row.starting_invoice_number,
      footer_note: row.footer_note,
      currency_symbol: row.currency_symbol,
      tax_rate: row.tax_rate,
      auto_sku_enabled: row.auto_sku_enabled === 1,
      stock_tracking_enabled: row.stock_tracking_enabled === 1,
      category_enabled: row.category_enabled === 1,
      show_sku_in_item_cards: row.show_sku_in_item_cards === 1,
      logo_base64: row.logo_base64,
      show_advanced_sync_options: row.show_advanced_sync_options === 1
    };
  }
}

export const sqliteDB = new SQLiteDB();
