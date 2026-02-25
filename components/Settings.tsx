import React, { useState, useEffect } from 'react';
import { CompanySettings, RoutePlanEntry } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase-client';
import { cleanText } from '../utils/cleanText';
import { useTheme } from '../context/ThemeContext';
import { themeColors, ThemeColor } from '../utils/theme';

interface SettingsProps {
    onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
    const { user } = useAuth();
    const { colorTheme, setColorTheme, themeClasses } = useTheme();
    const [settings, setSettings] = useState<CompanySettings>(db.getSettings());
    const [message, setMessage] = useState('');
    const [routePlans, setRoutePlans] = useState<RoutePlanEntry[]>(db.getRoutePlans());
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [editingRoutePlan, setEditingRoutePlan] = useState<RoutePlanEntry | null>(null);
    const [routeForm, setRouteForm] = useState({ customerId: '', visitTime: '', note: '', routeDate: new Date().toISOString().split('T')[0] });
    
    useEffect(() => {
        setRoutePlans(db.getRoutePlans());
    }, []);
    
    // Password State
    const [showPassModal, setShowPassModal] = useState(false);
    const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
    const [passMsg, setPassMsg] = useState({ text: '', type: 'info' as 'info' | 'danger' | 'success' });

    // Logo Upload
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB limit
            setMessage('Logo file too large (max 500KB)');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setSettings(prev => ({ ...prev, logo_base64: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        db.saveSettings(settings);
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
    };

    const customers = db.getCustomers();

    const handleAddRoutePlan = async () => {
        if (!routeForm.customerId || !routeForm.visitTime) {
            setMessage('Please select a shop and visit time');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        const customer = customers.find(c => c.customer_id === routeForm.customerId);
        const newPlan: RoutePlanEntry = {
            id: `${Date.now()}-${routeForm.customerId}`,
            customer_id: routeForm.customerId,
            visit_time: routeForm.visitTime,
            note: routeForm.note,
            route_date: routeForm.routeDate,
            created_at: new Date().toISOString(),
            sync_status: 'pending' as const
        };
        const updated = [...routePlans, newPlan];
        setRoutePlans(updated);
        await db.saveRoutePlans(updated);
        setRouteForm({ customerId: '', visitTime: '', note: '', routeDate: new Date().toISOString().split('T')[0] });
        setShowRouteModal(false);
        setMessage('Route plan added!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleDeleteRoutePlan = async (planId: string) => {
        const updated = routePlans.filter(p => p.id !== planId);
        setRoutePlans(updated);
        await db.saveRoutePlans(updated);
        setMessage('Route stop removed');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleEditRoutePlan = (plan: RoutePlanEntry) => {
        setEditingRoutePlan(plan);
        setRouteForm({
            customerId: plan.customer_id,
            visitTime: plan.visit_time,
            note: plan.note || '',
            routeDate: plan.route_date
        });
        setShowRouteModal(true);
    };

    const handleUpdateRoutePlan = async () => {
        if (!editingRoutePlan) return;
        const updated = routePlans.map(p => 
            p.id === editingRoutePlan.id 
                ? { ...p, customer_id: routeForm.customerId, visit_time: routeForm.visitTime, note: routeForm.note, route_date: routeForm.routeDate, sync_status: 'pending' as const }
                : p
        );
        setRoutePlans(updated);
        await db.saveRoutePlans(updated);
        setEditingRoutePlan(null);
        setRouteForm({ customerId: '', visitTime: '', note: '', routeDate: new Date().toISOString().split('T')[0] });
        setShowRouteModal(false);
        setMessage('Route plan updated!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleChangePassword = async () => {
        if (!user) return;
        if (!passData.old || !passData.new || !passData.confirm) {
            setPassMsg({ text: 'All fields are required', type: 'danger' });
            return;
        }
        if (passData.new !== passData.confirm) {
            setPassMsg({ text: 'Passwords do not match', type: 'danger' });
            return;
        }
        if (passData.new.length < 4) {
            setPassMsg({ text: 'New password is too short', type: 'danger' });
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: passData.new
            });

            if (error) {
                setPassMsg({ text: error.message || 'Failed to change password', type: 'danger' });
            } else {
                setPassMsg({ text: 'Password changed successfully!', type: 'success' });
                setPassData({ old: '', new: '', confirm: '' });
                setTimeout(() => setShowPassModal(false), 2000);
            }
        } catch (e: any) {
            setPassMsg({ text: 'Failed to change password', type: 'danger' });
        }
    };

    const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode, title: string, subtitle: string }) => (
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 ${themeClasses.bgSoft} ${themeClasses.text} rounded-xl flex items-center justify-center shadow-sm`}>
                {icon}
            </div>
            <div>
                <h3 className="text-base font-black text-slate-800 leading-tight">{title}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>
            </div>
        </div>
    );

    const ToggleRow = ({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: (val: boolean) => void }) => (
        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
            <div className="flex-1 pr-4">
                <label className="block text-sm font-bold text-slate-800">{label}</label>
                <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                />
                <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${checked ? themeClasses.bg : ''}`}></div>
            </label>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-8 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Header / Profile */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${themeClasses.gradient} rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg ${themeClasses.shadow}`}>
                        {user?.username[0].toUpperCase() || '?'}
                    </div>
                    <div>
                        <p className="text-lg font-black text-slate-900">{user?.full_name}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-white bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-tighter">{user?.role}</span>
                            <button 
                                onClick={() => setShowPassModal(true)}
                                className={`text-[10px] font-bold ${themeClasses.text} hover:${themeClasses.textDark} underline uppercase tracking-tighter`}
                            >
                                Change Password
                            </button>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => {
                        onLogout();
                    }}
                    className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 active:scale-90 transition-all border border-rose-100"
                    title="Sign Out"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Section: Personalization */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <SectionHeader 
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>}
                        title="Personalization"
                        subtitle="App appearance"
                    />
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-wider">Accent Color</label>
                        <div className="flex gap-3">
                            {Object.entries(themeColors).filter(([key]) => key !== 'slate').map(([key, value]) => (
                                <button
                                    key={key}
                                    onClick={() => setColorTheme(key as ThemeColor)}
                                    className={`w-10 h-10 rounded-full ${value.bg} ${colorTheme === key ? 'ring-4 ring-offset-2 ring-slate-200 scale-110' : 'hover:scale-105'} transition-all shadow-sm`}
                                    title={value.name}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* Section: Bill Head */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <SectionHeader 
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                        title="Company Profile"
                        subtitle="Bill Head Information"
                    />
                    
                    <div className="space-y-3">
                        {/* Logo Upload */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-wider">Company Logo</label>
                            <div className="flex items-center gap-4">
                                {settings.logo_base64 ? (
                                    <div className="relative group">
                                        <img src={settings.logo_base64} alt="Company Logo" className="w-16 h-16 object-contain rounded-lg border border-slate-200" />
                                        <button 
                                            onClick={() => setSettings(s => ({ ...s, logo_base64: undefined }))}
                                            className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                )}
                                <label className={`cursor-pointer ${themeClasses.bgSoft} ${themeClasses.text} text-xs font-bold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity`}>
                                    Upload Image
                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Company Name</label>
                            <input 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                value={settings.company_name}
                                onChange={e => setSettings({...settings, company_name: e.target.value})}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Business Address</label>
                            <textarea 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                rows={3}
                                value={cleanText(settings.address)}
                                onChange={e => setSettings({...settings, address: e.target.value})}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Phone</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={settings.phone}
                                    onChange={e => setSettings({...settings, phone: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Rep Name</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={settings.rep_name}
                                    onChange={e => setSettings({...settings, rep_name: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section: System Configuration */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4 flex flex-col">
                    <SectionHeader 
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                        title="Platform Logic"
                        subtitle="Core functionality behavior"
                    />

                    <div className="space-y-3 flex-1">
                        <ToggleRow 
                            label="Auto-Generate SKU"
                            description="Create SKUs automatically from descriptions."
                            checked={settings.auto_sku_enabled}
                            onChange={val => setSettings({...settings, auto_sku_enabled: val})}
                        />
                        <ToggleRow 
                            label="Inventory Tracking"
                            description="Track stock levels, low alerts, and counts."
                            checked={settings.stock_tracking_enabled}
                            onChange={val => setSettings({...settings, stock_tracking_enabled: val})}
                        />
                        <ToggleRow
                            label="Item Categories"
                            description="Group parts by categories (Engine, etc)."
                            checked={settings.category_enabled}
                            onChange={val => setSettings({...settings, category_enabled: val})}
                        />
                        <ToggleRow
                            label="Show SKU in Item Cards"
                            description="Display SKU in item selection cards (Order Builder)."
                            checked={settings.show_sku_in_item_cards || false}
                            onChange={val => setSettings({...settings, show_sku_in_item_cards: val})}
                        />
                        <ToggleRow
                            label="Show Advanced Sync Options"
                            description="Show advanced sync options on the sync page (requires re-accessing the page)"
                            checked={settings.show_advanced_sync_options || false}
                            onChange={val => setSettings({...settings, show_advanced_sync_options: val})}
                        />
                    </div>
                </div>

                {/* Section: Financials & Branding */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <SectionHeader 
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                        title="Financials & PDF"
                        subtitle="Branding and formatting"
                    />

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Currency Symbol</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={settings.currency_symbol}
                                    onChange={e => setSettings({...settings, currency_symbol: e.target.value})}
                                    placeholder="Rs."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Tax Rate (%)</label>
                                <input 
                                    type="number"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={settings.tax_rate ? settings.tax_rate * 100 : ''}
                                    onChange={e => setSettings({...settings, tax_rate: parseFloat(e.target.value) / 100})}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Inv. Prefix</label>
                                <input
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={settings.invoice_prefix}
                                    onChange={e => setSettings({...settings, invoice_prefix: e.target.value})}
                                    placeholder="INV-"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Starting Inv. #</label>
                                <input
                                    type="number"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    value={settings.starting_invoice_number || 1}
                                    onChange={e => setSettings({...settings, starting_invoice_number: parseInt(e.target.value) || 1})}
                                    placeholder="1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Bill Footer Note</label>
                            <textarea
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                rows={2}
                                value={settings.footer_note}
                                onChange={e => setSettings({...settings, footer_note: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* Section: Route Plans */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-center">
                        <SectionHeader 
                            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
                            title="Route Plans"
                            subtitle="Manage your visit schedule"
                        />
                        <button 
                            onClick={() => { setEditingRoutePlan(null); setRouteForm({ customerId: '', visitTime: '', note: '', routeDate: new Date().toISOString().split('T')[0] }); setShowRouteModal(true); }}
                            className={`${themeClasses.bg} text-white text-xs font-bold px-4 py-2 rounded-xl`}
                        >
                            + Add Stop
                        </button>
                    </div>

                    {routePlans.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4 italic">No route plans added yet. Add stops to plan your daily visits.</p>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {routePlans.map(plan => {
                                const customer = customers.find(c => c.customer_id === plan.customer_id);
                                return (
                                    <div key={plan.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{cleanText(customer?.shop_name || 'Unknown Shop')}</p>
                                            <p className="text-xs text-slate-500">{cleanText(customer?.city_ref || '')} • {plan.visit_time}</p>
                                            {plan.note && <p className="text-xs text-slate-400 italic mt-1">"{plan.note}"</p>}
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${plan.route_date === new Date().toISOString().split('T')[0] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {plan.route_date}
                                            </span>
                                            <button onClick={() => handleEditRoutePlan(plan)} className="text-slate-400 hover:text-indigo-600 p-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteRoutePlan(plan.id)} className="text-slate-400 hover:text-rose-600 p-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Save Action Area */}
            <div className="pt-4 pb-8 flex flex-col items-center">
                <button 
                    onClick={handleSave}
                    className={`w-full max-w-sm bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 ${themeClasses.bgHover} transition-all active:scale-95 flex items-center justify-center gap-3`}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Save Configuration
                </button>
                {message && <p className="mt-4 text-emerald-600 font-bold text-sm animate-bounce">{message}</p>}
            </div>

            <div className={`${themeClasses.bgSoft} border ${themeClasses.border} p-5 rounded-3xl`}>
                <div className="flex gap-3">
                    <svg className={`w-5 h-5 ${themeClasses.text} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className={`text-xs ${themeClasses.textDark} font-medium leading-relaxed`}>
                        These settings are stored locally on this device. They control how your invoices are generated and how your inventory is tracked. Changes take effect immediately.
                    </p>
                </div>
            </div>

            {/* Change Password Modal */}
            {showPassModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Security</h3>
                            <button onClick={() => setShowPassModal(false)} className="text-slate-400 p-1 hover:bg-slate-200 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Update Password</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Current Password</label>
                                    <input 
                                        type="password"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={passData.old}
                                        onChange={e => setPassData({...passData, old: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">New Password</label>
                                    <input 
                                        type="password"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={passData.new}
                                        onChange={e => setPassData({...passData, new: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Confirm New Password</label>
                                    <input 
                                        type="password"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={passData.confirm}
                                        onChange={e => setPassData({...passData, confirm: e.target.value})}
                                    />
                                </div>
                            </div>

                            {passMsg.text && (
                                <p className={`text-center text-xs font-bold p-2 rounded-lg ${
                                    passMsg.type === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                    {passMsg.text}
                                </p>
                            )}

                            <div className="pt-2 flex gap-3">
                                <button 
                                    onClick={() => setShowPassModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleChangePassword}
                                    className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all"
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Route Plan Modal */}
            {showRouteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">{editingRoutePlan ? 'Edit Route Stop' : 'Add Route Stop'}</h3>
                            <button onClick={() => { setShowRouteModal(false); setEditingRoutePlan(null); }} className="text-slate-400 p-1 hover:bg-slate-200 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Date</label>
                                <input 
                                    type="date"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={routeForm.routeDate}
                                    onChange={e => setRouteForm({...routeForm, routeDate: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Select Shop</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={routeForm.customerId}
                                    onChange={e => setRouteForm({...routeForm, customerId: e.target.value})}
                                >
                                    <option value="">Choose a shop...</option>
                                    {customers.filter(c => c.status === 'active').map(customer => (
                                        <option key={customer.customer_id} value={customer.customer_id}>
                                            {cleanText(customer.shop_name)} - {cleanText(customer.city_ref)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Visit Time</label>
                                <input 
                                    type="time"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={routeForm.visitTime}
                                    onChange={e => setRouteForm({...routeForm, visitTime: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Note (Optional)</label>
                                <textarea 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    rows={2}
                                    value={routeForm.note}
                                    onChange={e => setRouteForm({...routeForm, note: e.target.value})}
                                    placeholder="Add a note..."
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button 
                                    onClick={() => { setShowRouteModal(false); setEditingRoutePlan(null); }}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={editingRoutePlan ? handleUpdateRoutePlan : handleAddRoutePlan}
                                    className={`flex-1 py-3 ${themeClasses.bg} text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all`}
                                >
                                    {editingRoutePlan ? 'Update' : 'Add Stop'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
