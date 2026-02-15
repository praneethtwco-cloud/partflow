import { Capacitor } from '@capacitor/core';
import { db } from './db';

let databaseInstance: any = null;
let sqliteInstance: any = null;
let isInitialized = false;

export async function getDatabase() {
    if (databaseInstance) {
        return databaseInstance;
    }

    const platform = Capacitor.getPlatform();

    if (platform === 'android' || platform === 'ios') {
        if (!sqliteInstance) {
            const { sqliteDatabase } = await import('./sqlite-db');
            sqliteInstance = sqliteDatabase;
        }
        databaseInstance = sqliteInstance;
    } else {
        databaseInstance = db;
    }

    return databaseInstance;
}

export async function initializeDatabase(): Promise<void> {
    if (isInitialized) return;

    const database = await getDatabase();
    await database.initialize();
    isInitialized = true;
}

export function getDatabasePlatform(): 'web' | 'android' | 'ios' | 'electron' {
    return Capacitor.getPlatform() as 'web' | 'android' | 'ios' | 'electron';
}

export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

export function getDatabaseInfo(): { path: string; platform: string; type: string } {
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
        const { sqliteDatabase } = await import('./sqlite-db');
        return sqliteDatabase.exportDatabase();
    }
    
    return { success: false, message: 'Export only available on mobile (Android/iOS)' };
}

export { db };
