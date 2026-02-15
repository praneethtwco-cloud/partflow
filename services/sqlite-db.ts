import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Customer, Item, Order, CompanySettings, SyncStats, User, Payment, StockAdjustment } from '../types';
import { supabaseService } from './supabase';
import { supabaseSyncService } from './supabase-sync-service';
import { syncQueueService } from './sync-queue';
import { connectionService } from './connection';
import { db as indexedDb } from './db';
import SEED_DATA from '../src/config/seed-data.json';
import APP_SETTINGS from '../src/config/app-settings.json';

const DB_NAME = 'PartFlowDB';

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

interface DatabaseRef {
    execute(options: any): Promise<any>;
    query(sql: string, params?: any[]): Promise<any>;
    run(sql: string, params?: any[]): Promise<any>;
    close(): Promise<void>;
}

class SQLiteDatabase {
    private db: DatabaseRef | null = null;
    private initialized: boolean = false;
    private isOnline: boolean = true;

    private cache: {
        customers: Customer[];
        items: Item[];
        orders: Order[];
        settings: CompanySettings;
        adjustments: StockAdjustment[];
        users: User[];
    };

    constructor() {
        this.cache = {
            customers: [],
            items: [],
            orders: [],
            settings: {} as CompanySettings,
            adjustments: [],
            users: []
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const platform = Capacitor.getPlatform();
            
            if (platform === 'android' || platform === 'ios') {
                await CapacitorSQLite.createConnection({
                    database: DB_NAME,
                    encrypted: false,
                    mode: 'no-encryption'
                });
                
                await CapacitorSQLite.open({ database: DB_NAME });
                
                this.db = {
                    execute: async (opts: { statements: string[][] }) => {
                        const stmt = opts.statements[0][0];
                        return await CapacitorSQLite.execute({
                            database: DB_NAME,
                            statements: stmt
                        });
                    },
                    query: async (sql: string, params?: any[]) => {
                        return await CapacitorSQLite.query({
                            database: DB_NAME,
                            statement: sql,
                            values: params || []
                        });
                    },
                    run: async (sql: string, params?: any[]) => {
                        return await CapacitorSQLite.run({
                            database: DB_NAME,
                            statement: sql,
                            values: params || []
                        });
                    },
                    close: async () => {
                        await CapacitorSQLite.close({ database: DB_NAME });
                    }
                };
            } else if (platform === 'web') {
                await CapacitorSQLite.initWebStore();
                await CapacitorSQLite.createConnection({
                    database: DB_NAME,
                    encrypted: false,
                    mode: 'no-encryption'
                });
                await CapacitorSQLite.open({ database: DB_NAME });
                
                const db = CapacitorSQLite;
                this.db = {
                    execute: async (opts: { statements: string[][] }) => {
                        const stmt = opts.statements[0][0];
                        return await db.execute({
                            database: DB_NAME,
                            statements: stmt
                        });
                    },
                    query: async (sql: string, params?: any[]) => {
                        return await db.query({
                            database: DB_NAME,
                            statement: sql,
                            values: params || []
                        });
                    },
                    run: async (sql: string, params?: any[]) => {
                        return await db.run({
                            database: DB_NAME,
                            statement: sql,
                            values: params || []
                        });
                    },
                    close: async () => {
                        await db.close({ database: DB_NAME });
                    }
                };
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }
            
            await this.createTables();
            await this.seedOrLoad();
            await this.refreshCache();
            
            connectionService.subscribe(this.handleConnectionChange);
            
            this.initialized = true;
            console.log("SQLite Database initialized and cache loaded.");
        } catch (error) {
            console.error("Failed to initialize SQLite:", error);
            throw error;
        }
    }

