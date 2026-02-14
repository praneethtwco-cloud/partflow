import { connectionService } from './connection';
import { supabaseSyncService } from './supabase-sync-service';
import { db } from './db';

class AutoSyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private syncIntervalMs: number = 5 * 60 * 1000; // Default 5 minutes
  private isSyncing: boolean = false;
  private onSyncStatusChange: ((isSyncing: boolean, message?: string) => void) | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelayMs: number = 30000; // 30 seconds

  constructor() {
    this.handleConnectionChange = this.handleConnectionChange.bind(this);
    connectionService.subscribe(this.handleConnectionChange);
  }

  public setOnSyncStatusChange(callback: (isSyncing: boolean, message?: string) => void) {
    this.onSyncStatusChange = callback;
  }

  public setSyncInterval(ms: number) {
    this.syncIntervalMs = ms;
    if (this.syncInterval) {
      this.stop();
      this.start();
    }
  }

  public start() {
    if (this.syncInterval) {
      console.log('[AutoSync] Already running');
      return;
    }

    console.log(`[AutoSync] Starting with interval: ${this.syncIntervalMs}ms`);
    this.syncInterval = setInterval(() => {
      this.performAutoSync();
    }, this.syncIntervalMs);

    this.performAutoSync();
  }

  public stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[AutoSync] Stopped');
    }
  }

  public async syncNow(): Promise<boolean> {
    return this.performAutoSync();
  }

  private handleConnectionChange = async (isOnline: boolean) => {
    if (isOnline) {
      console.log('[AutoSync] Connection restored, attempting sync...');
      await this.performAutoSync();
    } else {
      console.log('[AutoSync] Connection lost, pausing auto-sync');
    }
  };

  private async performAutoSync(): Promise<boolean> {
    if (this.isSyncing) {
      console.log('[AutoSync] Sync already in progress, skipping...');
      return false;
    }

    if (!connectionService.getOnlineStatus()) {
      console.log('[AutoSync] Offline, skipping sync');
      return false;
    }

    const user = db.getCurrentUser();
    if (!user) {
      console.log('[AutoSync] User not logged in, skipping sync');
      return false;
    }

    this.isSyncing = true;
    this.onSyncStatusChange?.(true, 'Syncing...');

    try {
      console.log('[AutoSync] Starting sync...');
      
      const result = await supabaseSyncService.syncData(
        [],
        [],
        [],
        [],
        [],
        [],
        'upsert'
      );

      if (result.success) {
        console.log('[AutoSync] Sync completed successfully');
        this.retryCount = 0;
        this.onSyncStatusChange?.(false, 'Sync complete');
        return true;
      } else {
        console.error('[AutoSync] Sync failed:', result.message);
        this.handleSyncError(result.message || 'Sync failed');
        this.onSyncStatusChange?.(false, `Sync failed: ${result.message}`);
        return false;
      }
    } catch (error: any) {
      console.error('[AutoSync] Sync error:', error);
      
      if (error.message?.includes('not authenticated')) {
        this.onSyncStatusChange?.(false, 'Not authenticated with cloud');
        console.log('[AutoSync] Supabase not authenticated, data will sync when logged in');
        this.isSyncing = false;
        return false;
      }
      
      this.handleSyncError(error.message);
      this.onSyncStatusChange?.(false, `Sync error: ${error.message}`);
      return false;
    } finally {
      this.isSyncing = false;
      
      setTimeout(() => {
        this.onSyncStatusChange?.(false);
      }, 3000);
    }
  }

  private handleSyncError(message: string) {
    this.retryCount++;
    
    if (this.retryCount < this.maxRetries) {
      console.log(`[AutoSync] Retrying in ${this.retryDelayMs/1000}s (attempt ${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.performAutoSync();
      }, this.retryDelayMs);
    } else {
      console.error('[AutoSync] Max retries reached, giving up');
      this.retryCount = 0;
    }
  }

  public getStatus() {
    return {
      isRunning: this.syncInterval !== null,
      isSyncing: this.isSyncing,
      intervalMs: this.syncIntervalMs,
      retryCount: this.retryCount
    };
  }
}

export const autoSyncService = new AutoSyncService();
