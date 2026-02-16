import { Capacitor } from '@capacitor/core';
import { db as indexedDb } from './db';

let sqliteInstance: any = null;
let indexedDbInstance: any = null;
let isInitialized = false;
let initPromise: Promise<any> | null = null;

async function ensureInitialized() {
    if (!initPromise) {
        initPromise = (async () => {
            if (isInitialized) return;
            
            const platform = Capacitor.getPlatform();
            
            try {
                if (platform === 'android' || platform === 'ios') {
                    const { sqliteDatabase } = await import('./sqlite-db');
                    sqliteInstance = sqliteDatabase;
                    await sqliteInstance.initialize();
                    console.log("SQLite Database initialized successfully");
                } else {
                    console.log("Using IndexedDB for web platform");
                    indexedDbInstance = indexedDb;
                    await indexedDbInstance.initialize();
                    console.log("IndexedDB initialized successfully");
                }
                isInitialized = true;
            } catch (error) {
                console.error("Database initialization error:", error);
                throw error;
            }
        })();
    }
    return initPromise;
}

export async function getDatabase() {
    await ensureInitialized();
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') {
        return sqliteInstance;
    }
    return indexedDbInstance;
}

export async function initializeDatabase(): Promise<void> {
    await ensureInitialized();
}

export function getDatabasePlatform(): 'web' | 'android' | 'ios' | 'electron' {
    return Capacitor.getPlatform() as 'web' | 'android' | 'ios' | 'electron';
}

export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

export function getDatabaseInfo() {
    const platform = Capacitor.getPlatform();
    
    if (platform === 'android') {
        return {
            path: '/data/data/com.partflow.pro/databases/PartFlowDB.db',
            platform: 'android',
            type: 'SQLite'
        };
    } else if (platform === 'ios') {
        return {
            path: 'Library/CapacitorDatabase/PartFlowDB.db',
            platform: 'ios',
            type: 'SQLite'
        };
    } else if (platform === 'web') {
        return {
            path: 'IndexedDB (Browser)',
            platform: 'web',
            type: 'IndexedDB'
        };
    }
    
    return {
        path: 'Unknown',
        platform: platform,
        type: 'Unknown'
    };
}

export async function exportDatabase(): Promise<{ success: boolean; message: string; filePath?: string }> {
    const platform = Capacitor.getPlatform();
    
    if (platform === 'android' || platform === 'ios') {
        await ensureInitialized();
        return sqliteInstance.exportDatabase();
    }
    
    return { success: false, message: 'Export only available on mobile (Android/iOS)' };
}

function getDb() {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
        return sqliteInstance;
    }
    return indexedDbInstance;
}

class DbWrapper {
    async initialize() {
        return ensureInitialized();
    }
    
    getCustomers() {
        const db = getDb();
        if (!db) return [];
        return db.getCustomers();
    }
    
    getItems() {
        const db = getDb();
        if (!db) return [];
        return db.getItems();
    }
    
    getOrders() {
        const db = getDb();
        if (!db) return [];
        return db.getOrders();
    }
    
    getSettings() {
        const db = getDb();
        if (!db) return {} as any;
        return db.getSettings();
    }
    
    getDashboardStats() {
        const db = getDb();
        if (!db) return {} as any;
        return db.getDashboardStats();
    }
    
    getSyncStats() {
        const db = getDb();
        if (!db) return { pending: 0, failed: 0 };
        return db.getSyncStats();
    }
    
    getCurrentUser() {
        const db = getDb();
        if (!db) return null;
        return db.getCurrentUser();
    }
    
    login(username: string, password?: string) {
        const db = getDb();
        if (!db) return null;
        return db.login(username, password);
    }
    
    async saveCustomer(customer: any) {
        await ensureInitialized();
        const db = getDb();
        return db.saveCustomer(customer);
    }
    
    async updateCustomer(id: string, updates: any) {
        await ensureInitialized();
        const db = getDb();
        return db.updateCustomer(id, updates);
    }
    
