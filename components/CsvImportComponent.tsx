import React, { useState, useRef } from 'react';
import { parseCsv } from '../utils/csv';
import { 
  downloadCsvTemplate, 
  validateCsvAgainstTemplate, 
  CSV_TEMPLATES 
} from '../utils/csv-templates';
import { db } from '../services/db';
import { Customer, Item, Order, CompanySettings } from '../types';
import { generateUUID } from '../utils/uuid';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

interface CsvImportComponentProps {
  onImportComplete?: () => void;
}

export const CsvImportComponent: React.FC<CsvImportComponentProps> = ({ onImportComplete }) => {
  const { showToast } = useToast();
  const { themeClasses } = useTheme();
  const [selectedEntityType, setSelectedEntityType] = useState<string>('items');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    try {
      downloadCsvTemplate(selectedEntityType);
      showToast(`${CSV_TEMPLATES[selectedEntityType].name} template downloaded`, 'success');
    } catch (error) {
      showToast(`Error downloading template: ${(error as Error).message}`, 'error');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setValidationResults(null);

    try {
      // Read and validate the CSV
      const csvText = await file.text();
      const validationResult = validateCsvAgainstTemplate(csvText, selectedEntityType);
      setValidationResults(validationResult);

      if (!validationResult.isValid) {
        showToast(`CSV validation failed: ${validationResult.errors.join('; ')}`, 'error');
        setIsLoading(false);
        return;
      }

      // Parse the CSV
      const data = await parseCsv(file);
      
      // Process the data based on entity type
      let successCount = 0;
      switch (selectedEntityType) {
        case 'customers':
          for (const row of data) {
            if (!row.shop_name) continue; // Skip invalid rows
            
            const newCustomer: Customer = {
              customer_id: row.customer_id || generateUUID(),
              shop_name: row.shop_name || '',
              address: row.address || '',
              phone: row.phone || '',
              email: row.email || '',
              outstanding_balance: parseFloat(row.outstanding_balance) || 0,
              secondary_discount_rate: parseFloat(row.secondary_discount_rate) || 0,
              created_at: row.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              sync_status: row.sync_status || 'pending'
            };

            await db.saveCustomer(newCustomer);
            successCount++;
          }
          break;

        case 'items':
          for (const row of data) {
            if (!row.item_display_name) continue; // Skip invalid rows
            
            const newItem: Item = {
              item_id: row.item_id || generateUUID(),
              item_display_name: row.item_display_name || '',
              item_name: row.item_name || row.item_display_name || '',
              item_number: row.item_number || row.SKU || '',
              vehicle_model: row.vehicle_model || '',
              source_brand: row.source_brand || '',
              category: row.category || 'Uncategorized',
              unit_value: parseFloat(row.unit_value) || 0,
              current_stock_qty: parseInt(row.current_stock_qty) || 0,
              low_stock_threshold: parseInt(row.low_stock_threshold) || 10,
              is_out_of_stock: row.is_out_of_stock === 'true' || row.is_out_of_stock === true,
              status: row.status || 'active',
              created_at: row.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              sync_status: row.sync_status || 'pending'
            };

            await db.saveItem(newItem);
            successCount++;
          }
          break;

        case 'orders':
          for (const row of data) {
            if (!row.customer_id || !row.order_date) continue; // Skip invalid rows
            
            const newOrder: Order = {
              order_id: row.order_id || generateUUID(),
              customer_id: row.customer_id,
              order_date: row.order_date || new Date().toISOString().split('T')[0],
              order_status: row.order_status || 'draft',
              delivery_status: row.delivery_status || 'pending',
              payment_status: row.payment_status || 'unpaid',
              net_total: parseFloat(row.net_total) || 0,
              paid_amount: parseFloat(row.paid_amount) || 0,
              balance_due: parseFloat(row.balance_due) || 0,
              approval_status: row.approval_status || 'draft',
              invoice_number: row.invoice_number || undefined,
              original_invoice_number: row.original_invoice_number || undefined,
              lines: row.lines ? JSON.parse(row.lines) : [],
              payments: row.payments ? JSON.parse(row.payments) : [],
              delivery_notes: row.delivery_notes || '',
              created_at: row.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              sync_status: row.sync_status || 'pending'
            };

            await db.saveOrder(newOrder);
            successCount++;
          }
          break;

        case 'settings':
          if (data.length > 0) {
            const settingsData = data[0]; // Only process the first row for settings (singleton)
            
            const newSettings: CompanySettings = {
              id: settingsData.id || 'main',
              company_name: settingsData.company_name || 'Default Company',
              address: settingsData.address || '',
              phone: settingsData.phone || '',
              email: settingsData.email || '',
              logo_url: settingsData.logo_url || '',
              auto_sku_enabled: settingsData.auto_sku_enabled === 'true',
              stock_tracking_enabled: settingsData.stock_tracking_enabled === 'true',
              category_enabled: settingsData.category_enabled === 'true',
              show_sku_in_item_cards: settingsData.show_sku_in_item_cards === 'true',
              invoice_prefix: settingsData.invoice_prefix || 'INV',
              starting_invoice_number: parseInt(settingsData.starting_invoice_number) || 1,
              show_advanced_sync_options: settingsData.show_advanced_sync_options === 'true',
              created_at: settingsData.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              sync_status: settingsData.sync_status || 'pending'
            };

            await db.saveSettings(newSettings);
            successCount = 1; // Only one settings object
          }
          break;
      }

      showToast(`Successfully imported ${successCount} ${selectedEntityType}`, 'success');
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error("CSV import failed:", error);
      showToast(`Failed to import CSV: ${(error as Error).message}`, 'error');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className={`font-bold ${themeClasses.textDark} mb-3 flex items-center gap-2`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        CSV Import
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Data Type</label>
          <select
            value={selectedEntityType}
            onChange={(e) => setSelectedEntityType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CSV_TEMPLATES).map(([key, template]) => (
              <option key={key} value={key}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className={`flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors ${themeClasses.text}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </button>

          <label className={`flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-50 transition-colors ${themeClasses.text}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Choose File
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-600">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
            Processing CSV file...
          </div>
        )}

        {validationResults && (
          <div className={`p-3 rounded-lg text-sm ${validationResults.isValid ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            <div className="font-medium mb-1">
              {validationResults.isValid ? '✓ Validation Successful' : '✗ Validation Failed'}
            </div>
            {validationResults.errors.length > 0 && (
              <div className="mb-2">
                <div className="font-medium text-rose-700">Errors:</div>
                <ul className="list-disc list-inside ml-4">
                  {validationResults.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {validationResults.warnings.length > 0 && (
              <div>
                <div className="font-medium text-amber-700">Warnings:</div>
                <ul className="list-disc list-inside ml-4">
                  {validationResults.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-slate-500">
          <p className="font-medium mb-1">Template Info:</p>
          <p>{CSV_TEMPLATES[selectedEntityType].description}</p>
        </div>
      </div>
    </div>
  );
};