import bcrypt from 'bcryptjs';
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
import { getSupabaseClient } from './supabase-client';
import { formatDateForDb } from '../utils/dateUtils';

interface SupabaseSyncResult {
  success: boolean;
  message?: string;
  pulledItems?: Item[];
  pulledCustomers?: Customer[];
  pulledOrders?: Order[];
  pulledSettings?: CompanySettings;
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
    routePlans: RoutePlanEntry[] = [],
    visits: VisitEntry[] = [],
    mode: 'upsert' | 'overwrite' = 'upsert',
    onProgress?: (progress: number) => void
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
        routePlans: routePlans,
        visits: visits
      };

      // Upload pending changes to Supabase
      if (mode === 'upsert' || mode === 'overwrite') {
        await this.uploadPendingChanges(uploadData, mode, onProgress);
      }

      if (onProgress) onProgress(65);

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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.addLog(`Supabase Error: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
        logs: this.currentLogs
      };
    }
  }

  private async uploadPendingChanges(
    data: {
      customers: Customer[];
      orders: Order[];
      items: Item[];
      settings: CompanySettings[];
      users: User[];
      adjustments: StockAdjustment[];
      routePlans: RoutePlanEntry[];
      visits: VisitEntry[];
    },
    mode: 'upsert' | 'overwrite',
    onProgress?: (progress: number) => void
  ) {
    // Transform data to ensure compatibility with Supabase schema

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
      
      // Filter to only include fields that exist in Supabase schema
      const validCustomerFields = [
        'customer_id', 'shop_name', 'address', 'phone', 'city_ref', 'city',
        'discount_rate', 'discount_1', 'discount_2', 'secondary_discount_rate',
        'outstanding_balance', 'balance', 'credit_period', 'credit_limit', 'status',
        'created_at', 'updated_at', 'sync_status', 'last_updated'
      ];
      
      const transformedCustomers = data.customers.map(customer => {
        const transformed = formatDateForDb(customer);
        const filtered: Record<string, unknown> = {};
        for (const key of validCustomerFields) {
          if (key in transformed) {
            filtered[key] = transformed[key];
          }
        }
        return filtered;
      });
      
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
      if (onProgress) onProgress(20);
    }

    // Upload items
    if (data.items.length > 0) {
      this.addLog(`Uploading ${data.items.length} items to Supabase...`);
      
      // Filter to only include fields that exist in Supabase schema
      const validItemFields = [
        'item_id', 'item_display_name', 'item_name', 'internal_name', 'item_number',
        'vehicle_model', 'source_brand', 'brand_origin', 'category',
        'unit_value', 'current_stock_qty', 'low_stock_threshold', 'is_out_of_stock',
        'stock_qty', 'low_stock_threshold_csv', 'status',
        'created_at', 'updated_at', 'sync_status', 'last_updated'
      ];
      
      // Transform items: map app's item_name to Supabase's internal_name
      const transformedItems = data.items.map(item => {
        const transformed = formatDateForDb(item);
        // Map app's item_name to Supabase's internal_name
        if (transformed.item_name && !transformed.internal_name) {
          transformed.internal_name = transformed.item_name;
        }
        // Filter to only valid fields
        const filtered: Record<string, unknown> = {};
        for (const key of validItemFields) {
          if (key in transformed) {
            filtered[key] = transformed[key];
          }
        }
        return filtered;
      });

      // Check for duplicate item_numbers within local data
      const localItemNumberCounts = new Map<string, number>();
      transformedItems.forEach(item => {
        const num = item.item_number || '';
        localItemNumberCounts.set(num, (localItemNumberCounts.get(num) || 0) + 1);
      });

      const localDuplicateItemNumbers = [...localItemNumberCounts.entries()]
        .filter(([num, count]) => num && count > 1)
        .map(([num]) => num);

      if (localDuplicateItemNumbers.length > 0) {
        this.addLog(`Warning: ${localDuplicateItemNumbers.length} duplicate item_numbers found in local. Clearing duplicates.`);
        const seenNumbers = new Set<string>();
        transformedItems.forEach(item => {
          const num = item.item_number || '';
          if (num && localDuplicateItemNumbers.includes(num)) {
            if (seenNumbers.has(num)) {
              item.item_number = '';
            } else {
              seenNumbers.add(num);
            }
          }
        });
      }

      // Check for conflicts with cloud items (same item_number, different item_id)
      const { data: cloudItems, error: cloudFetchError } = await this.supabase
        .from('items')
        .select('item_id, item_number');

      if (cloudFetchError) {
        console.error('Failed to fetch cloud items:', cloudFetchError);
        // If we can't fetch cloud items, we still need to proceed - try with what we have
        this.addLog(`Warning: Could not fetch cloud items for validation. Proceeding with local data.`);
      }

      const cloudItemNumberMap = new Map<string, string>();
      const cloudHasItemNumbers = new Set<string>();
      
      if (cloudItems) {
        (cloudItems || []).forEach(item => {
          if (item.item_number) {
            cloudItemNumberMap.set(item.item_number, item.item_id);
            cloudHasItemNumbers.add(item.item_number);
          }
        });
      }

      // Find items that conflict with cloud (same item_number but different item_id)
      const conflictingItems: string[] = [];
      transformedItems.forEach(item => {
        const num = item.item_number;
        if (num) {
          // Check if same item_number exists in cloud with different item_id
          if (cloudItemNumberMap.has(num) && cloudItemNumberMap.get(num) !== item.item_id) {
            conflictingItems.push(item.item_id);
            item.item_number = '';
            this.addLog(`Cleared item_number ${num} for ${item.item_id} - conflicts with cloud`);
          }
          // Also check if cloud has this item_number for another item
          else if (cloudHasItemNumbers.has(num)) {
            const cloudItemId = cloudItemNumberMap.get(num);
            if (cloudItemId && cloudItemId !== item.item_id) {
              conflictingItems.push(item.item_id);
              item.item_number = '';
              this.addLog(`Cleared item_number ${num} for ${item.item_id} - duplicate in cloud`);
            }
          }
        }
      });

      if (conflictingItems.length > 0) {
        this.addLog(`Warning: ${conflictingItems.length} items have item_numbers that conflict with cloud.`);
      }

      // Try upload with retry logic
      let uploadAttempts = 0;
      const maxAttempts = 2;
      let uploadError: any = null;
      
      while (uploadAttempts < maxAttempts) {
        const { error } = await this.supabase
          .from('items')
          .upsert(transformedItems, {
            onConflict: 'item_id',
            ignoreDuplicates: false
          })
          .select();

        if (!error) {
          // Success
          uploadError = null;
          break;
        }

        uploadAttempts++;
        uploadError = error;
        
        // If error is duplicate key, clear all item_numbers and retry
        if (error.code === '23505' && uploadAttempts < maxAttempts) {
          this.addLog(`Upload failed with duplicate key. Clearing all non-empty item_numbers and retrying (attempt ${uploadAttempts}/${maxAttempts})...`);
          transformedItems.forEach(item => {
            if (item.item_number) {
              console.log(`Clearing item_number ${item.item_number} for ${item.item_id} due to upload failure`);
              item.item_number = '';
            }
          });
        } else if (error.code === '23505' && uploadAttempts >= maxAttempts) {
          this.addLog(`Upload still failed after ${maxAttempts} attempts. Some items may have duplicate item_numbers.`);
        }
      }

      if (uploadError) {
        console.error('Item upload error details:', uploadError);
        throw new Error(`Failed to upload items: ${uploadError.message}`);
      }
      
      this.addLog(`Successfully uploaded ${transformedItems.length} items to Supabase.`);
      if (onProgress) onProgress(35);
    }

    // Upload orders (without lines)
    if (data.orders.length > 0) {
      this.addLog(`Uploading ${data.orders.length} orders to Supabase...`);
      
      // Filter to only include fields that exist in Supabase schema
      const validOrderFields = [
        'order_id', 'customer_id', 'rep_id', 'order_date',
        'disc_1_rate', 'disc_1_value', 'disc_2_rate', 'disc_2_value',
        'discount_rate', 'discount_value', 'gross_total',
        'secondary_discount_rate', 'secondary_discount_value',
        'custom_discount_rate', 'custom_discount_value',
        'tax_rate', 'tax_value', 'net_total',
        'credit_period', 'paid_amount', 'paid', 'balance_due',
        'payment_status', 'payments', 'delivery_status', 'delivery_notes',
        'order_status', 'status', 'invoice_number',
        'approval_status', 'original_invoice_number',
        'created_at', 'updated_at', 'sync_status', 'last_updated'
      ];
      
      // Remove 'lines' field from orders before uploading (lines stored separately)
      const ordersWithoutLines = data.orders.map(order => {
        const { lines, ...orderWithoutLines } = order;
        const transformed = formatDateForDb(orderWithoutLines);
        // Only keep fields that exist in Supabase schema
        const filtered: Record<string, unknown> = {};
        for (const key of validOrderFields) {
          if (key in transformed) {
            filtered[key] = transformed[key];
          }
        }
        return filtered;
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
      const validLineFields = ['line_id', 'order_id', 'item_id', 'item_name', 'quantity', 'unit_value', 'unit_price', 'line_total', 'created_at'];
      const allLines = data.orders.flatMap(order => 
        (order.lines || []).map(line => {
          const transformed = formatDateForDb(line);
          const filtered: Record<string, unknown> = {};
          for (const key of validLineFields) {
            if (key in transformed) {
              filtered[key] = transformed[key];
            }
          }
          return { ...filtered, order_id: order.order_id };
        })
      );
      
      if (allLines.length > 0) {
        this.addLog(`Uploading ${allLines.length} order lines to Supabase...`);

        // First, get all valid item_ids from cloud to ensure FK constraint is satisfied
        const { data: cloudItems, error: itemsFetchError } = await this.supabase
          .from('items')
          .select('item_id');

        if (itemsFetchError) {
          throw new Error(`Failed to fetch cloud items for validation: ${itemsFetchError.message}`);
        }

        const validItemIds = new Set((cloudItems || []).map(i => i.item_id));
        const invalidLines: string[] = [];

        // Filter out lines with invalid item_ids
        const validLines = allLines.filter(line => {
          if (!validItemIds.has(line.item_id)) {
            invalidLines.push(line.line_id);
            return false;
          }
          return true;
        });

        if (invalidLines.length > 0) {
          this.addLog(`Warning: ${invalidLines.length} order lines skipped due to missing items in cloud.`);
          console.warn(`Skipped order lines with invalid item_ids:`, invalidLines);
        }

        if (validLines.length > 0) {
          this.addLog(`Uploading ${validLines.length} valid order lines (filtered from ${allLines.length} local lines)...`);
          
          const { error: linesError } = await this.supabase
            .from('order_lines')
            .upsert(validLines, {
              onConflict: 'line_id',
              ignoreDuplicates: false
            });
          
          if (linesError) {
            console.error('Order lines upload error:', linesError);
            throw new Error(`Failed to upload order lines: ${linesError.message}. Order sync aborted.`);
          }

          // Verify all lines were uploaded successfully
          const orderIds = [...new Set(validLines.map(l => l.order_id))];
          for (const orderId of orderIds) {
            const { data: verifyLines, error: verifyError } = await this.supabase
              .from('order_lines')
              .select('line_id')
              .eq('order_id', orderId);

            if (verifyError) {
              throw new Error(`Failed to verify order lines for ${orderId}`);
            }

            const expectedCount = validLines.filter(l => l.order_id === orderId).length;
            const actualCount = verifyLines?.length || 0;

            if (actualCount < expectedCount) {
              throw new Error(`Order line verification failed for ${orderId}: expected ${expectedCount}, found ${actualCount}. Sync aborted.`);
            }
          }
          this.addLog(`Verified ${validLines.length} order lines uploaded successfully.`);
          
          // Show summary of local vs cloud counts
          const localOrderIds = [...new Set(allLines.map(l => l.order_id))];
          for (const orderId of localOrderIds) {
            const localCount = allLines.filter(l => l.order_id === orderId).length;
            const cloudCount = (await this.supabase.from('order_lines').select('line_id', { count: 'exact', head: true }).eq('order_id', orderId)).count || 0;
            const skippedCount = invalidLines.length > 0 ? invalidLines.length : 0;
            this.addLog(`Order ${orderId}: Local lines=${localCount}, Cloud lines=${cloudCount}, Skipped=${localCount - validLines.filter(l => l.order_id === orderId).length}`);
          }
        } else {
          this.addLog(`Warning: No valid order lines to upload (all have invalid item_ids).`);
        }
      }
      if (onProgress) onProgress(50);
    }

    // Upload settings (as a singleton)
    if (data.settings.length > 0) {
      this.addLog(`Uploading settings to Supabase...`);
      const transformedSettings = data.settings.map(formatDateForDb);
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
        throw new Error(`Failed to upload settings: ${error.message}`);
      }
      if (onProgress) onProgress(55);
    }

    // Upload users
    if (data.users.length > 0) {
      this.addLog(`Uploading ${data.users.length} users to Supabase...`);
      // Hash passwords before storing in Supabase (in a real implementation)
      const transformedUsers = data.users.map(user => {
        const transformed = formatDateForDb(user);
        return {
          ...transformed,
          // In a real implementation, we would hash the password here
          // For now, we'll store as-is but this is not secure
          password: user.password && !user.password.startsWith('$2') ? bcrypt.hashSync(user.password, 10) : user.password
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
      if (onProgress) onProgress(58);
    }

    // Upload stock adjustments
    if (data.adjustments.length > 0) {
      this.addLog(`Uploading ${data.adjustments.length} stock adjustments to Supabase...`);
      const transformedAdjustments = data.adjustments.map(formatDateForDb);
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
      if (onProgress) onProgress(62);
    }

    // Upload route plans
    const routePlansToUploadRaw = data.routePlans || [];
    if (routePlansToUploadRaw.length > 0) {
      this.addLog(`Uploading ${routePlansToUploadRaw.length} route plans to Supabase...`);
      const routePlansToUpload = routePlansToUploadRaw.map(p => ({
        id: p.id,
        customer_id: p.customer_id,
        visit_time: p.visit_time,
        note: p.note,
        route_date: p.route_date,
        created_at: p.created_at,
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
        throw new Error(`Failed to upload route plans: ${error.message}`);
      }
    }

    // Upload visits
    const visitsToUploadRaw = data.visits || [];
    if (visitsToUploadRaw.length > 0) {
      this.addLog(`Uploading ${visitsToUploadRaw.length} visits to Supabase...`);
      const visitsToUpload = visitsToUploadRaw.map(v => ({
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
        throw new Error(`Failed to upload visits: ${error.message}`);
      }
      if (onProgress) onProgress(65);
    }
  }

  private async pullLatestData(onProgress?: (progress: number) => void) {
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
    if (onProgress) onProgress(70);

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
    if (onProgress) onProgress(75);

    // Pull orders
    const { data: orders, error: ordersError } = await this.supabase
      .from('orders')
      .select('*');

    if (ordersError) {
      console.error(`Error: Failed to pull orders: ${ordersError.message}`);
      console.error('Error details:', ordersError);
    }
    if (onProgress) onProgress(78);

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

    // Pull route plans
    const { data: routePlans, error: routePlansError } = await this.supabase
      .from('route_plans')
      .select('*');

    if (routePlansError) {
      console.error(`Error: Failed to pull route_plans: ${routePlansError.message}`);
    }

    // Pull visits
    const { data: visits, error: visitsError } = await this.supabase
      .from('visits')
      .select('*');

    if (visitsError) {
      console.error(`Error: Failed to pull visits: ${visitsError.message}`);
    }
    if (onProgress) onProgress(90);

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

  // Fetch all cloud data for CSV export
  async fetchCloudData(): Promise<{
    customers: any[];
    items: any[];
    orders: any[];
    orderLines: any[];
    adjustments: any[];
  }> {
    // Pull items
    const { data: items, error: itemsError } = await this.supabase
      .from('items')
      .select('*');

    if (itemsError) {
      console.error(`Error: Failed to fetch items: ${itemsError.message}`);
    }

    // Transform items: map internal_name to item_name
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
      console.error(`Error: Failed to fetch customers: ${customersError.message}`);
    }

    // Pull orders
    const { data: orders, error: ordersError } = await this.supabase
      .from('orders')
      .select('*');

    if (ordersError) {
      console.error(`Error: Failed to fetch orders: ${ordersError.message}`);
    }

    // Pull order_lines
    const { data: orderLines, error: orderLinesError } = await this.supabase
      .from('order_lines')
      .select('*');

    if (orderLinesError) {
      console.error(`Error: Failed to fetch order_lines: ${orderLinesError.message}`);
    }

    // Pull stock adjustments
    const { data: adjustments, error: adjustmentsError } = await this.supabase
      .from('stock_adjustments')
      .select('*');

    if (adjustmentsError) {
      console.error(`Error: Failed to fetch adjustments: ${adjustmentsError.message}`);
    }

    return {
      customers: customers || [],
      items: transformedItems,
      orders: orders || [],
      orderLines: orderLines || [],
      adjustments: adjustments || []
    };
  }
}

export const supabaseService = new SupabaseService();