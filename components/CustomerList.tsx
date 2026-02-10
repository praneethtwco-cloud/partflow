import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { db } from '../services/db';
import { generateUUID } from '../utils/uuid';
import { formatCurrency } from '../utils/currency';
import { useToast } from '../context/ToastContext';
import { cleanText } from '../utils/cleanText';
import { useTheme } from '../context/ThemeContext';
import { Modal } from './ui/Modal';

interface CustomerListProps {
  onSelectCustomer: (customer: Customer) => void;
  onOpenProfile?: (customer: Customer) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({ onSelectCustomer, onOpenProfile }) => {
  const { themeClasses } = useTheme();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionCustomer, setActionCustomer] = useState<Customer | null>(null);
  const [showAdminActions, setShowAdminActions] = useState(false);
  
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});
  const [showPassModal, setShowPassModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  useEffect(() => {
    setCustomers(db.getCustomers());
  }, []);

  const handleSaveCustomer = async () => {
    if (!newCustomer.shop_name || !newCustomer.city_ref) {
        showToast("Shop Name and City are required", "error");
        return;
    }

    const customer: Customer = editingCustomer ? {
        ...editingCustomer,
        shop_name: newCustomer.shop_name || editingCustomer.shop_name,
        address: newCustomer.address || editingCustomer.address,
        phone: newCustomer.phone || editingCustomer.phone,
        city_ref: newCustomer.city_ref || editingCustomer.city_ref,
        discount_rate: (newCustomer.discount_rate ?? (editingCustomer.discount_rate * 100)) / 100,
        secondary_discount_rate: (newCustomer.secondary_discount_rate ?? ((editingCustomer.secondary_discount_rate || 0) * 100)) / 100,
        credit_period: newCustomer.credit_period ?? editingCustomer.credit_period ?? 90,
        credit_limit: newCustomer.credit_limit ?? editingCustomer.credit_limit ?? 0,
        status: newCustomer.status || editingCustomer.status,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
    } : {
      customer_id: generateUUID(),
      shop_name: newCustomer.shop_name || '',
      address: newCustomer.address || '',
      phone: newCustomer.phone || '',
      city_ref: newCustomer.city_ref || '',
        discount_rate: (newCustomer.discount_rate || 0) / 100,
        secondary_discount_rate: (newCustomer.secondary_discount_rate || 0) / 100,
        credit_period: newCustomer.credit_period || 90,
        credit_limit: newCustomer.credit_limit || 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
    };

    await db.saveCustomer(customer);
    setCustomers([...db.getCustomers()]);
    showToast(editingCustomer ? "Shop details updated" : "New shop registered", "success");
    setShowAddForm(false);
    setEditingCustomer(null);
    setNewCustomer({});
  };

  const startEdit = (e: React.MouseEvent, customer: Customer) => {
      e.stopPropagation();
      setEditingCustomer(customer);
      setNewCustomer({
          ...customer,
          discount_rate: customer.discount_rate * 100,
          secondary_discount_rate: (customer.secondary_discount_rate || 0) * 100
      });
      setShowAddForm(true);
  };

  const toggleCustomerStatus = async (customer: Customer) => {
      const updatedStatus: 'active' | 'inactive' = customer.status === 'active' ? 'inactive' : 'active';
      const updatedCustomer: Customer = { 
          ...customer, 
          status: updatedStatus, 
          sync_status: 'pending' as const 
      };
      await db.saveCustomer(updatedCustomer);
      setCustomers([...db.getCustomers()]);
      showToast(`Shop ${updatedStatus}`, "info");
      setActionCustomer(null);
  };

  const handleDeleteCustomer = async (customer: Customer) => {
      setConfirmConfig({
          isOpen: true,
          title: "Delete Shop?",
          message: `Are you sure you want to delete ${cleanText(customer.shop_name)}?`,
          onConfirm: async () => {
              try {
                  await db.deleteCustomer(customer.customer_id);
                  setCustomers([...db.getCustomers()]);
                  setActionCustomer(null);
                  setConfirmConfig(null);
              } catch (e: any) {
                  showToast(e.message, "error");
                  setConfirmConfig(null);
              }
          }
      });
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.city_ref.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (showInactive) return matchesSearch;
    return matchesSearch && c.status === 'active';
  });

  // Helper for avatars
  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      
      {/* Search & Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center sticky top-0 bg-slate-50 pt-2 pb-2 z-10">
        <div className="relative w-full md:w-96 group flex items-center gap-2">
            <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className={`h-5 w-5 text-slate-400 group-focus-within:${themeClasses.text}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
                <input 
                    type="text"
                    placeholder="Search shops or cities..."
                    className={`block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 ${themeClasses.ring} focus:border-transparent transition-shadow shadow-sm`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={() => setShowInactive(!showInactive)}
                className={`p-3 rounded-xl border transition-all ${showInactive ? `${themeClasses.bg} text-white ${themeClasses.border} shadow-md` : `bg-white text-slate-400 border-slate-300 hover:${themeClasses.border}`}`}
                title={showInactive ? "Showing All Shops" : "Showing Active Only"}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.882 9.882L5.146 5.146m13.708 13.708L15.146 15.146M21 12a9 9 0 01-1.391 4.876m-9.474-9.474L3 3m18 18l-3-3" /></svg>
            </button>
        </div>
        <button 
            onClick={() => setShowAddForm(true)}
            className={`hidden md:flex ${themeClasses.bg} ${themeClasses.bgHover} text-white px-5 py-3 rounded-xl font-semibold shadow-md transition-transform active:scale-95 items-center space-x-2`}
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            <span>New Customer</span>
        </button>
      </div>

      {/* Mobile FAB */}
      <button 
        onClick={() => setShowAddForm(true)}
        className={`md:hidden fixed bottom-20 right-4 w-14 h-14 ${themeClasses.bg} rounded-full text-white shadow-lg flex items-center justify-center z-40 active:bg-indigo-700`}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
      </button>

        {/* Customer Action Sheet */}
      {actionCustomer && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4" onClick={() => { setActionCustomer(null); setShowAdminActions(false); }}>
              <div className="bg-white w-full max-w-sm rounded-t-3xl md:rounded-2xl p-6 pb-24 md:pb-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="text-center mb-6">
                      <div className={`w-16 h-16 ${actionCustomer.status === 'inactive' ? 'bg-slate-200 text-slate-400' : `${themeClasses.bgSoft} ${themeClasses.text}`} rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-3`}>
                          {getInitials(actionCustomer.shop_name)}
                      </div>
                      <h3 className="text-xl font-black text-slate-900">{cleanText(actionCustomer.shop_name)}</h3>
                      <p className="text-slate-500 text-sm">{actionCustomer.city_ref}</p>
                      {actionCustomer.status === 'inactive' && (
                          <span className="inline-block mt-2 px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase rounded-full border border-slate-200">Disabled</span>
                      )}
                  </div>
                  
                  <div className="space-y-3">
                      <button 
                          disabled={actionCustomer.status === 'inactive'}
                          onClick={() => {
                              onSelectCustomer(actionCustomer);
                              setActionCustomer(null);
                              setShowAdminActions(false);
                          }}
                          className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform ${actionCustomer.status === 'inactive' ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : `${themeClasses.bg} text-white`}`}
                      >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                          Create New Bill
                      </button>
                      
                      {onOpenProfile && (
                          <button 
                              onClick={() => {
                                  onOpenProfile(actionCustomer);
                                  setActionCustomer(null);
                                  setShowAdminActions(false);
                              }}
                              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition-transform"
                          >
                              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                              Open Shop Profile
                          </button>
                      )}

                      {!showAdminActions ? (
                          <button 
                              onClick={() => setShowAdminActions(true)}
                              className="w-full flex items-center justify-center gap-2 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-800 transition-colors"
                          >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Management Options
                          </button>
                      ) : (
                          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                              <button 
                                  onClick={() => toggleCustomerStatus(actionCustomer)}
                                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold border-2 transition-all ${
                                      actionCustomer.status === 'inactive' 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                  }`}
                              >
                                  {actionCustomer.status === 'inactive' ? 'Enable' : 'Disable'}
                              </button>
                              <button 
                                  onClick={() => handleDeleteCustomer(actionCustomer)}
                                  className="flex items-center justify-center gap-2 py-3 bg-rose-50 border-2 border-rose-200 text-rose-700 rounded-xl font-bold hover:bg-rose-100 transition-all"
                              >
                                  Delete
                              </button>
                          </div>
                      )}
                  </div>
                  <button 
                      onClick={() => { setActionCustomer(null); setShowAdminActions(false); }} 
                      className="w-full mt-6 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform"
                  >
                      Cancel
                  </button>
              </div>
          </div>
      )}

      {/* Add Form Modal/Card */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h3 className="text-xl font-bold text-slate-800">{editingCustomer ? 'Edit Customer' : 'New Customer'}</h3>
                    <button onClick={() => { setShowAddForm(false); setEditingCustomer(null); }} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Shop Name *</label>
                        <input className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newCustomer.shop_name || ''} onChange={e => setNewCustomer({...newCustomer, shop_name: e.target.value})} placeholder="e.g. City Auto Parts" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">City *</label>
                            <input className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newCustomer.city_ref || ''} onChange={e => setNewCustomer({...newCustomer, city_ref: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
                            <input className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} value={newCustomer.phone || ''} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} type="tel" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Address</label>
                        <textarea className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-medium`} rows={2} value={newCustomer.address || ''} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Disc 1 (%)</label>
                            <input type="number" step="1" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-bold ${themeClasses.text}`} value={newCustomer.discount_rate || ''} onChange={e => setNewCustomer({...newCustomer, discount_rate: parseFloat(e.target.value)})} placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Disc 2 (%)</label>
                            <input type="number" step="1" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-bold ${themeClasses.text}`} value={newCustomer.secondary_discount_rate || ''} onChange={e => setNewCustomer({...newCustomer, secondary_discount_rate: parseFloat(e.target.value)})} placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Credit (Days)</label>
                            <input type="number" step="1" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-bold ${themeClasses.text}`} value={newCustomer.credit_period || ''} onChange={e => setNewCustomer({...newCustomer, credit_period: parseInt(e.target.value)})} placeholder="90" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Credit Limit (Amount)</label>
                        <input type="number" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${themeClasses.ring} outline-none text-sm font-bold`} value={newCustomer.credit_limit || ''} onChange={e => setNewCustomer({...newCustomer, credit_limit: parseFloat(e.target.value)})} placeholder="No Limit" />
                    </div>
                </div>
                <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0 pb-safe">
                    <button onClick={handleSaveCustomer} className={`flex-1 ${themeClasses.bg} text-white py-3.5 rounded-xl font-bold ${themeClasses.bgHover} shadow-lg active:scale-95 transition-transform`}>{editingCustomer ? 'Update Shop' : 'Save Shop'}</button>
                    <button onClick={() => { setShowAddForm(false); setEditingCustomer(null); }} className="flex-1 bg-white text-slate-700 border border-slate-300 py-3.5 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition-transform">Cancel</button>
                </div>
            </div>
        </div>
      )}

      {/* Customer Grid/List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(customer => (
            <button 
                key={customer.customer_id} 
                onClick={() => setActionCustomer(customer)}
                className={`bg-white p-4 rounded-xl shadow-sm border ${customer.status === 'inactive' ? 'border-slate-100 opacity-60' : `border-slate-200 hover:${themeClasses.border}`} hover:shadow-md transition-all text-left flex items-start space-x-4 group active:scale-[0.98]`}
            >
                <div className={`flex-shrink-0 w-12 h-12 rounded-full ${customer.status === 'inactive' ? 'bg-slate-100 text-slate-400' : `${themeClasses.bgSoft} ${themeClasses.text} group-hover:${themeClasses.bg} group-hover:text-white`} flex items-center justify-center font-bold text-lg transition-colors`}>
                    {getInitials(customer.shop_name)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h3 className={`text-base font-bold truncate pr-2 ${customer.status === 'inactive' ? 'text-slate-400' : 'text-slate-900'}`}>{cleanText(customer.shop_name)}</h3>
                        <div className="flex items-center gap-2">
                            <div 
                                onClick={(e) => startEdit(e, customer)}
                                className={`text-slate-400 hover:${themeClasses.text} p-1 cursor-pointer`}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        // Create a synthetic event
                                        const syntheticEvent = {
                                            ...e,
                                            stopPropagation: () => e.stopPropagation(),
                                            preventDefault: () => e.preventDefault()
                                        } as unknown as React.MouseEvent;
                                        startEdit(syntheticEvent, customer);
                                    }
                                }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </div>
                            {customer.sync_status === 'pending' && (
                                <span className="flex-shrink-0 w-2 h-2 bg-amber-500 rounded-full" title="Pending Sync"></span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{customer.city_ref}</p>
                    <div className="mt-2 flex items-center text-xs text-slate-400 space-x-2">
                        <span>{customer.phone || 'No Phone'}</span>
                        <span>•</span>
                        <span className={`${themeClasses.text} font-medium`}>
                            {(customer.discount_rate * 100).toFixed(0)}%
                            {customer.secondary_discount_rate ? ` + ${(customer.secondary_discount_rate * 100).toFixed(0)}%` : ''} Deal
                        </span>
                    </div>
                </div>
            </button>
        ))}
      </div>
      
      {filteredCustomers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900">No customers found</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-1">Start by adding a new customer or try a different search.</p>
        </div>
      )}

        {confirmConfig && (
            <Modal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(null)}
                confirmText="Delete"
                type="danger"
            />
        )}
    </div>
  );
};
