import React, { useState } from 'react';
import { db } from '../services/db';
import { supabaseService } from '../services/supabase';
import { useToast } from '../context/ToastContext';

export const DatabaseClearButtons: React.FC = () => {
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localConfirmText, setLocalConfirmText] = useState('');
  const [cloudConfirmText, setCloudConfirmText] = useState('');
  const [showLocalConfirm, setShowLocalConfirm] = useState(false);
  const [showCloudConfirm, setShowCloudConfirm] = useState(false);

  const CONFIRMATION_PHRASE = 'DELETE ALL DATA';

  const clearLocalDatabase = async () => {
    if (localConfirmText !== CONFIRMATION_PHRASE) {
      showToast(`Please type "${CONFIRMATION_PHRASE}" to confirm`, 'error');
      return;
    }

    try {
      // Cast to any to access private properties
      const dbAny = db as any;
      
      // Clear all tables in the local database
      await dbAny.db.transaction('rw', [
        dbAny.db.customers,
        dbAny.db.items,
        dbAny.db.orders,
        dbAny.db.settings,
        dbAny.db.stockAdjustments,
        dbAny.db.users
      ], async () => {
        await dbAny.db.customers.clear();
        await dbAny.db.items.clear();
        await dbAny.db.orders.clear();
        await dbAny.db.settings.clear();
        await dbAny.db.stockAdjustments.clear();
        await dbAny.db.users.clear();
      });

      // Clear the in-memory cache
      dbAny.cache.customers = [];
      dbAny.cache.items = [];
      dbAny.cache.orders = [];
      dbAny.cache.adjustments = [];
      dbAny.cache.users = [];
      // Reset settings to default
      dbAny.cache.settings = {
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
      setLocalConfirmText('');
      setShowLocalConfirm(false);
    } catch (error: any) {
      console.error('Error clearing local database:', error);
      showToast('Error clearing local database: ' + error.message, 'error');
    }
  };

  const clearCloudDatabase = async () => {
    if (cloudConfirmText !== CONFIRMATION_PHRASE) {
      showToast(`Please type "${CONFIRMATION_PHRASE}" to confirm`, 'error');
      return;
    }

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
      setCloudConfirmText('');
      setShowCloudConfirm(false);
    } catch (error: any) {
      console.error('Error clearing cloud database:', error);
      showToast('Error clearing cloud database: ' + error.message, 'error');
    }
  };

  return (
    <div className="mt-8 border-2 border-red-300 rounded-xl overflow-hidden bg-red-50/50">
      {/* Header - Click to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-red-100 hover:bg-red-200 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-left">
            <h3 className="font-bold text-red-800 text-lg">Danger Zone</h3>
            <p className="text-red-600 text-sm">
              Destructive actions that cannot be undone
            </p>
          </div>
        </div>
        <svg 
          className={`w-6 h-6 text-red-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content - Hidden by default */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Warning Banner */}
          <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-red-800 font-bold">Warning: Permanent Data Loss</p>
                <p className="text-red-700 text-sm mt-1">
                  These actions will permanently delete all data. This cannot be undone. 
                  Make sure you have a backup before proceeding.
                </p>
              </div>
            </div>
          </div>

          {/* Clear Local Database */}
          <div className="bg-white border border-red-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-red-800">Clear Local Database</h4>
                <p className="text-red-600 text-sm">Delete all data stored on this device</p>
              </div>
              {!showLocalConfirm ? (
                <button
                  onClick={() => setShowLocalConfirm(true)}
                  className="py-2 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-colors text-sm"
                >
                  Show Options
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowLocalConfirm(false);
                    setLocalConfirmText('');
                  }}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold transition-colors text-sm"
                >
                  Cancel
                </button>
              )}
            </div>

            {showLocalConfirm && (
              <div className="mt-4 space-y-3 border-t border-red-100 pt-4">
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-2">
                    Type "{CONFIRMATION_PHRASE}" to confirm:
                  </label>
                  <input
                    type="text"
                    value={localConfirmText}
                    onChange={(e) => setLocalConfirmText(e.target.value)}
                    placeholder={CONFIRMATION_PHRASE}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  />
                </div>
                <button
                  onClick={clearLocalDatabase}
                  disabled={localConfirmText !== CONFIRMATION_PHRASE}
                  className={`w-full py-3 px-4 rounded-lg font-bold transition-colors shadow-md ${
                    localConfirmText === CONFIRMATION_PHRASE
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-200 text-red-400 cursor-not-allowed'
                  }`}
                >
                  Clear Local Database
                </button>
              </div>
            )}
          </div>

          {/* Clear Cloud Database */}
          <div className="bg-white border border-purple-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-purple-800">Clear Cloud Database</h4>
                <p className="text-purple-600 text-sm">Delete all data stored in Supabase cloud</p>
              </div>
              {!showCloudConfirm ? (
                <button
                  onClick={() => setShowCloudConfirm(true)}
                  className="py-2 px-4 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-bold transition-colors text-sm"
                >
                  Show Options
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowCloudConfirm(false);
                    setCloudConfirmText('');
                  }}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold transition-colors text-sm"
                >
                  Cancel
                </button>
              )}
            </div>

            {showCloudConfirm && (
              <div className="mt-4 space-y-3 border-t border-purple-100 pt-4">
                <div>
                  <label className="block text-sm font-medium text-purple-700 mb-2">
                    Type "{CONFIRMATION_PHRASE}" to confirm:
                  </label>
                  <input
                    type="text"
                    value={cloudConfirmText}
                    onChange={(e) => setCloudConfirmText(e.target.value)}
                    placeholder={CONFIRMATION_PHRASE}
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
                <button
                  onClick={clearCloudDatabase}
                  disabled={cloudConfirmText !== CONFIRMATION_PHRASE}
                  className={`w-full py-3 px-4 rounded-lg font-bold transition-colors shadow-md ${
                    cloudConfirmText === CONFIRMATION_PHRASE
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-purple-200 text-purple-400 cursor-not-allowed'
                  }`}
                >
                  Clear Cloud Database
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
