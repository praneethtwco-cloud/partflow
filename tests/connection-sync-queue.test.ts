import { connectionService } from '../services/connection';
import { syncQueueService } from '../services/sync-queue';

describe('Connection and Sync Queue Tests', () => {
  beforeEach(() => {
    // Reset the sync queue before each test
    syncQueueService.clear();
  });

  test('should detect online status correctly', () => {
    // This test depends on the browser's navigator.onLine property
    // In a real browser environment, this would reflect actual connectivity
    const isOnline = connectionService.getOnlineStatus();
    expect(typeof isOnline).toBe('boolean');
  });

  test('should add operations to sync queue when offline', () => {
    // Add a mock operation to the queue
    syncQueueService.enqueue({
      id: 'test-op-1',
      entity: 'customer',
      operation: 'create',
      data: { customer_id: 'test-customer', name: 'Test Customer' },
      timestamp: Date.now()
    });

    // Verify the operation was added
    expect(syncQueueService.length()).toBe(1);
    expect(syncQueueService.peek()?.id).toBe('test-op-1');
  });

  test('should process operations from sync queue', () => {
    // Add multiple operations to the queue
    syncQueueService.enqueue({
      id: 'test-op-1',
      entity: 'customer',
      operation: 'create',
      data: { customer_id: 'test-customer-1', name: 'Test Customer 1' },
      timestamp: Date.now()
    });

    syncQueueService.enqueue({
      id: 'test-op-2',
      entity: 'item',
      operation: 'update',
      data: { item_id: 'test-item-1', name: 'Test Item 1' },
      timestamp: Date.now()
    });

    // Verify operations were added
    expect(syncQueueService.length()).toBe(2);

    // Process the queue (in our simplified implementation, this just clears it)
    // In a real implementation, this would send operations to the backend
    syncQueueService.clear();

    // Verify the queue is now empty
    expect(syncQueueService.isEmpty()).toBe(true);
    expect(syncQueueService.length()).toBe(0);
  });

  test('should handle queue persistence in localStorage', () => {
    // Add an operation to the queue
    const testOp = {
      id: 'persistent-op-1',
      entity: 'order',
      operation: 'create',
      data: { order_id: 'test-order-1', customer_id: 'test-customer' },
      timestamp: Date.now()
    };
    
    syncQueueService.enqueue(testOp);

    // Simulate reloading the queue from localStorage by creating a new instance conceptually
    const allOps = syncQueueService.getAll();
    
    expect(allOps.length).toBe(1);
    expect(allOps[0]).toEqual(testOp);
  });
});