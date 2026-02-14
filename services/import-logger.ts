import { Customer, Item, Order, OrderLine } from '../types';

export interface ImportLogEntry {
  id: string;
  timestamp: string;
  entityType: 'customers' | 'items' | 'orders' | 'orderLines';
  action: 'import' | 'update' | 'create' | 'error';
  entityId?: string;
  entityName?: string;
  message: string;
  success: boolean;
  originalData?: any;
  processedData?: any;
}

export interface ImportSummary {
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
}

class ImportLogger {
  private logs: ImportLogEntry[] = [];
  private batchSize = 1000; // Keep only the last 1000 logs

  log(entry: Omit<ImportLogEntry, 'id' | 'timestamp'>): ImportLogEntry {
    const logEntry: ImportLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    this.logs.push(logEntry);

    // Trim logs to keep only the last N entries
    if (this.logs.length > this.batchSize) {
      this.logs = this.logs.slice(-this.batchSize);
    }

    return logEntry;
  }

  getLogs(): ImportLogEntry[] {
    return [...this.logs].reverse(); // Return newest first
  }

  getLogsByEntity(entityType: string): ImportLogEntry[] {
    return this.logs.filter(log => log.entityType === entityType).reverse();
  }

  getRecentLogs(limit: number = 50): ImportLogEntry[] {
    return this.logs.slice(-limit).reverse();
  }

  getSummary(): ImportSummary {
    const totalProcessed = this.logs.length;
    const created = this.logs.filter(log => log.action === 'create' && log.success).length;
    const updated = this.logs.filter(log => log.action === 'update' && log.success).length;
    const errors = this.logs.filter(log => log.action === 'error').length;
    const successRate = totalProcessed > 0 ? Math.round(((created + updated) / (totalProcessed - errors)) * 100) : 100;

    return {
      totalProcessed,
      created,
      updated,
      errors,
      successRate,
      entities: {
        customers: this.getEntitySummary('customers'),
        items: this.getEntitySummary('items'),
        orders: this.getEntitySummary('orders'),
        orderLines: this.getEntitySummary('orderLines')
      }
    };
  }

  getEntitySummary(entityType: 'customers' | 'items' | 'orders' | 'orderLines') {
    const entityLogs = this.logs.filter(log => log.entityType === entityType);
    const total = entityLogs.length;
    const created = entityLogs.filter(log => log.action === 'create' && log.success).length;
    const updated = entityLogs.filter(log => log.action === 'update' && log.success).length;
    const errors = entityLogs.filter(log => log.action === 'error').length;

    return { total, created, updated, errors };
  }

  clearLogs() {
    this.logs = [];
  }

  generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const importLogger = new ImportLogger();