import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Customer,
  Item,
  Order,
  CompanySettings,
  StockAdjustment,
  User,
  RoutePlanEntry,
  VisitEntry
} from '../types';
import { SUPABASE_CONFIG } from '../config';
import { supabaseSyncTracker } from './supabase-sync-tracker';
import { getSupabaseClient } from './supabase-client';

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
  pulledSettings?: CompanySettings[];
  pulledUsers?: User[];
  pulledAdjustments?: StockAdjustment[];
  pulledRoutePlans?: RoutePlanEntry[];
  pulledVisits?: VisitEntry[];
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
    this.supabase = getSupabaseClient();
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
    routePlans: RoutePlanEntry[] = [],
    visits: VisitEntry[] = [],
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
        adjustments: mode === 'overwrite' ? adjustments : adjustments.filter(a => a.sync_status === 'pending'),
        routePlans: mode === 'overwrite' ? routePlans : routePlans.filter(r => r.sync_status === 'pending'),
        visits: mode === 'overwrite' ? visits : visits.filter(v => v.sync_status === 'pending')
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
      this.addLog(`Pulled ${pulledData.routePlans?.length || 0} route plans from cloud.`);
      this.addLog(`Pulled ${pulledData.visits?.length || 0} visits from cloud.`);

      supabaseSyncTracker.logPullFromSupabase('routePlans', pulledData.routePlans?.length || 0, true);
      supabaseSyncTracker.logPullFromSupabase('visits', pulledData.visits?.length || 0, true);

      return {
        success: true,
        pulledItems: pulledData.items,
        pulledCustomers: pulledData.customers,
        pulledOrders: pulledData.orders,
        pulledSettings: pulledData.settings?.[0], // Settings is a singleton
        pulledUsers: pulledData.users,
        pulledAdjustments: pulledData.adjustments,
        pulledRoutePlans: pulledData.routePlans,
        pulledVisits: pulledData.visits,
        logs: this.currentLogs
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Log sync failure
      supabaseSyncTracker.logSyncWithSupabase('customers', uploadData?.customers?.length || 0, false, errorMessage);
      supabaseSyncTracker.logSyncWithSupabase('items', uploadData?.items?.length || 0, false, errorMessage);
      supabaseSyncTracker.logSyncWithSupabase('orders', uploadData?.orders?.length || 0, false, errorMessage);
      supabaseSyncTracker.logSyncWithSupabase('settings', uploadData?.settings?.length || 0, false, errorMessage);
      supabaseSyncTracker.logSyncWithSupabase('users', uploadData?.users?.length || 0, false, errorMessage);
      supabaseSyncTracker.logSyncWithSupabase('adjustments', uploadData?.adjustments?.length || 0, false, errorMessage);

      this.addLog(`Supabase Error: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
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
    routePlans: RoutePlanEntry[];
    visits: VisitEntry[];
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

    // Note: Authentication check removed - using anon policies for sync
    // If you want auth-required sync, uncomment the following:
    // const { data: { session } } = await this.supabase.auth.getSession();
    // if (!session) {
    //   throw new Error('User not authenticated. Please log in to sync data.');
    // }

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
      
      // Transform items: map app's item_name to Supabase's internal_name
      const transformedItems = data.items.map(item => {
        const transformed = transformDates(item);
        if (transformed.item_name && !transformed.internal_name) {
          transformed.internal_name = transformed.item_name;
        }
        return transformed;
      });
      
      const { error } = await this.supabase
        .from('items')
        .upsert(transformedItems, {
          onConflict: 'item_id',
          ignoreDuplicates: false
        })
        .select();

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
      
      // Remove 'lines' field from orders before uploading (lines stored separately)
      const ordersWithoutLines = data.orders.map(order => {
        const { lines, ...orderWithoutLines } = order;
        return transformDates(orderWithoutLines);
      });
      
      const { error } = await this.supabase
        .from('orders')
        .upsert(ordersWithoutLines, {
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
      
      // Upload order lines separately
      const allLines = data.orders.flatMap(order => 
        (order.lines || []).map(line => ({
          ...line,
          order_id: order.order_id
        }))
      );
      
      if (allLines.length > 0) {
        this.addLog(`Uploading ${allLines.length} order lines to Supabase...`);
        const { error: linesError } = await this.supabase
          .from('order_lines')
          .upsert(allLines, {
            onConflict: 'line_id',
            ignoreDuplicates: false
          });
        
        if (linesError) {
          console.error('Order lines upload error:', linesError);
          supabaseSyncTracker.logPushToSupabase('orderLines', allLines.length, false, linesError.message);
        } else {
          supabaseSyncTracker.logPushToSupabase('orderLines', allLines.length, true, `${mode} mode`);
        }
      }
    }

    // Upload settings (as a singleton)
    if (data.settings.length > 0) {
      this.addLog(`Uploading settings to Supabase...`);
      const transformedSettings = data.settings.map(transformDates);
      // Filter out fields not in Supabase schema
      const settingsToSync = { 
        ...transformedSettings[0], 
        id: 'main'
      };
      // Explicitly filter out new fields not in Supabase
      const cleanSettings = {
        id: settingsToSync.id,
        company_name: settingsToSync.company_name,
        address: settingsToSync.address,
        phone: settingsToSync.phone,
        rep_name: settingsToSync.rep_name,
        invoice_prefix: settingsToSync.invoice_prefix,
        starting_invoice_number: settingsToSync.starting_invoice_number,
        footer_note: settingsToSync.footer_note,
        currency_symbol: settingsToSync.currency_symbol,
        tax_rate: settingsToSync.tax_rate,
        auto_sku_enabled: settingsToSync.auto_sku_enabled,
        stock_tracking_enabled: settingsToSync.stock_tracking_enabled,
        category_enabled: settingsToSync.category_enabled,
        show_sku_in_item_cards: settingsToSync.show_sku_in_item_cards,
        logo_base64: settingsToSync.logo_base64,
        show_advanced_sync_options: settingsToSync.show_advanced_sync_options,
        gemini_api_key: settingsToSync.gemini_api_key,
        gemini_model: settingsToSync.gemini_model,
        created_at: settingsToSync.created_at,
        updated_at: settingsToSync.updated_at,
        sync_status: settingsToSync.sync_status,
        last_updated: settingsToSync.last_updated
      };
      const { error } = await this.supabase
        .from('settings')
        .upsert([cleanSettings], {
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

    // Upload route plans
    if (data.routePlans && data.routePlans.length > 0) {
      this.addLog(`Uploading ${data.routePlans.length} route plans to Supabase...`);
      const routePlansToUpload = data.routePlans.map(p => ({
        id: p.id,
        customer_id: p.customer_id,
        visit_time: p.visit_time,
        note: p.note,
        route_date: p.route_date,
        created_at: p.created_at,
        last_updated: p.last_updated,
        sync_status: p.sync_status
      }));
      const { error } = await this.supabase
        .from('route_plans')
        .upsert(routePlansToUpload, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Route plans upload error details:', error);
        supabaseSyncTracker.logPushToSupabase('routePlans', data.routePlans.length, false, error.message);
        throw new Error(`Failed to upload route plans: ${error.message}`);
      } else {
        supabaseSyncTracker.logPushToSupabase('routePlans', data.routePlans.length, true, `${mode} mode`);
      }
    }

    // Upload visits
    if (data.visits && data.visits.length > 0) {
      this.addLog(`Uploading ${data.visits.length} visits to Supabase...`);
      const visitsToUpload = data.visits.map(v => ({
        id: v.id,
        customer_id: v.customer_id,
        plan_id: v.plan_id,
        check_in_time: v.check_in_time,
        check_out_time: v.check_out_time,
        check_in_note: v.check_in_note,
        check_out_note: v.check_out_note,
        status: v.status,
        route_date: v.route_date,
        created_at: v.created_at,
        last_updated: v.last_updated,
        sync_status: v.sync_status
      }));
      const { error } = await this.supabase
        .from('visits')
        .upsert(visitsToUpload, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Visits upload error details:', error);
        supabaseSyncTracker.logPushToSupabase('visits', data.visits.length, false, error.message);
        throw new Error(`Failed to upload visits: ${error.message}`);
      } else {
        supabaseSyncTracker.logPushToSupabase('visits', data.visits.length, true, `${mode} mode`);
      }
    }
  }

  private async pullLatestData() {
    // Note: Authentication check removed - using anon policies for sync
    // If you want auth-required sync, uncomment the following:
    // const { data: { session } } = await this.supabase.auth.getSession();
    // if (!session) {
    //   throw new Error('User not authenticated. Please log in to sync data.');
    // }

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

    // Transform items from Supabase: map internal_name to app's item_name
    const transformedItems = (items || []).map(item => {
      if (item.internal_name && !item.item_name) {
        return { ...item, item_name: item.internal_name };
      }
      return item;
    });

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

    // Pull order_lines and merge into orders
    const { data: orderLines, error: orderLinesError } = await this.supabase
      .from('order_lines')
      .select('*');

    if (orderLinesError) {
      console.error(`Error: Failed to pull order_lines: ${orderLinesError.message}`);
      supabaseSyncTracker.logPullFromSupabase('order_lines', 0, false, orderLinesError.message);
    }

    // Merge lines into orders
    const ordersWithLines = (orders || []).map(order => ({
      ...order,
      lines: (orderLines || []).filter(line => line.order_id === order.order_id)
    }));

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

    // Pull route plans
    const { data: routePlans, error: routePlansError } = await this.supabase
      .from('route_plans')
      .select('*');

    if (routePlansError) {
      console.error(`Error: Failed to pull route_plans: ${routePlansError.message}`);
      supabaseSyncTracker.logPullFromSupabase('routePlans', 0, false, routePlansError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('routePlans', routePlans?.length || 0, true);
    }

    // Pull visits
    const { data: visits, error: visitsError } = await this.supabase
      .from('visits')
      .select('*');

    if (visitsError) {
      console.error(`Error: Failed to pull visits: ${visitsError.message}`);
      supabaseSyncTracker.logPullFromSupabase('visits', 0, false, visitsError.message);
    } else {
      supabaseSyncTracker.logPullFromSupabase('visits', visits?.length || 0, true);
    }

    return {
      items: transformedItems,
      customers: customers || [],
      orders: ordersWithLines,
      settings: settings || [],
      users: users || [],
      adjustments: adjustments || [],
      routePlans: routePlans || [],
      visits: visits || []
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
      return await this.syncData([], [], [], [], [], [], [], []);
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.addLog(`Conflict check error: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
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

  // Method to sign up new user (for first-time login)
  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  // Method to sign in or sign up (auto-register first-time users)
  async signInOrSignUp(email: string, password: string) {
    try {
      // Try to sign in first
      return await this.signIn(email, password);
    } catch (error: any) {
      // If user doesn't exist, try to sign up
      if (error.message?.includes('Invalid login') || error.message?.includes('Invalid email')) {
        try {
          await this.signUp(email, password);
          // After signup, try to sign in
          return await this.signIn(email, password);
        } catch (signupError: any) {
          throw new Error(`Could not authenticate: ${signupError.message}`);
        }
      }
      throw error;
    }
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