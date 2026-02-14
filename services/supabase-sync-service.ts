import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Customer,
  Item,
  Order,
  CompanySettings,
  StockAdjustment,
  User
} from '../types';
import { SUPABASE_CONFIG } from '../config';
import { supabaseSyncTracker } from './supabase-sync-tracker';

interface QueuedOperation {
  id: string;
  entity: 'customer' | 'item' | 'order' | 'settings' | 'user' | 'adjustment';
  operation: 'create' | 'update' | 'delete';
  data: Customer | Item | Order | CompanySettings | User | StockAdjustment | string; // string for delete operations
  timestamp: number;
}

interface SupabaseSyncResult {
  success: boolean;
  message?: string;
  pulledItems?: Item[];
  pulledCustomers?: Customer[];
  pulledOrders?: Order[];
  pulledSettings?: CompanySettings;
  pulledUsers?: User[];
  pulledAdjustments?: StockAdjustment[];
  conflicts?: Array<{
    type: string;
    local: any;
    cloud: any;
    identifier: string;
  }>;
  logs?: string[];
}

class SupabaseSyncService {
  private supabase: SupabaseClient;
  private currentLogs: string[] = [];
  private queue: QueuedOperation[] = [];
  private storageKey = 'supabase_sync_queue';

  constructor() {
    const supabaseUrl = SUPABASE_CONFIG.URL;
    const supabaseAnonKey = SUPABASE_CONFIG.ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables. Please check your .env configuration.');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
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

  public getAllQueuedOperations(): QueuedOperation[] {
    return [...this.queue]; // Return a copy
  }

  public clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  public isQueueEmpty(): boolean {
    return this.queue.length === 0;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  private addLog(msg: string) {
    console.log(`[SupabaseSync] ${msg}`);
    this.currentLogs.push(msg);
  }

  async syncData(
    customers: Customer[] = [],
    orders: Order[] = [],
    items: Item[] = [],
    settings: CompanySettings[] = [],
    users: User[] = [],
    adjustments: StockAdjustment[] = [],
    mode: 'upsert' | 'overwrite' = 'upsert'
  ): Promise<SupabaseSyncResult> {
    this.currentLogs = [];
    try {
      this.addLog(`Starting Supabase sync (${mode} mode)...`);

      // Filter orders to only sync those with 'approved' status
      const approvedOrders = orders.filter(order =>
        order.approval_status === 'approved' ||
        order.approval_status === 'pending_approval'
      );

      // Prepare data for upload
      const uploadData = {
        customers: mode === 'overwrite' ? customers : customers.filter(c => c.sync_status === 'pending'),
        orders: mode === 'overwrite' ? approvedOrders : approvedOrders.filter(o => o.sync_status === 'pending'),
        items: mode === 'overwrite' ? items : items.filter(i => i.sync_status === 'pending'),
        settings: settings,
        users: users.filter(u => u.password), // Only sync users with passwords
        adjustments: mode === 'overwrite' ? adjustments : adjustments.filter(a => a.sync_status === 'pending')
      };

      // Upload pending changes to Supabase
      if (mode === 'upsert' || mode === 'overwrite') {
        await this.uploadPendingChanges(uploadData, mode);
      }

      // Pull latest data from Supabase
      const pulledData = await this.pullLatestData();

      // Log sync operations
      supabaseSyncTracker.logPushToSupabase('customers', uploadData.customers.length, true, `${mode} mode`);
      supabaseSyncTracker.logPushToSupabase('items', uploadData.items.length, true, `${mode} mode`);
      supabaseSyncTracker.logPushToSupabase('orders', uploadData.orders.length, true, `${mode} mode`);
      supabaseSyncTracker.logPushToSupabase('settings', uploadData.settings.length, true, `${mode} mode`);
      supabaseSyncTracker.logPushToSupabase('users', uploadData.users.length, true, `${mode} mode`);
      supabaseSyncTracker.logPushToSupabase('adjustments', uploadData.adjustments.length, true, `${mode} mode`);

      supabaseSyncTracker.logPullFromSupabase('customers', pulledData.customers?.length || 0, true);
      supabaseSyncTracker.logPullFromSupabase('items', pulledData.items?.length || 0, true);
      supabaseSyncTracker.logPullFromSupabase('orders', pulledData.orders?.length || 0, true);
      supabaseSyncTracker.logPullFromSupabase('settings', pulledData.settings?.length || 0, true);
      supabaseSyncTracker.logPullFromSupabase('users', pulledData.users?.length || 0, true);
      supabaseSyncTracker.logPullFromSupabase('adjustments', pulledData.adjustments?.length || 0, true);

      this.addLog("Supabase sync successful.");
      this.addLog(`Pushed ${uploadData.customers.length} customers to cloud.`);
      this.addLog(`Pushed ${uploadData.items.length} items to cloud.`);
      this.addLog(`Pushed ${uploadData.orders.length} orders to cloud.`);
      this.addLog(`Pushed ${uploadData.settings.length} settings to cloud.`);
      this.addLog(`Pushed ${uploadData.users.length} users to cloud.`);
      this.addLog(`Pushed ${uploadData.adjustments.length} adjustments to cloud.`);
      this.addLog(`Pulled ${pulledData.items?.length || 0} items from cloud.`);
      this.addLog(`Pulled ${pulledData.customers?.length || 0} customers from cloud.`);
      this.addLog(`Pulled ${pulledData.orders?.length || 0} orders from cloud.`);
      this.addLog(`Pulled ${pulledData.settings?.length || 0} settings from cloud.`);
      this.addLog(`Pulled ${pulledData.users?.length || 0} users from cloud.`);
      this.addLog(`Pulled ${pulledData.adjustments?.length || 0} adjustments from cloud.`);

      return {
        success: true,
        pulledItems: pulledData.items,
        pulledCustomers: pulledData.customers,
        pulledOrders: pulledData.orders,
        pulledSettings: pulledData.settings?.[0], // Settings is a singleton
        pulledUsers: pulledData.users,
        pulledAdjustments: pulledData.adjustments,
        logs: this.currentLogs
      };
    } catch (err: any) {
      // Log sync failure
      supabaseSyncTracker.logSyncWithSupabase('customers', uploadData?.customers?.length || 0, false, err.message);
      supabaseSyncTracker.logSyncWithSupabase('items', uploadData?.items?.length || 0, false, err.message);
      supabaseSyncTracker.logSyncWithSupabase('orders', uploadData?.orders?.length || 0, false, err.message);
      supabaseSyncTracker.logSyncWithSupabase('settings', uploadData?.settings?.length || 0, false, err.message);
      supabaseSyncTracker.logSyncWithSupabase('users', uploadData?.users?.length || 0, false, err.message);
      supabaseSyncTracker.logSyncWithSupabase('adjustments', uploadData?.adjustments?.length || 0, false, err.message);

      this.addLog(`Supabase Error: ${err.message}`);
      return {
        success: false,
        message: err.message,
        logs: this.currentLogs
      };
    }
  }

  private async uploadPendingChanges(data: {
    customers: Customer[];
    orders: Order[];
    items: Item[];
    settings: CompanySettings[];
    users: User[];
    adjustments: StockAdjustment[];
  }, mode: 'upsert' | 'overwrite') {
    // Transform data to ensure compatibility with Supabase schema
    const transformDates = (obj: any) => {
      const result = { ...obj };
      for (const key in result) {
        if (result[key] instanceof Date) {
          result[key] = result[key].toISOString();
        } else if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
          result[key] = transformDates(result[key]);
        }
      }
      return result;
    };

    // Check if user is authenticated
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated. Please log in to sync data.');
    }

    // Upload customers
    if (data.customers.length > 0) {
      this.addLog(`Uploading ${data.customers.length} customers to Supabase...`);
      const transformedCustomers = data.customers.map(transformDates);
      const { error } = await this.supabase
        .from('customers')
        .upsert(transformedCustomers, {
          onConflict: 'customer_id',
          ignoreDuplicates: false
        })
        .select(); // Adding .select() to ensure proper response

      if (error) {
        console.error('Customer upload error details:', error);
        supabaseSyncTracker.logPushToSupabase('customers', data.customers.length, false, error.message);
        throw new Error(`Failed to upload customers: ${error.message}`);
      } else {
        supabaseSyncTracker.logPushToSupabase('customers', data.customers.length, true, `${mode} mode`);
      }
    }

    // Upload items
    if (data.items.length > 0) {
      this.addLog(`Uploading ${data.items.length} items to Supabase...`);
      const transformedItems = data.items.map(transformDates);
      const { error } = await this.supabase
        .from('items')
        .upsert(transformedItems, {
          onConflict: 'item_id',
          ignoreDuplicates: false
        })
        .select(); // Adding .select() to ensure proper response

      if (error) {
        console.error('Item upload error details:', error);
        supabaseSyncTracker.logPushToSupabase('items', data.items.length, false, error.message);
        throw new Error(`Failed to upload items: ${error.message}`);
      } else {
        supabaseSyncTracker.logPushToSupabase('items', data.items.length, true, `${mode} mode`);
      }
    }

    // Upload orders
    if (data.orders.length > 0) {
      this.addLog(`Uploading ${data.orders.length} orders to Supabase...`);
      const transformedOrders = data.orders.map(transformDates);
      const { error } = await this.supabase
        .from('orders')
        .upsert(transformedOrders, {
          onConflict: 'order_id',
          ignoreDuplicates: false
        })
        .select(); // Adding .select() to ensure proper response

      if (error) {
        console.error('Order upload error details:', error);
        supabaseSyncTracker.logPushToSupabase('orders', data.orders.length, false, error.message);
        throw new Error(`Failed to upload orders: ${error.message}`);
      } else {
        supabaseSyncTracker.logPushToSupabase('orders', data.orders.length, true, `${mode} mode`);
      }
    }

    // Upload settings (as a singleton)
    if (data.settings.length > 0) {
      this.addLog(`Uploading settings to Supabase...`);
      const transformedSettings = data.settings.map(transformDates);
      const { error } = await this.supabase
        .from('settings')
        .upsert([{ ...transformedSettings[0], id: 'main' }], {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select(); // Adding .select() to ensure proper response

      if (error) {
        console.error('Settings upload error details:', error);
        supabaseSyncTracker.logPushToSupabase('settings', data.settings.length, false, error.message);
        throw new Error(`Failed to upload settings: ${error.message}`);
      } else {
        supabaseSyncTracker.logPushToSupabase('settings', data.settings.length, true, `${mode} mode`);
      }
    }

    // Upload users
    if (data.users.length > 0) {
      this.addLog(`Uploading ${data.users.length} users to Supabase...`);
      // Hash passwords before storing in Supabase (in a real implementation)
      const transformedUsers = data.users.map(user => {
        const transformed = transformDates(user);
        return {
          ...transformed,
          // In a real implementation, we would hash the password here
          // For now, we'll store as-is but this is not secure
          password: user.password // This should be hashed in production
        };
      });

      const { error } = await this.supabase
        .from('users')
        .upsert(transformedUsers, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select(); // Adding .select() to ensure proper response

      if (error) {
        console.error('User upload error details:', error);
        supabaseSyncTracker.logPushToSupabase('users', data.users.length, false, error.message);
        throw new Error(`Failed to upload users: ${error.message}`);
      } else {
        supabaseSyncTracker.logPushToSupabase('users', data.users.length, true, `${mode} mode`);
      }
    }

    // Upload stock adjustments
    if (data.adjustments.length > 0) {
      this.addLog(`Uploading ${data.adjustments.length} stock adjustments to Supabase...`);
      const transformedAdjustments = data.adjustments.map(transformDates);
      console.log(`Attempting to upload ${data.adjustments.length} adjustments to Supabase:`, transformedAdjustments.slice(0, 3)); // Log first 3 for debugging
      
      const { error } = await this.supabase
        .from('stock_adjustments')
        .upsert(transformedAdjustments, {
          onConflict: 'adjustment_id',
          ignoreDuplicates: false
        })
        .select(); // Adding .select() to ensure proper response

      if (error) {
        console.error('Adjustment upload error details:', error);
        console.error('Adjustment data that failed:', transformedAdjustments.slice(0, 3)); // Log first 3 for debugging
        supabaseSyncTracker.logPushToSupabase('adjustments', data.adjustments.length, false, error.message);
        throw new Error(`Failed to upload adjustments: ${error.message}`);
      } else {
        console.log(`Successfully uploaded ${data.adjustments.length} adjustments to Supabase`);
        supabaseSyncTracker.logPushToSupabase('adjustments', data.adjustments.length, true, `${mode} mode`);
      }
    }
  }

  private async pullLatestData() {
    // Check if user is authenticated
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated. Please log in to sync data.');
    }

    // Pull items
    const { data: items, error: itemsError } = await this.supabase
      .from('items')
      .select('*');

    if (itemsError) {
      console.error(`Error: Failed to pull items: ${itemsError.message}`);
      console.error('Error details:', itemsError);
      supabaseSyncTracker.logPullFromSupabase('items', 0, false, itemsError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('items', items?.length || 0, true);
    }

    // Pull customers
    const { data: customers, error: customersError } = await this.supabase
      .from('customers')
      .select('*');

    if (customersError) {
      console.error(`Error: Failed to pull customers: ${customersError.message}`);
      console.error('Error details:', customersError);
      supabaseSyncTracker.logPullFromSupabase('customers', 0, false, customersError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('customers', customers?.length || 0, true);
    }

    // Pull orders
    const { data: orders, error: ordersError } = await this.supabase
      .from('orders')
      .select('*');

    if (ordersError) {
      console.error(`Error: Failed to pull orders: ${ordersError.message}`);
      console.error('Error details:', ordersError);
      supabaseSyncTracker.logPullFromSupabase('orders', 0, false, ordersError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('orders', orders?.length || 0, true);
    }

    // Pull settings
    const { data: settings, error: settingsError } = await this.supabase
      .from('settings')
      .select('*')
      .limit(1);

    if (settingsError) {
      console.error(`Error: Failed to pull settings: ${settingsError.message}`);
      console.error('Error details:', settingsError);
      supabaseSyncTracker.logPullFromSupabase('settings', 0, false, settingsError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('settings', settings?.length || 0, true);
    }

    // Pull users
    const { data: users, error: usersError } = await this.supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.error(`Error: Failed to pull users: ${usersError.message}`);
      console.error('Error details:', usersError);
      supabaseSyncTracker.logPullFromSupabase('users', 0, false, usersError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('users', users?.length || 0, true);
    }

    // Pull stock adjustments
    const { data: adjustments, error: adjustmentsError } = await this.supabase
      .from('stock_adjustments')
      .select('*');

    if (adjustmentsError) {
      console.error(`Error: Failed to pull adjustments: ${adjustmentsError.message}`);
      console.error('Error details:', adjustmentsError);
      supabaseSyncTracker.logPullFromSupabase('adjustments', 0, false, adjustmentsError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('adjustments', adjustments?.length || 0, true);
    }

    return {
      items: items || [],
      customers: customers || [],
      orders: orders || [],
      settings: settings || [],
      users: users || [],
      adjustments: adjustments || []
    };
  }

  // Method to process queued operations when online
  async processQueuedOperations(): Promise<SupabaseSyncResult> {
    if (this.isQueueEmpty()) {
      return {
        success: true,
        message: 'No queued operations to process'
      };
    }

    this.currentLogs = [];
    this.addLog(`Processing ${this.getQueueLength()} queued operations...`);

    try {
      // Process each queued operation
      for (const operation of this.queue) {
        await this.executeQueuedOperation(operation);
      }

      // Clear the queue after successful processing
      this.clearQueue();
      
      this.addLog('Successfully processed all queued operations');
      
      // Now sync with Supabase to ensure consistency
      return await this.syncData([], [], [], [], [], []);
    } catch (error: any) {
      this.addLog(`Error processing queued operations: ${error.message}`);
      return {
        success: false,
        message: error.message,
        logs: this.currentLogs
      };
    }
  }

  private async executeQueuedOperation(operation: QueuedOperation): Promise<void> {
    switch (operation.entity) {
      case 'customer':
        if (operation.operation === 'create' || operation.operation === 'update') {
          const customerData = operation.data as Customer;
          // For now, we'll just log the operation - in a real implementation,
          // this would update the local database before syncing
          this.addLog(`${operation.operation} customer: ${customerData.customer_id}`);
        } else if (operation.operation === 'delete') {
          this.addLog(`delete customer: ${operation.id}`);
        }
        break;
        
      case 'item':
        if (operation.operation === 'create' || operation.operation === 'update') {
          const itemData = operation.data as Item;
          this.addLog(`${operation.operation} item: ${itemData.item_id}`);
        } else if (operation.operation === 'delete') {
          this.addLog(`delete item: ${operation.id}`);
        }
        break;
        
      case 'order':
        if (operation.operation === 'create' || operation.operation === 'update') {
          const orderData = operation.data as Order;
          this.addLog(`${operation.operation} order: ${orderData.order_id}`);
        } else if (operation.operation === 'delete') {
          this.addLog(`delete order: ${operation.id}`);
        }
        break;
        
      case 'settings':
        if (operation.operation === 'update') {
          const settingsData = operation.data as CompanySettings;
          this.addLog(`${operation.operation} settings: ${settingsData.id || 'main'}`);
        }
        break;
        
      case 'user':
        if (operation.operation === 'create' || operation.operation === 'update') {
          const userData = operation.data as User;
          this.addLog(`${operation.operation} user: ${userData.id}`);
        } else if (operation.operation === 'delete') {
          this.addLog(`delete user: ${operation.id}`);
        }
        break;
        
      case 'adjustment':
        if (operation.operation === 'create' || operation.operation === 'update') {
          const adjustmentData = operation.data as StockAdjustment;
          this.addLog(`${operation.operation} adjustment: ${adjustmentData.adjustment_id}`);
        } else if (operation.operation === 'delete') {
          this.addLog(`delete adjustment: ${operation.id}`);
        }
        break;
    }
  }

  // Method to check for conflicts between local and remote data
  async checkForConflicts(localData: {
    customers: Customer[];
    items: Item[];
    orders: Order[];
  }): Promise<SupabaseSyncResult> {
    this.currentLogs = [];
    try {
      this.addLog('Checking for conflicts between local and remote data...');

      // Pull latest data from Supabase
      const pulledData = await this.pullLatestData();

      const conflicts: any[] = [];

      // Check for customer conflicts
      pulledData.customers?.forEach(remoteCustomer => {
        const localCustomer = localData.customers.find(c => c.customer_id === remoteCustomer.customer_id);
        if (localCustomer) { // Check all local data, not just pending
          // Compare content (ignoring metadata)
          const hasDiff =
            localCustomer.shop_name !== remoteCustomer.shop_name ||
            localCustomer.address !== remoteCustomer.address ||
            localCustomer.phone !== remoteCustomer.phone ||
            localCustomer.outstanding_balance !== remoteCustomer.outstanding_balance;

          if (hasDiff) {
            // Determine which version is newer based on updated_at timestamp (last-write-wins)
            const localTime = new Date(localCustomer.updated_at).getTime();
            const remoteTime = new Date(remoteCustomer.updated_at).getTime();

            const winner = localTime > remoteTime ? 'local' : 'cloud';

            conflicts.push({
              type: 'customer',
              id: localCustomer.customer_id,
              local: localCustomer,
              cloud: remoteCustomer,
              resolution: winner, // For logging purposes
              localTimestamp: localCustomer.updated_at,
              cloudTimestamp: remoteCustomer.updated_at
            });
          }
        }
      });

      // Check for item conflicts
      pulledData.items?.forEach(remoteItem => {
        const localItem = localData.items.find(i => i.item_id === remoteItem.item_id);
        if (localItem) { // Check all local data, not just pending
          // Compare content (ignoring metadata)
          const hasDiff =
            localItem.item_display_name !== remoteItem.item_display_name ||
            localItem.unit_value !== remoteItem.unit_value ||
            localItem.current_stock_qty !== remoteItem.current_stock_qty;

          if (hasDiff) {
            // Determine which version is newer based on updated_at timestamp (last-write-wins)
            const localTime = new Date(localItem.updated_at).getTime();
            const remoteTime = new Date(remoteItem.updated_at).getTime();

            const winner = localTime > remoteTime ? 'local' : 'cloud';

            conflicts.push({
              type: 'item',
              id: localItem.item_id,
              local: localItem,
              cloud: remoteItem,
              resolution: winner, // For logging purposes
              localTimestamp: localItem.updated_at,
              cloudTimestamp: remoteItem.updated_at
            });
          }
        }
      });

      // Check for order conflicts
      pulledData.orders?.forEach(remoteOrder => {
        const localOrder = localData.orders.find(o => o.order_id === remoteOrder.order_id);
        if (localOrder) { // Check all local data, not just pending
          // Compare content (ignoring metadata)
          const hasDiff =
            localOrder.invoice_number !== remoteOrder.invoice_number ||
            localOrder.net_total !== remoteOrder.net_total ||
            localOrder.order_date !== remoteOrder.order_date ||
            localOrder.order_status !== remoteOrder.order_status;

          if (hasDiff) {
            // Determine which version is newer based on updated_at timestamp (last-write-wins)
            const localTime = new Date(localOrder.updated_at).getTime();
            const remoteTime = new Date(remoteOrder.updated_at).getTime();

            const winner = localTime > remoteTime ? 'local' : 'cloud';

            conflicts.push({
              type: 'order',
              id: localOrder.order_id,
              local: localOrder,
              cloud: remoteOrder,
              resolution: winner, // For logging purposes
              localTimestamp: localOrder.updated_at,
              cloudTimestamp: remoteOrder.updated_at
            });
          }
        }
      });

      this.addLog(`Found ${conflicts.length} conflicts.`);

      return {
        success: true,
        conflicts,
        pulledItems: pulledData.items,
        pulledCustomers: pulledData.customers,
        pulledOrders: pulledData.orders,
        pulledSettings: pulledData.settings?.[0],
        pulledUsers: pulledData.users,
        pulledAdjustments: pulledData.adjustments,
        logs: this.currentLogs
      };
    } catch (err: any) {
      this.addLog(`Conflict check error: ${err.message}`);
      return {
        success: false,
        message: err.message,
        logs: this.currentLogs
      };
    }
  }

  // Method to authenticate user
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  // Method to sign out user
  async signOut() {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  }

  // Method to get current user
  async getCurrentUser() {
    return await this.supabase.auth.getSession();
  }

  // Method to listen for auth changes
  onAuthStateChange(callback: (event: any, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  // Getter to access the supabase client for direct operations
  getSupabaseClient() {
    return this.supabase;
  }
}

export const supabaseSyncService = new SupabaseSyncService();