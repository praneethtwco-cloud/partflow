import { Capacitor } from '@capacitor/core';
import { db } from './db';

let isInitialized = false;

export async function getDatabase() {
    return db;
}

export async function initializeDatabase(): Promise<void> {
    if (isInitialized) return;
    await db.open();
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
    
    if (platform === 'android' || platform === 'ios') {
        return {
            path: '/data/data/com.partflow.pro/databases/PartFlowDB.db',
            platform: platform,
            type: 'IndexedDB'
        };
    } else if (platform === 'web') {
        return {
            path: 'IndexedDB (Browser)',
            platform: 'web',
            type: 'IndexedDB'
        };
    }
    
    return {
        path: 'IndexedDB',
        platform: platform,
        type: 'IndexedDB'
    };
}

export async function exportDatabase(): Promise<{ success: boolean; message: string; filePath?: string }> {
    return { success: false, message: 'Export not implemented - use Supabase sync for backup' };
}

export { db };