    private handleConnectionChange = (isOnline: boolean) => {
        this.isOnline = isOnline;
        console.log(`Connection status changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

        if (isOnline && !syncQueueService.isEmpty()) {
            setTimeout(() => {
                this.performSync().catch(err => console.error('Error syncing queued operations:', err));
            }, 1000);
        }

        if (isOnline && !supabaseSyncService.isQueueEmpty()) {
            setTimeout(() => {
                supabaseSyncService.processQueuedOperations().catch(err => console.error('Error processing Supabase queued operations:', err));
            }, 1500);
        }
    };

    private async createTables(): Promise<void> {
        const statements = [
            `CREATE TABLE IF NOT EXISTS customers (
                customer_id TEXT PRIMARY KEY,
                shop_name TEXT,
                address TEXT,
                phone TEXT,
                city_ref TEXT,
                city TEXT,
                discount_rate REAL,
                discount_1 REAL,
                discount_2 REAL,
                secondary_discount_rate REAL,
                outstanding_balance REAL,
                balance REAL,
                credit_period INTEGER,
                credit_limit REAL,
                status TEXT,
                sync_status TEXT,
                created_at TEXT,
                updated_at TEXT,
                last_updated TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS items (
                item_id TEXT PRIMARY KEY,
                item_display_name TEXT,
                item_name TEXT,
                internal_name TEXT,
                item_number TEXT,
                vehicle_model TEXT,
                source_brand TEXT,
                brand_origin TEXT,
                category TEXT,
                unit_value REAL,
                current_stock_qty INTEGER,
                low_stock_threshold INTEGER,
                is_out_of_stock INTEGER,
                status TEXT,
                sync_status TEXT,
                created_at TEXT,
                updated_at TEXT,
                last_updated TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                customer_id TEXT,
                rep_id TEXT,
                order_date TEXT,
                disc_1_rate REAL,
                disc_1_value REAL,
                disc_2_rate REAL,
                disc_2_value REAL,
                discount_rate REAL,
                discount_value REAL,
                secondary_discount_rate REAL,
                secondary_discount_value REAL,
                tax_rate REAL,
                tax_value REAL,
                gross_total REAL,
                net_total REAL,
                credit_period INTEGER,
                paid_amount REAL,
                paid REAL,
                balance_due REAL,
                payment_status TEXT,
                delivery_status TEXT,
                delivery_notes TEXT,
                order_status TEXT,
                status TEXT,
                invoice_number TEXT,
                approval_status TEXT,
                original_invoice_number TEXT,
                sync_status TEXT,
                created_at TEXT,
                updated_at TEXT,
                last_updated TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS settings (
                id TEXT PRIMARY KEY,
                company_name TEXT,
                address TEXT,
                phone TEXT,
                rep_name TEXT,
                invoice_prefix TEXT,
                starting_invoice_number INTEGER,
                footer_note TEXT,
                currency_symbol TEXT,
                tax_rate REAL,
                auto_sku_enabled INTEGER,
                stock_tracking_enabled INTEGER,
                category_enabled INTEGER,
                show_sku_in_item_cards INTEGER,
                logo_base64 TEXT,
                show_advanced_sync_options INTEGER
            )`,
            `CREATE TABLE IF NOT EXISTS stock_adjustments (
                adjustment_id TEXT PRIMARY KEY,
                item_id TEXT,
                adjustment_type TEXT,
                quantity INTEGER,
                reason TEXT,
                sync_status TEXT,
                created_at TEXT,
                updated_at TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                role TEXT,
                password TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS payments (
                payment_id TEXT PRIMARY KEY,
                order_id TEXT,
                amount REAL,
                payment_date TEXT,
                payment_type TEXT,
                reference_number TEXT,
                notes TEXT
            )`
        ];

        for (const sql of statements) {
            await this.db!.execute({ statements: [[sql]] });
        }
    }

    private async seedOrLoad(): Promise<void> {
        const result = await this.db!.query('SELECT COUNT(*) as count FROM settings');
        const count = result.values?.[0]?.[0] || 0;

        if (count === 0) {
            const now = new Date().toISOString();
            
            const indexedDbCustomers = indexedDb.getCustomers();
            const indexedDbItems = indexedDb.getItems();
            const indexedDbSettings = indexedDb.getSettings();
            
            if (indexedDbSettings && indexedDbSettings.company_name) {
                await this.db!.execute({
                    statements: [[
                        `INSERT INTO settings (id, company_name, address, phone, rep_name, invoice_prefix, starting_invoice_number, footer_note, currency_symbol, tax_rate, auto_sku_enabled, stock_tracking_enabled, category_enabled, show_sku_in_item_cards, show_advanced_sync_options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        'main', indexedDbSettings.company_name, indexedDbSettings.address || '', indexedDbSettings.phone || '', indexedDbSettings.rep_name || '', indexedDbSettings.invoice_prefix || 'INV', indexedDbSettings.starting_invoice_number || 1, indexedDbSettings.footer_note || '', indexedDbSettings.currency_symbol || 'Rs.', indexedDbSettings.tax_rate || 0, indexedDbSettings.auto_sku_enabled ? 1 : 0, indexedDbSettings.stock_tracking_enabled ? 1 : 0, indexedDbSettings.category_enabled ? 1 : 0, indexedDbSettings.show_sku_in_item_cards ? 1 : 0, indexedDbSettings.show_advanced_sync_options ? 1 : 0
                    ]]
                });
                
                for (const customer of indexedDbCustomers) {
                    await this.insertCustomer({ ...customer, created_at: now, updated_at: now, sync_status: 'synced' });
                }
                
                for (const item of indexedDbItems) {
                    await this.insertItem({ ...item, created_at: now, updated_at: now, sync_status: 'synced' });
                }
                
                console.log("Data loaded from IndexedDB into SQLite");
            } else {
                await this.db!.execute({
                    statements: [[
                        `INSERT INTO settings (id, company_name, address, phone, rep_name, invoice_prefix, starting_invoice_number, footer_note, currency_symbol, tax_rate, auto_sku_enabled, stock_tracking_enabled, category_enabled, show_sku_in_item_cards, show_advanced_sync_options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        'main', SEED_SETTINGS.company_name, SEED_SETTINGS.address, SEED_SETTINGS.phone, SEED_SETTINGS.rep_name, SEED_SETTINGS.invoice_prefix, SEED_SETTINGS.starting_invoice_number, SEED_SETTINGS.footer_note, SEED_SETTINGS.currency_symbol, SEED_SETTINGS.tax_rate || 0, SEED_SETTINGS.auto_sku_enabled ? 1 : 0, SEED_SETTINGS.stock_tracking_enabled ? 1 : 0, SEED_SETTINGS.category_enabled ? 1 : 0, SEED_SETTINGS.show_sku_in_item_cards ? 1 : 0, SEED_SETTINGS.show_advanced_sync_options ? 1 : 0
                    ]]
                });

                for (const customer of SEED_CUSTOMERS) {
                    await this.insertCustomer({ ...customer, created_at: now, updated_at: now, sync_status: 'synced' });
                }

                for (const item of SEED_ITEMS) {
                    await this.insertItem({ ...item, created_at: now, updated_at: now, sync_status: 'synced' });
                }

                console.log("Seed data loaded into SQLite");
            }
        }
    }

    private async insertCustomer(customer: Customer): Promise<void> {
        await this.db!.execute({
            statements: [[
                `INSERT INTO customers (customer_id, shop_name, address, phone, city_ref, city, discount_rate, discount_1, discount_2, secondary_discount_rate, outstanding_balance, balance, credit_period, credit_limit, status, sync_status, created_at, updated_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    customer.customer_id, customer.shop_name, customer.address, customer.phone,
                    customer.city_ref, customer.city || '', customer.discount_rate, customer.discount_1,
                    customer.discount_2, customer.secondary_discount_rate, customer.outstanding_balance,
                    customer.balance, customer.credit_period, customer.credit_limit, customer.status,
                    customer.sync_status, customer.created_at, customer.updated_at, customer.last_updated
                ]
            ]]
        });
    }

    private async insertItem(item: Item): Promise<void> {
        await this.db!.execute({
            statements: [[
                `INSERT INTO items (item_id, item_display_name, item_name, internal_name, item_number, vehicle_model, source_brand, brand_origin, category, unit_value, current_stock_qty, low_stock_threshold, is_out_of_stock, status, sync_status, created_at, updated_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.item_id, item.item_display_name, item.item_name, item.internal_name,
                    item.item_number, item.vehicle_model, item.source_brand, item.brand_origin,
                    item.category, item.unit_value, item.current_stock_qty, item.low_stock_threshold,
                    item.is_out_of_stock ? 1 : 0, item.status, item.sync_status,
                    item.created_at, item.updated_at, item.last_updated
                ]
            ]]
        });
    }

    private async refreshCache(): Promise<void> {
        const [customersResult, itemsResult, ordersResult, settingsResult, adjustmentsResult, usersResult] = await Promise.all([
            this.db!.query('SELECT * FROM customers'),
            this.db!.query('SELECT * FROM items'),
            this.db!.query('SELECT * FROM orders'),
            this.db!.query('SELECT * FROM settings WHERE id = ?', ['main']),
            this.db!.query('SELECT * FROM stock_adjustments'),
            this.db!.query('SELECT * FROM users')
        ]);

        const mapCustomers = (rows: any[][]): Customer[] => rows.map(row => ({
            customer_id: row[0], shop_name: row[1], address: row[2], phone: row[3],
            city_ref: row[4], city: row[5], discount_rate: row[6], discount_1: row[7],
            discount_2: row[8], secondary_discount_rate: row[9], outstanding_balance: row[10],
            balance: row[11], credit_period: row[12], credit_limit: row[13], status: row[14],
            sync_status: row[15], created_at: row[16], updated_at: row[17], last_updated: row[18]
        }));

        const mapItems = (rows: any[][]): Item[] => rows.map(row => ({
            item_id: row[0], item_display_name: row[1], item_name: row[2], internal_name: row[3],
            item_number: row[4], vehicle_model: row[5], source_brand: row[6], brand_origin: row[7],
            category: row[8], unit_value: row[9], current_stock_qty: row[10], low_stock_threshold: row[11],
            is_out_of_stock: row[12] === 1, status: row[13], sync_status: row[14],
            created_at: row[15], updated_at: row[16], last_updated: row[17]
        }));

        const mapOrders = (rows: any[][]): Order[] => rows.map(row => ({
            order_id: row[0], customer_id: row[1], rep_id: row[2], order_date: row[3],
            disc_1_rate: row[4], disc_1_value: row[5], disc_2_rate: row[6], disc_2_value: row[7],
            discount_rate: row[8], discount_value: row[9], secondary_discount_rate: row[10],
            secondary_discount_value: row[11], tax_rate: row[12], tax_value: row[13],
            gross_total: row[14], net_total: row[15], credit_period: row[16],
            paid_amount: row[17], paid: row[18], balance_due: row[19], payment_status: row[20] as any,
            delivery_status: row[21] as any, delivery_notes: row[22], order_status: row[23], status: row[24],
            invoice_number: row[25], approval_status: row[26], original_invoice_number: row[27],
            sync_status: row[28], created_at: row[29], updated_at: row[30], last_updated: row[31],
            lines: [], payments: []
        }));

        const mapSettings = (rows: any[][]): CompanySettings | null => {
            if (!rows.length) return null;
            const row = rows[0];
            return {
                company_name: row[1], address: row[2], phone: row[3], rep_name: row[4],
                invoice_prefix: row[5], starting_invoice_number: row[6], footer_note: row[7],
                currency_symbol: row[8], tax_rate: row[9], auto_sku_enabled: row[10] === 1,
                stock_tracking_enabled: row[11] === 1, category_enabled: row[12] === 1,
                show_sku_in_item_cards: row[13] === 1, logo_base64: row[14],
                show_advanced_sync_options: row[15] === 1
            };
        };

        this.cache.customers = mapCustomers(customersResult.values || []);
        this.cache.items = mapItems(itemsResult.values || []);
        this.cache.orders = mapOrders(ordersResult.values || []);
        this.cache.settings = mapSettings(settingsResult.values) || SEED_SETTINGS;
        this.cache.adjustments = (adjustmentsResult.values || []).map((row: any[]) => ({
            adjustment_id: row[0], item_id: row[1], adjustment_type: row[2],
            quantity: row[3], reason: row[4], sync_status: row[5],
            created_at: row[6], updated_at: row[7]
        }));
        this.cache.users = (usersResult.values || []).map((row: any[]) => ({
            id: row[0], username: row[1], full_name: row[2], role: row[3], password: row[4]
        }));
    }

    getCustomers(): Customer[] {
        return this.cache.customers;
    }

    async saveCustomer(customer: Customer): Promise<void> {
        const index = this.cache.customers.findIndex(c => c.customer_id === customer.customer_id);
        const now = new Date().toISOString();

        const customerToSave = {
            ...customer,
            sync_status: 'pending' as const,
            updated_at: now,
            last_updated: now,
            city: customer.city || customer.city_ref,
            discount_1: customer.discount_1 !== undefined ? customer.discount_1 : customer.discount_rate,
            discount_2: customer.discount_2 !== undefined ? customer.discount_2 : customer.secondary_discount_rate,
            balance: customer.balance !== undefined ? customer.balance : customer.outstanding_balance
        };

        if (index >= 0) {
            this.cache.customers[index] = customerToSave;
        } else {
            this.cache.customers.push(customerToSave);
        }

        await this.db!.execute({
            statements: [[
                `INSERT OR REPLACE INTO customers (customer_id, shop_name, address, phone, city_ref, city, discount_rate, discount_1, discount_2, secondary_discount_rate, outstanding_balance, balance, credit_period, credit_limit, status, sync_status, created_at, updated_at, last_updated) VALUES ?, ?, ?, ?, (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    customerToSave.customer_id, customerToSave.shop_name, customerToSave.address, customerToSave.phone,
                    customerToSave.city_ref, customerToSave.city, customerToSave.discount_rate, customerToSave.discount_1,
                    customerToSave.discount_2, customerToSave.secondary_discount_rate, customerToSave.outstanding_balance,
                    customerToSave.balance, customerToSave.credit_period, customerToSave.credit_limit,
                    customerToSave.status, customerToSave.sync_status, customerToSave.created_at,
                    customerToSave.updated_at, customerToSave.last_updated
                ]
            ]]
        });

        await this.handleSync('customer', customerToSave, index >= 0 ? 'update' : 'create');
    }

    async deleteCustomer(customerId: string): Promise<void> {
        const index = this.cache.customers.findIndex(c => c.customer_id === customerId);
        if (index >= 0) {
            this.cache.customers.splice(index, 1);
            await this.db!.execute({ statements: [[`DELETE FROM customers WHERE customer_id = ?`, [customerId]]] });
            await this.handleSync('customer', { customer_id: customerId } as Customer, 'delete');
        }
    }

    getItems(): Item[] {
        return this.cache.items;
    }

    async saveItem(item: Item): Promise<void> {
        const index = this.cache.items.findIndex(i => i.item_id === item.item_id);
        const now = new Date().toISOString();

        const itemToSave = {
            ...item,
            sync_status: 'pending' as const,
            updated_at: now,
            last_updated: now,
            internal_name: item.internal_name || item.item_name
        };

        if (index >= 0) {
            this.cache.items[index] = itemToSave;
        } else {
            this.cache.items.push(itemToSave);
        }

        await this.db!.execute({
            statements: [[
                `INSERT OR REPLACE INTO items (item_id, item_display_name, item_name, internal_name, item_number, vehicle_model, source_brand, brand_origin, category, unit_value, current_stock_qty, low_stock_threshold, is_out_of_stock, status, sync_status, created_at, updated_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    itemToSave.item_id, itemToSave.item_display_name, itemToSave.item_name, itemToSave.internal_name,
                    itemToSave.item_number, itemToSave.vehicle_model, itemToSave.source_brand, itemToSave.brand_origin,
                    itemToSave.category, itemToSave.unit_value, itemToSave.current_stock_qty, itemToSave.low_stock_threshold,
                    itemToSave.is_out_of_stock ? 1 : 0, itemToSave.status, itemToSave.sync_status,
                    itemToSave.created_at, itemToSave.updated_at, itemToSave.last_updated
                ]
            ]]
        });

        await this.handleSync('item', itemToSave, index >= 0 ? 'update' : 'create');
    }

    async deleteItem(itemId: string): Promise<void> {
        const index = this.cache.items.findIndex(i => i.item_id === itemId);
        if (index >= 0) {
            this.cache.items.splice(index, 1);
            await this.db!.execute({ statements: [[`DELETE FROM items WHERE item_id = ?`, [itemId]]] });
            await this.handleSync('item', { item_id: itemId } as Item, 'delete');
        }
    }

    async updateStock(itemId: string, qtyDelta: number): Promise<void> {
        const index = this.cache.items.findIndex(i => i.item_id === itemId);
        if (index >= 0) {
            this.cache.items[index].current_stock_qty += qtyDelta;
            this.cache.items[index].sync_status = 'pending';
            const now = new Date().toISOString();
            this.cache.items[index].updated_at = now;
            this.cache.items[index].last_updated = now;
            
            await this.db!.execute({
                statements: [[
                    `UPDATE items SET current_stock_qty = ?, sync_status = ?, updated_at = ?, last_updated = ? WHERE item_id = ?`,
                    [this.cache.items[index].current_stock_qty, 'pending', now, now, itemId]
                ]]
            });
        }
    }

    getOrders(): Order[] {
        return this.cache.orders;
    }

    async saveOrder(order: Order): Promise<void> {
        const index = this.cache.orders.findIndex(o => o.order_id === order.order_id);
        const now = new Date().toISOString();

        const paid = order.paid_amount || 0;
        const due = order.net_total - paid;
        const paymentStatus = due <= 0.5 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
        const isExistingOrder = this.cache.orders.some(o => o.order_id === order.order_id);

        const orderToSave = {
            ...order,
            order_id: order.order_id,
            approval_status: order.approval_status || 'draft',
            invoice_number: order.invoice_number || (isExistingOrder ? order.invoice_number : this.generateNextInvoiceNumber()),
            original_invoice_number: order.original_invoice_number || (isExistingOrder ? order.original_invoice_number || order.invoice_number : order.invoice_number),
            paid_amount: paid,
            balance_due: due,
            payment_status: paymentStatus as any,
            delivery_status: order.delivery_status || 'pending',
            sync_status: 'pending' as const,
            updated_at: now,
            disc_1_rate: order.disc_1_rate !== undefined ? order.disc_1_rate : order.discount_rate,
            disc_1_value: order.disc_1_value !== undefined ? order.disc_1_value : order.discount_value,
            disc_2_rate: order.disc_2_rate !== undefined ? order.disc_2_rate : order.secondary_discount_rate,
            disc_2_value: order.disc_2_value !== undefined ? order.disc_2_value : order.secondary_discount_value,
            paid: order.paid !== undefined ? order.paid : paid,
            status: order.status || order.order_status || 'draft',
            last_updated: now
        };

        if (index >= 0) {
            this.cache.orders[index] = orderToSave;
        } else {
            this.cache.orders.push(orderToSave);
        }

        await this.db!.execute({
            statements: [[
                `INSERT OR REPLACE INTO orders (order_id, customer_id, rep_id, order_date, disc_1_rate, disc_1_value, disc_2_rate, disc_2_value, discount_rate, discount_value, secondary_discount_rate, secondary_discount_value, tax_rate, tax_value, gross_total, net_total, credit_period, paid_amount, paid, balance_due, payment_status, delivery_status, delivery_notes, order_status, status, invoice_number, approval_status, original_invoice_number, sync_status, created_at, updated_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderToSave.order_id, orderToSave.customer_id, orderToSave.rep_id, orderToSave.order_date,
                    orderToSave.disc_1_rate, orderToSave.disc_1_value, orderToSave.disc_2_rate, orderToSave.disc_2_value,
                    orderToSave.discount_rate, orderToSave.discount_value, orderToSave.secondary_discount_rate,
                    orderToSave.secondary_discount_value, orderToSave.tax_rate, orderToSave.tax_value,
                    orderToSave.gross_total, orderToSave.net_total, orderToSave.credit_period,
                    orderToSave.paid_amount, orderToSave.paid, orderToSave.balance_due, orderToSave.payment_status,
                    orderToSave.delivery_status, orderToSave.delivery_notes, orderToSave.order_status, orderToSave.status,
                    orderToSave.invoice_number, orderToSave.approval_status, orderToSave.original_invoice_number,
                    orderToSave.sync_status, orderToSave.created_at, orderToSave.updated_at, orderToSave.last_updated
                ]
            ]]
        });

        await this.handleSync('order', orderToSave, index >= 0 ? 'update' : 'create');
    }

    async addPayment(payment: Payment): Promise<void> {
        const orderIndex = this.cache.orders.findIndex(o => o.order_id === payment.order_id);
        if (orderIndex >= 0) {
            const order = this.cache.orders[orderIndex];
            const payments = order.payments || [];
            payments.push(payment);
            const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
            const due = order.net_total - paidAmount;
            
            order.payments = payments;
            order.paid_amount = paidAmount;
            order.balance_due = due;
            order.payment_status = due <= 0.5 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
            order.sync_status = 'pending';
            order.updated_at = new Date().toISOString();

            await this.saveOrder(order);
        }

        await this.db!.execute({
            statements: [[
                `INSERT INTO payments (payment_id, order_id, amount, payment_date, payment_type, reference_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [payment.payment_id, payment.order_id, payment.amount, payment.payment_date, payment.payment_type, payment.reference_number, payment.notes]
            ]]
        });
    }

    async updateDeliveryStatus(orderId: string, status: string, notes?: string): Promise<void> {
        const index = this.cache.orders.findIndex(o => o.order_id === orderId);
        if (index >= 0) {
            this.cache.orders[index].delivery_status = status as any;
            this.cache.orders[index].delivery_notes = notes;
            this.cache.orders[index].sync_status = 'pending';
            const now = new Date().toISOString();
            this.cache.orders[index].updated_at = now;
            
            await this.db!.execute({
                statements: [[
                    `UPDATE orders SET delivery_status = ?, delivery_notes = ?, sync_status = ?, updated_at = ? WHERE order_id = ?`,
                    [status, notes || '', 'pending', now, orderId]
                ]]
            });

            await this.handleSync('order', this.cache.orders[index], 'update');
        }
    }

    async deleteOrder(orderId: string): Promise<void> {
        const index = this.cache.orders.findIndex(o => o.order_id === orderId);
        if (index >= 0) {
            this.cache.orders.splice(index, 1);
            await this.db!.execute({ statements: [[`DELETE FROM orders WHERE order_id = ?`, [orderId]]] });
            await this.handleSync('order', { order_id: orderId } as Order, 'delete');
        }
    }

    getStockAdjustments(): StockAdjustment[] {
        return this.cache.adjustments;
    }

    async addStockAdjustment(adjustment: StockAdjustment): Promise<void> {
        this.cache.adjustments.push(adjustment);
        await this.db!.execute({
            statements: [[
                `INSERT INTO stock_adjustments (adjustment_id, item_id, adjustment_type, quantity, reason, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [adjustment.adjustment_id, adjustment.item_id, adjustment.adjustment_type, adjustment.quantity, adjustment.reason, adjustment.sync_status, adjustment.created_at, adjustment.updated_at]
            ]]
        });
        await this.handleSync('adjustment', adjustment, 'create');
    }

    getSettings(): CompanySettings {
        return this.cache.settings;
    }

    async saveSettings(settings: CompanySettings): Promise<void> {
        this.cache.settings = settings;
        await this.db!.execute({
            statements: [[
                `INSERT OR REPLACE INTO settings (id, company_name, address, phone, rep_name, invoice_prefix, starting_invoice_number, footer_note, currency_symbol, tax_rate, auto_sku_enabled, stock_tracking_enabled, category_enabled, show_sku_in_item_cards, logo_base64, show_advanced_sync_options) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                ['main', settings.company_name, settings.address, settings.phone, settings.rep_name, settings.invoice_prefix, settings.starting_invoice_number, settings.footer_note, settings.currency_symbol, settings.tax_rate, settings.auto_sku_enabled ? 1 : 0, settings.stock_tracking_enabled ? 1 : 0, settings.category_enabled ? 1 : 0, settings.show_sku_in_item_cards ? 1 : 0, settings.logo_base64, settings.show_advanced_sync_options ? 1 : 0]
            ]]
        });
    }

    getSyncStats(): SyncStats {
        return {
            pendingCustomers: this.cache.customers.filter(c => c.sync_status === 'pending').length,
            pendingItems: this.cache.items.filter(i => i.sync_status === 'pending').length,
            pendingOrders: this.cache.orders.filter(o => o.sync_status === 'pending').length,
            pendingAdjustments: this.cache.adjustments.filter(a => a.sync_status === 'pending').length
        };
    }

    getDashboardStats() {
        const today = new Date().toISOString().split('T')[0];
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        
        const todayOrders = this.cache.orders.filter(o => o.order_date.startsWith(today));
        const monthOrders = this.cache.orders.filter(o => 
            o.order_date >= firstOfMonth && 
            o.delivery_status !== 'failed' && 
            o.delivery_status !== 'cancelled'
        );
        
        const totalRevenue = this.cache.orders
            .filter(o => o.delivery_status !== 'failed' && o.delivery_status !== 'cancelled')
            .reduce((sum, o) => sum + o.net_total, 0);
            
        const monthlySales = monthOrders.reduce((sum, o) => sum + o.net_total, 0);
        const monthlyOrdersCount = monthOrders.length;
        const totalPaid = this.cache.orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
        const totalBalance = this.cache.orders.reduce((sum, o) => sum + (o.balance_due || 0), 0);

        return {
            todayOrdersCount: todayOrders.length,
            todayRevenue: todayOrders.reduce((sum, o) => sum + o.net_total, 0),
            totalCustomers: this.cache.customers.length,
            totalItems: this.cache.items.length,
            totalOrders: this.cache.orders.length,
            totalRevenue,
            totalPaid,
            totalBalance,
            monthlyOrders: monthlyOrdersCount,
            monthlySales,
            pendingSync: this.getSyncStats()
        };
    }

    getCurrentUser(): User | null {
        return this.cache.users[0] || null;
    }

    login(username: string, password?: string): User | null {
        const user = this.cache.users.find(u => u.username === username);
        if (user && (password === undefined || user.password === password)) {
            return user;
        }
        return null;
    }

    async changePassword(userId: string | number, oldPassword: string, newPassword: string): Promise<void> {
        const index = this.cache.users.findIndex(u => u.id === userId);
        if (index >= 0 && this.cache.users[index].password === oldPassword) {
            this.cache.users[index].password = newPassword;
            await this.db!.execute({
                statements: [[`UPDATE users SET password = ? WHERE id = ?`, [newPassword, String(userId)]]]
            });
        } else {
            throw new Error('Invalid old password');
        }
    }

    logout(): void {
        // Clear session if needed
    }

    async performSync(onLog?: (msg: string) => void, mode: 'upsert' | 'overwrite' = 'upsert'): Promise<void> {
        onLog?.('Starting sync from Supabase...');
        
        try {
            await this.refreshCache();
            onLog?.('Sync completed successfully');
        } catch (error) {
            console.error('Sync error:', error);
            onLog?.('Sync failed: ' + (error as Error).message);
            throw error;
        }
    }

    private async handleSync(entity: 'customer' | 'item' | 'order' | 'adjustment', data: any, operation: 'create' | 'update' | 'delete'): Promise<void> {
        if (!this.isOnline) {
            syncQueueService.enqueue({ id: data.customer_id || data.item_id || data.order_id || data.adjustment_id, entity, operation, data });
            supabaseSyncService.enqueue({ id: data.customer_id || data.item_id || data.order_id || data.adjustment_id, entity, operation, data });
        } else {
            try {
                const { data: { session } } = await supabaseService.getCurrentUser();
                if (!session) {
                    supabaseSyncService.enqueue({ id: data.customer_id || data.item_id || data.order_id || data.adjustment_id, entity, operation, data });
                    return;
                }
            } catch (error) {
                supabaseSyncService.enqueue({ id: data.customer_id || data.item_id || data.order_id || data.adjustment_id, entity, operation, data });
            }
        }
    }

    private generateNextInvoiceNumber(): string {
        const settings = this.cache.settings;
        const prefix = settings.invoice_prefix || 'INV';
        const nextNum = settings.starting_invoice_number || 1;
        return `${prefix}${String(nextNum).padStart(6, '0')}`;
    }

    getDatabaseInfo(): { path: string; platform: string; type: string } {
        const platform = Capacitor.getPlatform();
        let path = '';
        
        if (platform === 'android') {
            path = '/data/data/com.partflow.pro/databases/PartFlowDB.db';
        } else if (platform === 'ios') {
            path = 'Library/CapacitorDatabase/PartFlowDB.db';
        } else if (platform === 'web') {
            path = 'IndexedDB (Browser)';
        } else {
            path = 'Unknown';
        }
        
        return {
            path,
            platform,
            type: 'SQLite'
        };
    }

    async exportDatabase(): Promise<{ success: boolean; message: string; filePath?: string }> {
        try {
            const platform = Capacitor.getPlatform();
            
            if (platform !== 'android' && platform !== 'ios') {
                return { success: false, message: 'Export only available on Android/iOS' };
            }

            const date = new Date().toISOString().split('T')[0];
            const exportFileName = `PartFlowDB_${date}.db`;

            const result = await CapacitorSQLite.exportToJson({
                database: DB_NAME,
                jsonexportmode: 'full'
            });

            if (!result || !result.export) {
                return { success: false, message: 'Failed to export database' };
            }

            const jsonStr = JSON.stringify(result.export, null, 2);
            const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));

            const savedFile = await Filesystem.writeFile({
                path: exportFileName,
                data: base64Data,
                directory: Directory.Cache
            });

            await Share.share({
                title: 'PartFlow Database Export',
                text: `Database export from ${new Date().toLocaleDateString()}`,
                url: savedFile.uri,
                dialogTitle: 'Save or Share Database'
            });

            return { success: true, message: 'Database exported successfully', filePath: savedFile.uri };
        } catch (error) {
            console.error('Export error:', error);
            return { success: false, message: 'Failed to export: ' + (error as Error).message };
        }
    }
}

export const sqliteDatabase = new SQLiteDatabase();
