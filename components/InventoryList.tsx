import React, { useState, useEffect } from 'react';
import { Item, StockAdjustment } from '../types';
import { db } from '../services/database';
import { generateUUID } from '../utils/uuid';
import { formatCurrency } from '../utils/currency';
import { generateSKU } from '../utils/skuGenerator';
import { parseCsv } from '../utils/csv';
import { useToast } from '../context/ToastContext';
import { cleanText } from '../utils/cleanText';
import { useTheme } from '../context/ThemeContext';
import { InventorySkeleton } from './ui/skeletons/ListSkeletons';
import { CsvImportComponent } from './CsvImportComponent';

import { Modal } from './ui/Modal';

export const InventoryList: React.FC = () => {
  const { themeClasses } = useTheme();
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false); // Mobile filter toggle
  const [modelFilter, setModelFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'A-Z' | 'High-Low' | 'Low-High'>('A-Z');
  
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
      isOpen: boolean, 
      title: string, 
      message: string, 
      type: 'info' | 'danger' | 'success',
      onConfirm?: () => void,
      onCancel?: () => void,
      confirmText?: string
  } | null>(null);
  
  // State
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newItem, setNewItem] = useState<Partial<Item>>({});
  const [skuLocked, setSkuLocked] = useState(true);
  
  // Adjustment State
  const [adjustItem, setAdjustItem] = useState<Item | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'restock' | 'damage'>('restock');
  const [adjustReason, setAdjustReason] = useState('');
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const settings = db.getSettings();

  useEffect(() => {
    // Simulate loading for better UX perception
    const loadData = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 400)); 
        setItems(db.getItems());
        setIsLoading(false);
    };
    loadData();
  }, []);

  const categories = ['All', settings.stock_tracking_enabled ? 'Low Stock' : 'Out of Stock', ...Array.from(new Set(items.map(i => i.category || 'Uncategorized')))].filter(Boolean) as string[];

  // Helper for Stock Visuals
  const getStockStatus = (qty: number, threshold: number) => {
      if (qty <= 0) return { color: 'bg-rose-500', text: 'text-rose-600', label: 'Out of Stock', bg: 'bg-rose-50' };
      if (qty <= threshold) return { color: 'bg-amber-500', text: 'text-amber-600', label: 'Low Stock', bg: 'bg-amber-50' };
      return { color: 'bg-emerald-500', text: 'text-emerald-600', label: 'In Stock', bg: 'bg-emerald-50' };
  };

  const showAlert = (title: string, message: string, type: 'info' | 'danger' | 'success' = 'info') => {
      setAlertConfig({ isOpen: true, title, message, type });
  };

  const closeAddForm = () => {
      setShowAddForm(false);
      setEditingItem(null);
      setNewItem({});
      setSkuLocked(true);
  };

  const handleSaveItem = async () => {
    if (!newItem.item_display_name || !newItem.item_number || !newItem.unit_value) {
        showToast("Name, SKU, and Price are required", "error");
        return;
    }

    // Duplicate Check: Same Name + Same Model + Same Country
    const isDuplicate = items.some(i => 
        i.item_id !== editingItem?.item_id && // Ignore self
        i.item_display_name.toLowerCase() === newItem.item_display_name?.toLowerCase() &&
        i.vehicle_model.toLowerCase() === newItem.vehicle_model?.toLowerCase() &&
        i.source_brand.toLowerCase() === newItem.source_brand?.toLowerCase()
    );

    if (isDuplicate) {
        showToast("An item with this Name, Model, and Country already exists.", "error");
        return;
    }

    const item: Item = editingItem ? {
        ...editingItem,
        item_display_name: newItem.item_display_name || editingItem.item_display_name,
        item_name: newItem.item_name || editingItem.item_name,
        item_number: newItem.item_number || editingItem.item_number,
        vehicle_model: newItem.vehicle_model || editingItem.vehicle_model,
        source_brand: newItem.source_brand || editingItem.source_brand,
        category: newItem.category || editingItem.category || 'Uncategorized',
        unit_value: newItem.unit_value ?? editingItem.unit_value,
        current_stock_qty: newItem.current_stock_qty ?? editingItem.current_stock_qty,
        low_stock_threshold: newItem.low_stock_threshold ?? editingItem.low_stock_threshold ?? 10,
        is_out_of_stock: newItem.is_out_of_stock ?? editingItem.is_out_of_stock,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
    } : {
      item_id: generateUUID(),
      item_display_name: newItem.item_display_name || '',
      item_name: newItem.item_name || newItem.item_display_name || '',
      item_number: newItem.item_number || '',
      vehicle_model: newItem.vehicle_model || '',
      source_brand: newItem.source_brand || '',
      category: newItem.category || 'Uncategorized',
      unit_value: newItem.unit_value || 0,
      current_stock_qty: newItem.current_stock_qty || 0,
      low_stock_threshold: newItem.low_stock_threshold || 10,
      is_out_of_stock: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    await db.saveItem(item);
    setItems([...db.getItems()]); // Spread to force new array reference for React
    showToast(editingItem ? "Item updated" : "Item added to stock", "success");
    closeAddForm();
  };

  const handleDescriptionBlur = () => {
      if (!settings.auto_sku_enabled) return;
      if (editingItem) return; 
      if (!newItem.item_display_name) return;

      const existingSKUs = items.map(i => i.item_number);
      const generated = generateSKU(newItem.item_display_name, existingSKUs);
      setNewItem(prev => ({ ...prev, item_number: generated }));
  };

  const startEdit = (item: Item) => {
      setEditingItem(item);
      setNewItem(item);
      setSkuLocked(true); // Always lock by default when editing
      setShowAddForm(true);
  };

  const toggleStockFlag = async (e: React.MouseEvent, item: Item) => {
      e.stopPropagation();
      
      const action = item.is_out_of_stock ? 'In Stock' : 'Out of Stock';
      
      setAlertConfig({
          isOpen: true,
          title: `Mark as ${action}?`,
          message: `Are you sure you want to mark "${cleanText(item.item_display_name)}" as ${action}?`,
          type: item.is_out_of_stock ? 'success' : 'danger',
          onConfirm: async () => {
              const updatedItem: Item = { 
                  ...item, 
                  is_out_of_stock: !item.is_out_of_stock, 
                  sync_status: 'pending' as const, 
                  updated_at: new Date().toISOString() 
              };
              
              // 1. Update Database
              await db.saveItem(updatedItem);
              
               // 2. Immediate UI Update (Local State)
               setItems(prev => prev.map(i => i.item_id === item.item_id ? updatedItem : i));
               showToast(`Marked as ${action}`, "info");
               
               setAlertConfig(null);

          },
          onCancel: () => setAlertConfig(null)
      });
  };

  const openAdjustModal = (e: React.MouseEvent, item: Item) => {
      e.stopPropagation();
      setAdjustItem(item);
      setAdjustQty('');
      setAdjustType('restock');
      setAdjustReason('');
      setShowAdjustModal(true);
  };

  const handleSaveAdjustment = async () => {
      if (!adjustItem || !adjustQty) return;
      const qty = parseInt(adjustQty);
      if (isNaN(qty) || qty <= 0) {
          showToast("Please enter a valid quantity", "warning");
          return;
      }

      const adjustment: StockAdjustment = {
          adjustment_id: generateUUID(),
          item_id: adjustItem.item_id,
          adjustment_type: adjustType,
          quantity: qty,
          reason: adjustReason || (adjustType === 'restock' ? 'Manual Restock' : 'Damage/Loss'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
      };

      await db.addStockAdjustment(adjustment);
      setItems([...db.getItems()]);
      showToast("Stock level adjusted", "success");
      setShowAdjustModal(false);
      setAdjustItem(null);
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    
    setAlertConfig({
        isOpen: true,
        title: "Delete Item?",
        message: "Are you sure you want to delete this item? It will be marked as inactive.",
        type: 'danger',
        confirmText: "Delete",
        onConfirm: async () => {
            await db.deleteItem(editingItem.item_id);
            setItems([...db.getItems()]);
            closeAddForm();
            setAlertConfig(null);
        },
        onCancel: () => setAlertConfig(null)
    });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      try {
          const data = await parseCsv(file);
          let successCount = 0;

          for (const row of data) {
              // Basic Validation
              if (!row.item_display_name && !row.Name && !row.name) continue;

              const newItem: Item = {
                  item_id: generateUUID(),
                  item_display_name: row.item_display_name || row.Name || row.name || '',
                  item_name: row.item_name || row.InternalName || row.item_display_name || row.Name || '',
                  item_number: row.item_number || row.SKU || row.sku || '',
                  vehicle_model: row.vehicle_model || row.Model || row.model || '',
                  source_brand: row.source_brand || row.Brand || row.brand || '',
                  category: row.category || row.Category || 'Uncategorized',
                  unit_value: parseFloat(row.unit_value || row.Price || row.price || '0'),
                  current_stock_qty: parseInt(row.current_stock_qty || row.Qty || row.quantity || '0'),
                  low_stock_threshold: parseInt(row.low_stock_threshold || row.Limit || '10'),
                  is_out_of_stock: (row.current_stock_qty || row.Qty || 0) <= 0,
                  status: 'active',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  sync_status: 'pending'
              };

              await db.saveItem(newItem);
              successCount++;
          }

          setItems(db.getItems());
          showToast(`Successfully imported ${successCount} items`, "success");
      } catch (error) {
          console.error("Import failed:", error);
          showToast("Failed to import CSV file", "error");
      } finally {
          setIsLoading(false);
          if (fileInputRef.current) {
              fileInputRef.current.value = '';
          }
      }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_display_name.toLowerCase().includes(filter.toLowerCase()) ||
        item.item_number.toLowerCase().includes(filter.toLowerCase());
    
    const matchesModel = !modelFilter || item.vehicle_model.toLowerCase().includes(modelFilter.toLowerCase());
    const matchesCountry = !countryFilter || (item.source_brand && item.source_brand.toLowerCase().includes(countryFilter.toLowerCase()));

    let matchesCategory = true;
    if (categoryFilter === 'Low Stock') {
        matchesCategory = item.current_stock_qty <= item.low_stock_threshold;
    } else if (categoryFilter === 'Out of Stock') {
        matchesCategory = item.is_out_of_stock === true;
    } else if (categoryFilter !== 'All') {
        matchesCategory = item.category === categoryFilter;
    }
    
    return matchesSearch && matchesModel && matchesCountry && matchesCategory && item.status !== 'inactive';
  }).sort((a, b) => {
      if (sortOrder === 'A-Z') return a.item_display_name.localeCompare(b.item_display_name);
      if (sortOrder === 'High-Low') return b.current_stock_qty - a.current_stock_qty;
      if (sortOrder === 'Low-High') return a.current_stock_qty - b.current_stock_qty;
      return 0;
  });


  return (
    <div className="space-y-4 pb-20 md:pb-0">
      
      {/* Header & Search */}
      <div className="bg-white p-2 md:p-4 rounded-xl md:rounded-3xl shadow-sm border border-slate-200 sticky top-0 z-10 space-y-2 md:space-y-4">
         <div className="flex gap-2 items-center">
            <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
                <input 
                    type="text"
                    placeholder="Search..."
                    className={`block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 ${themeClasses.ring} transition-all shadow-sm text-sm`}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>
            
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`md:hidden p-2 rounded-lg border transition-colors ${showFilters ? `${themeClasses.bgSoft} ${themeClasses.text} ${themeClasses.border}` : 'bg-white border-slate-300 text-slate-500'}`}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </button>
            <button 
                onClick={() => setShowAddForm(true)}
                className={`md:hidden ${themeClasses.bg} text-white p-2 rounded-lg ${themeClasses.bgHover} shadow-sm transition-all active:scale-95`}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            </button>

            <div className={`hidden md:flex gap-3 animate-in slide-in-from-top-2 md:animate-none`}>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <input 
                        placeholder="Model" 
                        className="w-full md:w-32 px-3 py-2 bg-transparent text-sm font-medium focus:outline-none"
                        value={modelFilter}
                        onChange={e => setModelFilter(e.target.value)}
                    />
                    <div className="w-px h-6 bg-slate-300"></div>
                    <input 
                        placeholder="Origin" 
                        className="w-full md:w-32 px-3 py-2 bg-transparent text-sm font-medium focus:outline-none"
                        value={countryFilter}
                        onChange={e => setCountryFilter(e.target.value)}
                    />
                </div>
                <select 
                    className={`w-32 md:flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none shrink-0`}
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as 'A-Z' | 'High-Low' | 'Low-High')}
                >
                    <option value="A-Z">Name A-Z</option>
                    <option value="Price-High">Price High</option>
                    <option value="Price-Low">Price Low</option>
                </select>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv" 
                    onChange={handleImportCSV} 
                />
                
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`hidden md:flex bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95 items-center gap-2 font-bold text-sm shrink-0`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Import CSV
                </button>

                <button 
                    onClick={() => setShowAddForm(true)}
                    className={`hidden md:flex ${themeClasses.bg} text-white px-6 py-2 rounded-xl ${themeClasses.bgHover} shadow-md transition-all active:scale-95 items-center gap-2 font-bold text-sm shrink-0`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Add Item
                </button>
            </div>
         </div>

         {/* Mobile Filters (Collapsible) */}
         {showFilters && (
            <div className="md:hidden grid grid-cols-2 gap-2 animate-in slide-in-from-top-1">
                <input
                    placeholder="Model"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none"
                    value={modelFilter}
                    onChange={e => setModelFilter(e.target.value)}
                />
                <input
                    placeholder="Origin"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none"
                    value={countryFilter}
                    onChange={e => setCountryFilter(e.target.value)}
                />
                <select
                    className="w-full col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-600 focus:outline-none"
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as 'A-Z' | 'High-Low' | 'Low-High')}
                >
                    <option value="A-Z">Sort by Name (A-Z)</option>
                    <option value="High-Low">Stock: High to Low</option>
                    <option value="Low-High">Stock: Low to High</option>
                </select>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full col-span-2 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-600 flex items-center justify-center gap-2"
                >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     Import Items CSV
                </button>
            </div>
         )}

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {settings.category_enabled && categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all ${
                        categoryFilter === cat 
                        ? `${themeClasses.bg} text-white ${themeClasses.border.replace('200', '600')} shadow-sm` 
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                >
                    {cat}
                </button>
            ))}
            {!settings.category_enabled && (
                <button
                    onClick={() => setCategoryFilter(categoryFilter === 'All' ? (settings.stock_tracking_enabled ? 'Low Stock' : 'Out of Stock') : 'All')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all ${
                        categoryFilter !== 'All' 
                        ? `${themeClasses.bg} text-white ${themeClasses.border.replace('200', '600')} shadow-sm` 
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                >
                    {categoryFilter === 'All' ? (settings.stock_tracking_enabled ? 'Filter: Low Stock' : 'Filter: Out of Stock') : 'Show All'}
                </button>
            )}
          </div>
          
          <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 font-medium uppercase tracking-wider">
            <span>{filteredItems.length} Products</span>
            <span>Live Inventory</span>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-lg h-[90vh] md:h-auto md:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in duration-200">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">{editingItem ? 'Edit Item' : 'New Spare Part'}</h3>
                    <button onClick={closeAddForm} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-rose-500 shadow-sm border border-slate-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Display Name *</label>
                        <input 
                            className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`}
                            value={newItem.item_display_name || ''} 
                            onChange={e => setNewItem({...newItem, item_display_name: e.target.value})} 
                            onBlur={handleDescriptionBlur}
                            placeholder="e.g. Brake Pad (Toyota Corolla)" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">SKU / Item No *</label>
                            <div className="relative">
                                <input 
                                    className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none pr-10 text-sm font-mono font-bold ${skuLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`} 
                                    value={newItem.item_number || ''} 
                                    onChange={e => setNewItem({...newItem, item_number: e.target.value})} 
                                    placeholder="e.g. BP-102"
                                    readOnly={skuLocked}
                                />
                                <button 
                                    type="button"
                                    onClick={() => setSkuLocked(!skuLocked)}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:${themeClasses.text} hover:bg-slate-100 transition-colors`}
                                >
                                    {skuLocked ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Internal Name</label>
                            <input className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newItem.item_name || ''} onChange={e => setNewItem({...newItem, item_name: e.target.value})} placeholder="e.g. Brake Pad" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Vehicle Model</label>
                            <input className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newItem.vehicle_model || ''} onChange={e => setNewItem({...newItem, vehicle_model: e.target.value})} placeholder="e.g. Corolla 2018" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Origin / Brand</label>
                            <input className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newItem.source_brand || ''} onChange={e => setNewItem({...newItem, source_brand: e.target.value})} placeholder="e.g. Toyota / China" />
                        </div>
                    </div>
                    {settings.category_enabled && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Category</label>
                                <input className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newItem.category || ''} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="e.g. Engine" />
                            </div>
                            {settings.stock_tracking_enabled && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Low Limit</label>
                                    <input type="number" className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newItem.low_stock_threshold || ''} onChange={e => setNewItem({...newItem, low_stock_threshold: parseInt(e.target.value)})} placeholder="10" />
                                </div>
                            )}
                        </div>
                    )}
                    {!settings.category_enabled && settings.stock_tracking_enabled && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Low Stock Limit</label>
                            <input type="number" className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newItem.low_stock_threshold || ''} onChange={e => setNewItem({...newItem, low_stock_threshold: parseInt(e.target.value)})} placeholder="10" />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Unit Price *</label>
                            <input type="number" className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-bold ${themeClasses.text}`} value={newItem.unit_value || ''} onChange={e => setNewItem({...newItem, unit_value: parseFloat(e.target.value)})} placeholder="0.00" />
                        </div>
                        {settings.stock_tracking_enabled && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Opening Stock</label>
                                <input type="number" className={`w-full p-3 border border-slate-300 rounded-xl focus:ring-2 ${themeClasses.ring} outline-none text-sm font-bold`} value={newItem.current_stock_qty || ''} onChange={e => setNewItem({...newItem, current_stock_qty: parseInt(e.target.value)})} placeholder="0" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 md:p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0 pb-safe">
                    {editingItem && (
                        <button onClick={handleDeleteItem} className="bg-rose-100 text-rose-600 px-4 py-3.5 rounded-xl font-bold hover:bg-rose-200 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                    <button onClick={handleSaveItem} className={`flex-1 ${themeClasses.bg} text-white py-3.5 rounded-xl font-bold ${themeClasses.bgHover} shadow-lg active:scale-95 transition-transform`}>{editingItem ? 'Update Item' : 'Add to Stock'}</button>
                    <button onClick={closeAddForm} className="flex-1 bg-white text-slate-700 border border-slate-300 py-3.5 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition-transform">Cancel</button>
                </div>

            </div>
        </div>
      )}
      
      {/* Mobile Card View (default on small) / Desktop Table (default on large) */}
      {isLoading ? (
          <div className="hidden md:block">
              <InventorySkeleton />
          </div>
      ) : (
      <div className="hidden md:block bg-white shadow-sm rounded-3xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Details</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                        {settings.stock_tracking_enabled && (
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-48">Stock Health</th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                    {filteredItems.map(item => {
                        const status = getStockStatus(item.current_stock_qty, item.low_stock_threshold);
                        return (
                        <tr key={item.item_id} className={`hover:bg-slate-50 transition-colors cursor-pointer group`} onClick={() => startEdit(item)}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${status.bg} ${status.text}`}>
                                        {item.item_display_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold leading-tight ${item.is_out_of_stock ? 'text-rose-600 line-through decoration-2' : 'text-slate-900 group-hover:text-indigo-600 transition-colors'}`}>{cleanText(item.item_display_name)}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-black ${themeClasses.text} ${themeClasses.bgSoft} px-1.5 py-0.5 rounded uppercase tracking-tighter`}>{cleanText(item.vehicle_model)}</span>
                                            <span className="text-[10px] text-slate-400 font-mono tracking-wider">{cleanText(item.item_number)}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{cleanText(item.source_brand)}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black text-slate-900">
                                {formatCurrency(item.unit_value)}
                            </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                    {!settings.stock_tracking_enabled && (
                                        <button 
                                            onClick={(e) => toggleStockFlag(e, item)}
                                            className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border transition-all ${
                                                item.is_out_of_stock 
                                                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                            }`}
                                        >
                                            {item.is_out_of_stock ? 'Out of Stock' : 'In Stock'}
                                        </button>
                                    )}
                                    {settings.stock_tracking_enabled && (
                                        <div className="w-full">
                                            <div className="flex justify-end items-center gap-2 mb-1.5">
                                                <span className={`text-[10px] font-black uppercase ${status.text}`}>{status.label}</span>
                                                <span className="text-xs font-bold text-slate-900">{item.current_stock_qty}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${status.color} rounded-full transition-all duration-500`} 
                                                    style={{ width: `${Math.min((item.current_stock_qty / (item.low_stock_threshold * 3)) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(e) => openAdjustModal(e, item)}
                                                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 underline"
                                                >
                                                    Adjust Stock
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
      </div>
      )}

      {/* Mobile Stacked List (Compact for Keyboard Visibility) */}
      {isLoading ? (
          <div className="md:hidden">
              <InventorySkeleton />
          </div>
      ) : (
      <div className="md:hidden bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
        {filteredItems.map(item => {
            const status = getStockStatus(item.current_stock_qty, item.low_stock_threshold);
            return (
            <div key={item.item_id} onClick={() => startEdit(item)} className="p-2.5 active:bg-slate-50 transition-colors relative group">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <h4 className={`text-xs font-bold truncate ${item.is_out_of_stock ? 'text-rose-600 line-through decoration-1 opacity-70' : 'text-slate-900'}`}>
                                {cleanText(item.item_display_name)}
                            </h4>
                            {item.is_out_of_stock && <span className="text-[9px] font-black text-rose-500 uppercase">OOS</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="font-mono bg-slate-50 px-1 rounded border border-slate-100">{cleanText(item.item_number)}</span>
                            <span>•</span>
                            <span className={`font-bold uppercase ${themeClasses.text}`}>{cleanText(item.vehicle_model)}</span>
                            <span>•</span>
                            <span>{cleanText(item.source_brand)}</span>
                        </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                        <span className="block text-xs font-black text-slate-900">{formatCurrency(item.unit_value, false)}</span>
                        {settings.stock_tracking_enabled ? (
                            <div className="flex items-center justify-end gap-1 mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${status.color.replace('bg-', 'bg-')}`}></div>
                                <span className={`text-[10px] font-bold ${status.text}`}>{item.current_stock_qty}</span>
                            </div>
                        ) : (
                            <button 
                                onClick={(e) => toggleStockFlag(e, item)}
                                className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${item.is_out_of_stock ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                            >
                                {item.is_out_of_stock ? 'Hidden' : 'Active'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )})}
        
        {filteredItems.length === 0 && (
            <div className="py-8 text-center">
                <p className="text-xs text-slate-400">No items found</p>
                <button onClick={() => setShowAddForm(true)} className={`mt-2 ${themeClasses.text} font-bold text-xs underline`}>
                    Add New?
                </button>
            </div>
        )}
      </div>
      )}




      {/* Adjustment Modal */}
      {showAdjustModal && adjustItem && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100">
                      <h3 className="text-lg font-bold text-slate-800">Adjust Stock</h3>
                      <p className="text-sm text-slate-500">{cleanText(adjustItem.item_display_name)}</p>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button 
                              onClick={() => setAdjustType('restock')}
                              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adjustType === 'restock' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                          >
                              + Restock
                          </button>
                          <button 
                              onClick={() => setAdjustType('damage')}
                              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adjustType === 'damage' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                          >
                              - Damage/Loss
                          </button>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                          <input 
                              type="number" 
                              className={`w-full p-3 border-2 border-slate-200 rounded-xl text-2xl font-bold focus:${themeClasses.border.replace('200', '500')} focus:outline-none`}
                              value={adjustQty}
                              onChange={e => setAdjustQty(e.target.value)}
                              autoFocus
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason (Optional)</label>
                          <input 
                              className={`w-full p-3 border border-slate-200 rounded-xl text-sm focus:${themeClasses.border.replace('200', '500')} focus:outline-none`}
                              value={adjustReason}
                              onChange={e => setAdjustReason(e.target.value)}
                              placeholder="e.g. New shipment arrived"
                          />
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                      <button onClick={handleSaveAdjustment} className={`flex-1 ${themeClasses.bg} text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform`}>
                          Confirm Adjustment
                      </button>
                      <button onClick={() => setShowAdjustModal(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Alert Modal */}
      {alertConfig && (
          <Modal 
            isOpen={alertConfig.isOpen}
            title={alertConfig.title}
            message={alertConfig.message}
            type={alertConfig.type}
            onConfirm={alertConfig.onConfirm || (() => setAlertConfig(null))}
            onCancel={alertConfig.onCancel || (() => setAlertConfig(null))}
            confirmText={alertConfig.confirmText || "OK"}
          />
      )}
      
      {/* CSV Import Component for other entities */}
      <div className="mt-6">
        <CsvImportComponent onImportComplete={() => setItems(db.getItems())} />
      </div>
    </div>
  );
};