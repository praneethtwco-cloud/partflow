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
import { getSupabaseClient } from './supabase-client';

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

class SupabaseService {
  private supabase: SupabaseClient;
  private currentLogs: string[] = [];

  constructor() {
    this.supabase = getSupabaseClient();
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

      this.addLog("Supabase sync successful.");
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

    // Note: Authentication check removed - using anon policies for sync
    // This allows sync without requiring user login
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
        throw new Error(`Failed to upload customers: ${error.message}`);
      }
    }

    // Upload items
    if (data.items.length > 0) {
      this.addLog(`Uploading ${data.items.length} items to Supabase...`);
      
      // Transform items: map app's item_name to Supabase's internal_name
      const transformedItems = data.items.map(item => {
        const transformed = transformDates(item);
        // Map app's item_name to Supabase's internal_name
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
        throw new Error(`Failed to upload items: ${error.message}`);
      }
    }

    // Upload orders (without lines)
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
        throw new Error(`Failed to upload orders: ${error.message}`);
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
          this.addLog(`Warning: Failed to upload some order lines: ${linesError.message}`);
        }
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
        throw new Error(`Failed to upload settings: ${error.message}`);
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
        throw new Error(`Failed to upload users: ${error.message}`);
      }
    }

    // Upload stock adjustments
    if (data.adjustments.length > 0) {
      this.addLog(`Uploading ${data.adjustments.length} stock adjustments to Supabase...`);
      const transformedAdjustments = data.adjustments.map(transformDates);
      const { error } = await this.supabase
        .from('stock_adjustments')
        .upsert(transformedAdjustments, {
          onConflict: 'adjustment_id',
          ignoreDuplicates: false
        })
        .select(); // Adding .select() to ensure proper response

      if (error) {
        console.error('Adjustment upload error details:', error);
        throw new Error(`Failed to upload adjustments: ${error.message}`);
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
    }

    // Pull orders
    const { data: orders, error: ordersError } = await this.supabase
      .from('orders')
      .select('*');

    if (ordersError) {
      console.error(`Error: Failed to pull orders: ${ordersError.message}`);
      console.error('Error details:', ordersError);
    }

    // Pull order_lines and merge into orders
    const { data: orderLines, error: orderLinesError } = await this.supabase
      .from('order_lines')
      .select('*');

    if (orderLinesError) {
      console.error(`Error: Failed to pull order_lines: ${orderLinesError.message}`);
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
    }

    // Pull users
    const { data: users, error: usersError } = await this.supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.error(`Error: Failed to pull users: ${usersError.message}`);
      console.error('Error details:', usersError);
    }

    // Pull stock adjustments
    const { data: adjustments, error: adjustmentsError } = await this.supabase
      .from('stock_adjustments')
      .select('*');

    if (adjustmentsError) {
      console.error(`Error: Failed to pull adjustments: ${adjustmentsError.message}`);
      console.error('Error details:', adjustmentsError);
    }

    return {
      items: transformedItems,
      customers: customers || [],
      orders: ordersWithLines,
      settings: settings || [],
      users: users || [],
      adjustments: adjustments || []
    };
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

export const supabaseService = new SupabaseService();