    async deleteCustomer(customerId: string) {
        await ensureInitialized();
        const db = getDb();
        return db.deleteCustomer(customerId);
    }
    
    async saveItem(item: any) {
        await ensureInitialized();
        const db = getDb();
        return db.saveItem(item);
    }
    
    async updateItem(id: string, updates: any) {
        await ensureInitialized();
        const db = getDb();
        return db.updateItem(id, updates);
    }
    
    async deleteItem(itemId: string) {
        await ensureInitialized();
        const db = getDb();
        return db.deleteItem(itemId);
    }
    
    async updateStock(itemId: string, qtyDelta: number) {
        await ensureInitialized();
        const db = getDb();
        return db.updateStock(itemId, qtyDelta);
    }
    
    async saveOrder(order: any) {
        await ensureInitialized();
        const db = getDb();
        return db.saveOrder(order);
    }
    
    async updateOrder(id: string, updates: any) {
        await ensureInitialized();
        const db = getDb();
        return db.updateOrder(id, updates);
    }
    
    async deleteOrder(orderId: string) {
        await ensureInitialized();
        const db = getDb();
        return db.deleteOrder(orderId);
    }
    
    async addPayment(payment: any) {
        await ensureInitialized();
        const db = getDb();
        return db.addPayment(payment);
    }
    
    async updateDeliveryStatus(orderId: string, status: string, notes?: string) {
        await ensureInitialized();
        const db = getDb();
        return db.updateDeliveryStatus(orderId, status, notes);
    }
    
    async getPaymentsByOrder(orderId: string) {
        await ensureInitialized();
        const db = getDb();
        return db.getPaymentsByOrder(orderId);
    }
    
    getStockAdjustments() {
        const db = getDb();
        if (!db) return [];
        return db.getStockAdjustments();
    }
    
    async addStockAdjustment(adjustment: any) {
        await ensureInitialized();
        const db = getDb();
        return db.addStockAdjustment(adjustment);
    }
    
    async saveSettings(settings: any) {
        await ensureInitialized();
        const db = getDb();
        return db.saveSettings(settings);
    }
    
    async changePassword(userId: string | number, oldPassword: string, newPassword: string) {
        await ensureInitialized();
        const db = getDb();
        return db.changePassword(userId, oldPassword, newPassword);
    }
    
    logout() {
        const db = getDb();
        if (!db) return;
        return db.logout();
    }
    
    async performSync(onLog?: (msg: string) => void, mode?: 'upsert' | 'overwrite') {
        await ensureInitialized();
        const db = getDb();
        return db.performSync(onLog, mode);
    }
    
    async checkForConflicts() {
        await ensureInitialized();
        const db = getDb();
        if (db && typeof db.checkForConflicts === 'function') {
            return db.checkForConflicts();
        }
        return { hasConflicts: false, conflicts: [] };
    }
    
    async resolveConflictsAndSync(resolutions: any, cloudData: any) {
        await ensureInitialized();
        const db = getDb();
        if (db && typeof db.resolveConflictsAndSync === 'function') {
            return db.resolveConflictsAndSync(resolutions, cloudData);
        }
        return { success: true };
    }
    
    async autoResolveConflictsAndSync() {
        await ensureInitialized();
        const db = getDb();
        if (db && typeof db.autoResolveConflictsAndSync === 'function') {
            return db.autoResolveConflictsAndSync();
        }
        return { success: true };
    }
    
    async exportDatabase() {
        return exportDatabase();
    }
    
    getDatabaseInfo() {
        return getDatabaseInfo();
    }
    
    async clearAllData() {
        try {
            await ensureInitialized();
            const db = getDb();
            if (!db) {
                throw new Error('Database not available');
            }
            if (typeof db.clearAllData !== 'function') {
                throw new Error('clearAllData method not available on database');
            }
            return await db.clearAllData();
        } catch (error) {
            console.error('clearAllData error:', error);
            throw error;
        }
    }
}

export const db = new DbWrapper();
