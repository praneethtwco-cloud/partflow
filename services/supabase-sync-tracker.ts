import { importLogger } from './import-logger';

export interface SyncRecord {
  id: string;
  timestamp: string;
  operation: 'push' | 'pull' | 'sync';
  entityType: 'customers' | 'items' | 'orders' | 'orderLines' | 'settings' | 'users' | 'adjustments';
  direction: 'to_supabase' | 'from_supabase';
  count: number;
  success: boolean;
  details?: string;
}

export class SupabaseSyncTracker {
  /**
   * Logs a sync operation to Supabase
   */
  logSyncOperation(operation: 'push' | 'pull' | 'sync', entityType: string, count: number, success: boolean, details?: string) {
    importLogger.log({
      entityType: entityType as any,
      action: operation,
      message: `${operation === 'push' ? 'Pushed' : operation === 'pull' ? 'Pulled' : 'Synced'} ${count} ${entityType} ${success ? 'successfully' : 'with errors'} ${details ? `(${details})` : ''}`,
      success,
      originalData: { count, operation, entityType },
      processedData: { success, details }
    });
  }

  /**
   * Logs a push operation to Supabase
   */
  logPushToSupabase(entityType: string, count: number, success: boolean, details?: string) {
    this.logSyncOperation('push', entityType, count, success, details);
  }

  /**
   * Logs a pull operation from Supabase
   */
  logPullFromSupabase(entityType: string, count: number, success: boolean, details?: string) {
    this.logSyncOperation('pull', entityType, count, success, details);
  }

  /**
   * Logs a full sync operation with Supabase
   */
  logSyncWithSupabase(entityType: string, count: number, success: boolean, details?: string) {
    this.logSyncOperation('sync', entityType, count, success, details);
  }

  /**
   * Gets sync statistics
   */
  getSyncStats() {
    const logs = importLogger.getLogs();
    const syncLogs = logs.filter(log => ['push', 'pull', 'sync'].includes(log.action));
    
    const stats = {
      totalSyncOperations: syncLogs.length,
      successfulSyncs: syncLogs.filter(log => log.success).length,
      failedSyncs: syncLogs.filter(log => !log.success).length,
      entities: {
        customers: this.getEntitySyncStats('customers', syncLogs),
        items: this.getEntitySyncStats('items', syncLogs),
        orders: this.getEntitySyncStats('orders', syncLogs),
        orderLines: this.getEntitySyncStats('orderLines', syncLogs),
        settings: this.getEntitySyncStats('settings', syncLogs),
        users: this.getEntitySyncStats('users', syncLogs),
        adjustments: this.getEntitySyncStats('adjustments', syncLogs),
      }
    };
    
    return stats;
  }

  private getEntitySyncStats(entityType: string, logs: any[]) {
    const entityLogs = logs.filter(log => log.entityType === entityType);
    return {
      total: entityLogs.length,
      successful: entityLogs.filter(log => log.success).length,
      failed: entityLogs.filter(log => !log.success).length
    };
  }
}

export const supabaseSyncTracker = new SupabaseSyncTracker();