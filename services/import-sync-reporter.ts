import { importLogger } from './import-logger';
import { supabaseSyncTracker, SyncRecord } from './supabase-sync-tracker';

export interface ImportSyncReport {
  importSummary: {
    totalProcessed: number;
    created: number;
    updated: number;
    errors: number;
    successRate: number;
    entities: {
      customers: { total: number; created: number; updated: number; errors: number };
      items: { total: number; created: number; updated: number; errors: number };
      orders: { total: number; created: number; updated: number; errors: number };
      orderLines: { total: number; created: number; updated: number; errors: number };
    };
  };
  syncSummary: {
    totalSyncOperations: number;
    successfulSyncs: number;
    failedSyncs: number;
    entities: {
      customers: { total: number; successful: number; failed: number };
      items: { total: number; successful: number; failed: number };
      orders: { total: number; successful: number; failed: number };
      orderLines: { total: number; successful: number; failed: number };
      settings: { total: number; successful: number; failed: number };
      users: { total: number; successful: number; failed: number };
      adjustments: { total: number; successful: number; failed: number };
    };
  };
  recentImports: {
    timestamp: string;
    entityType: string;
    action: string;
    message: string;
    success: boolean;
  }[];
  recentSyncs: {
    timestamp: string;
    operation: string;
    entityType: string;
    count: number;
    success: boolean;
    details?: string;
  }[];
  overallStats: {
    totalRecordsProcessed: number;
    totalRecordsSynced: number;
    successPercentage: number;
    lastActivity: string;
  };
}

export class ImportSyncReporter {
  generateReport(): ImportSyncReport {
    const importSummary = importLogger.getSummary();
    const syncSummary = supabaseSyncTracker.getSyncStats();
    
    const recentImportLogs = importLogger.getRecentLogs(10);
    const recentImports = recentImportLogs.map(log => ({
      timestamp: log.timestamp,
      entityType: log.entityType,
      action: log.action,
      message: log.message,
      success: log.success
    }));
    
    // For sync logs, we'll need to get them from the logger too
    // Since we're using the importLogger for sync tracking as well
    const allLogs = importLogger.getLogs();
    const recentSyncLogs = allLogs
      .filter(log => ['push', 'pull', 'sync'].includes(log.action))
      .slice(0, 10);
    
    const recentSyncs = recentSyncLogs.map(log => ({
      timestamp: log.timestamp,
      operation: log.action,
      entityType: log.entityType,
      count: log.processedData?.count || 0,
      success: log.success,
      details: log.processedData?.details
    }));
    
    // Calculate overall stats
    const totalRecordsProcessed = importSummary.totalProcessed;
    const totalRecordsSynced = syncSummary.totalSyncOperations;
    const totalActivities = totalRecordsProcessed + totalRecordsSynced;
    const successfulActivities = importSummary.created + importSummary.updated + syncSummary.successfulSyncs;
    const successPercentage = totalActivities > 0 ? Math.round((successfulActivities / totalActivities) * 100) : 100;
    
    const allActivityLogs = [...recentImportLogs, ...recentSyncLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const lastActivity = allActivityLogs.length > 0 ? allActivityLogs[0].timestamp : 'Never';
    
    return {
      importSummary,
      syncSummary,
      recentImports,
      recentSyncs,
      overallStats: {
        totalRecordsProcessed,
        totalRecordsSynced,
        successPercentage,
        lastActivity
      }
    };
  }
  
  generateDetailedReport(): string {
    const report = this.generateReport();
    
    let detailedReport = "=== CSV Import and Sync Report ===\n\n";
    
    detailedReport += "IMPORT SUMMARY:\n";
    detailedReport += `Total Records Processed: ${report.importSummary.totalProcessed}\n`;
    detailedReport += `Created: ${report.importSummary.created}\n`;
    detailedReport += `Updated: ${report.importSummary.updated}\n`;
    detailedReport += `Errors: ${report.importSummary.errors}\n`;
    detailedReport += `Success Rate: ${report.importSummary.successRate}%\n\n`;
    
    detailedReport += "SYNC SUMMARY:\n";
    detailedReport += `Total Sync Operations: ${report.syncSummary.totalSyncOperations}\n`;
    detailedReport += `Successful Syncs: ${report.syncSummary.successfulSyncs}\n`;
    detailedReport += `Failed Syncs: ${report.syncSummary.failedSyncs}\n\n`;
    
    detailedReport += "ENTITIES BREAKDOWN:\n";
    detailedReport += "Customers - Imported: " +
      `${report.importSummary.entities.customers.total} (C: ${report.importSummary.entities.customers.created}, U: ${report.importSummary.entities.customers.updated}, E: ${report.importSummary.entities.customers.errors}), ` +
      `Synced: ${report.syncSummary.entities.customers.total} (S: ${report.syncSummary.entities.customers.successful}, F: ${report.syncSummary.entities.customers.failed})\n`;
      
    detailedReport += "Items - Imported: " +
      `${report.importSummary.entities.items.total} (C: ${report.importSummary.entities.items.created}, U: ${report.importSummary.entities.items.updated}, E: ${report.importSummary.entities.items.errors}), ` +
      `Synced: ${report.syncSummary.entities.items.total} (S: ${report.syncSummary.entities.items.successful}, F: ${report.syncSummary.entities.items.failed})\n`;
      
    detailedReport += "Orders - Imported: " +
      `${report.importSummary.entities.orders.total} (C: ${report.importSummary.entities.orders.created}, U: ${report.importSummary.entities.orders.updated}, E: ${report.importSummary.entities.orders.errors}), ` +
      `Synced: ${report.syncSummary.entities.orders.total} (S: ${report.syncSummary.entities.orders.successful}, F: ${report.syncSummary.entities.orders.failed})\n`;
      
    detailedReport += "Order Lines - Imported: " +
      `${report.importSummary.entities.orderLines.total} (C: ${report.importSummary.entities.orderLines.created}, U: ${report.importSummary.entities.orderLines.updated}, E: ${report.importSummary.entities.orderLines.errors}), ` +
      `Synced: ${report.syncSummary.entities.orderLines.total} (S: ${report.syncSummary.entities.orderLines.successful}, F: ${report.syncSummary.entities.orderLines.failed})\n\n`;
    
    detailedReport += `OVERALL STATS:\n`;
    detailedReport += `Total Records Processed: ${report.overallStats.totalRecordsProcessed}\n`;
    detailedReport += `Total Records Synced: ${report.overallStats.totalRecordsSynced}\n`;
    detailedReport += `Overall Success Rate: ${report.overallStats.successPercentage}%\n`;
    detailedReport += `Last Activity: ${report.overallStats.lastActivity}\n`;
    
    return detailedReport;
  }
}

export const importSyncReporter = new ImportSyncReporter();