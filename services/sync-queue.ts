import { Customer, Item, Order, CompanySettings, User, StockAdjustment } from '../types';

interface QueuedOperation {
  id: string;
  entity: 'customer' | 'item' | 'order' | 'settings' | 'user' | 'adjustment';
  operation: 'create' | 'update' | 'delete';
  data: Customer | Item | Order | CompanySettings | User | StockAdjustment | string; // string for delete operations
  timestamp: number;
}

class SyncQueueService {
  private queue: QueuedOperation[] = [];
  private storageKey = 'sync_queue';

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue from localStorage:', error);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue to localStorage:', error);
    }
  }

  public enqueue(operation: Omit<QueuedOperation, 'timestamp'>): void {
    const queuedOp: QueuedOperation = {
      ...operation,
      timestamp: Date.now()
    };

    this.queue.push(queuedOp);
    this.saveQueue();
  }

  public dequeue(): QueuedOperation | undefined {
    const op = this.queue.shift();
    if (op) {
      this.saveQueue();
    }
    return op;
  }

  public peek(): QueuedOperation | undefined {
    return this.queue[0];
  }

  public getAll(): QueuedOperation[] {
    return [...this.queue]; // Return a copy
  }

  public clear(): void {
    this.queue = [];
    this.saveQueue();
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public length(): number {
    return this.queue.length;
  }

  public remove(id: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(op => op.id !== id);
    
    if (initialLength !== this.queue.length) {
      this.saveQueue();
      return true;
    }
    return false;
  }
}

export const syncQueueService = new SyncQueueService();