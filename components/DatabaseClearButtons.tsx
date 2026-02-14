import React from 'react';
import { db } from '../services/db';
import { supabaseService } from '../services/supabase';
import { useToast } from '../context/ToastContext';

export const DatabaseClearButtons: React.FC = () => {
  const { showToast } = useToast();

  const clearLocalDatabase = async () => {
    if (window.confirm('Are you sure you want to clear the local database? This will delete all local data.')) {
      try {
        // Clear all tables in the local database
        await db.db.transaction('rw', [
          db.db.customers,
          db.db.items,
          db.db.orders,
          db.db.settings,
          db.db.stockAdjustments,
          db.db.users
        ], async () => {
          await db.db.customers.clear();
          await db.db.items.clear();
          await db.db.orders.clear();
          await db.db.settings.clear();
          await db.db.stockAdjustments.clear();
          await db.db.users.clear();
        });

        // Clear the in-memory cache
        db.cache.customers = [];
        db.cache.items = [];
        db.cache.orders = [];
        db.cache.adjustments = [];
        db.cache.users = [];
        // Reset settings to default
        db.cache.settings = {
          company_name: '',
          address: '',
          phone: '',
          rep_name: '',
          invoice_prefix: 'INV',
          starting_invoice_number: 1,
          footer_note: 'Thank you for your business. Goods once sold cannot be returned.',
          currency_symbol: 'Rs.',
          auto_sku_enabled: true,
          stock_tracking_enabled: false,
          category_enabled: false,
          show_sku_in_item_cards: false,
          show_advanced_sync_options: false
        };

        showToast('Local database cleared successfully!', 'success');
      } catch (error: any) {
        console.error('Error clearing local database:', error);
        showToast('Error clearing local database: ' + error.message, 'error');
      }
    }
  };

  const clearCloudDatabase = async () => {
    if (window.confirm('Are you sure you want to clear the cloud database? This will delete all data in Supabase.')) {
      try {
        const supabaseClient = supabaseService.getSupabaseClient();

        // Clear all tables in the cloud database
        // Delete all records - use .neq to match all records
        const { error: customersError } = await supabaseClient
          .from('customers')
          .delete()
          .neq('customer_id', ''); // Match all records

        if (customersError) {
          throw new Error(`Error clearing customers: ${customersError.message}`);
        }

        const { error: itemsError } = await supabaseClient
          .from('items')
          .delete()
          .neq('item_id', ''); // Match all records

        if (itemsError) {
          throw new Error(`Error clearing items: ${itemsError.message}`);
        }

        const { error: ordersError } = await supabaseClient
          .from('orders')
          .delete()
          .neq('order_id', ''); // Match all records

        if (ordersError) {
          throw new Error(`Error clearing orders: ${ordersError.message}`);
        }

        const { error: usersError } = await supabaseClient
          .from('users')
          .delete()
          .neq('id', ''); // Match all records

        if (usersError) {
          throw new Error(`Error clearing users: ${usersError.message}`);
        }

        const { error: adjustmentsError } = await supabaseClient
          .from('stock_adjustments')
          .delete()
          .neq('adjustment_id', ''); // Match all records

        if (adjustmentsError) {
          throw new Error(`Error clearing adjustments: ${adjustmentsError.message}`);
        }

        // For settings, we'll reset to default values rather than delete
        // First, try to delete the existing settings record
        const { error: settingsDeleteError } = await supabaseClient
          .from('settings')
          .delete()
          .eq('id', 'main');

        if (settingsDeleteError) {
          console.warn(`Warning: Could not delete settings: ${settingsDeleteError.message}`);
          // Continue anyway, as we'll try to insert a new one
        }

        // Then insert the default settings
        const defaultSettings = {
          id: 'main',
          company_name: 'Default Company',
          rep_name: 'Default Rep',
          invoice_prefix: 'INV',
          starting_invoice_number: 1,
          footer_note: 'Thank you for your business. Goods once sold cannot be returned.',
          currency_symbol: 'Rs.',
          auto_sku_enabled: true,
          stock_tracking_enabled: false,
          category_enabled: false,
          show_sku_in_item_cards: false,
          show_advanced_sync_options: false
        };

        const { error: settingsInsertError } = await supabaseClient
          .from('settings')
          .insert(defaultSettings)
          .select();

        if (settingsInsertError) {
          // If insert fails, try upsert as fallback
          const { error: settingsUpsertError } = await supabaseClient
            .from('settings')
            .upsert(defaultSettings, { onConflict: 'id' });
            
          if (settingsUpsertError) {
            throw new Error(`Error resetting settings: ${settingsUpsertError.message}`);
          }
        }

        showToast('Cloud database cleared successfully!', 'success');
      } catch (error: any) {
        console.error('Error clearing cloud database:', error);
        showToast('Error clearing cloud database: ' + error.message, 'error');
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-red-50 border border-red-200 rounded-xl mt-6">
      <h3 className="font-bold text-red-800 text-lg">Danger Zone</h3>
      <p className="text-red-600 text-sm">
        These actions will permanently delete data. Use with caution!
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={clearLocalDatabase}
          className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors shadow-md"
        >
          Clear Local Database
        </button>
        
        <button
          onClick={clearCloudDatabase}
          className="py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors shadow-md"
        >
          Clear Cloud Database
        </button>
      </div>
    </div>
  );
};