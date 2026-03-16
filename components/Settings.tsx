import React, { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { CompanySettings, RoutePlanEntry, MonthlyTarget } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase-client';
import { cleanText } from '../utils/cleanText';
import { useTheme } from '../context/ThemeContext';
import { themeColors, ThemeColor } from '../utils/theme';
import { geminiAIService } from '../services/gemini-ai';
import { formatCurrency } from '../utils/currency';

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
    
    // Target Management State
    const [targets, setTargets] = useState<MonthlyTarget[]>(db.getAllTargets());
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [editingTarget, setEditingTarget] = useState<MonthlyTarget | null>(null);
    const [targetForm, setTargetForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, targetAmount: 0 });
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useState(settings.gemini_api_key || '');
    const [geminiModel, setGeminiModel] = useState(settings.gemini_model || '');
    
    useEffect(() => {
        setRoutePlans(db.getRoutePlans());
        setTargets(db.getAllTargets());
        // Initialize AI service with saved settings
        if (settings.gemini_api_key) {
            geminiAIService.setApiKey(settings.gemini_api_key);
        }
        if (settings.gemini_model) {
            geminiAIService.setModel(settings.gemini_model);
        }
    }, []);

    const handleSaveApiKey = () => {
        const updatedSettings = { ...settings, gemini_api_key: geminiApiKey, gemini_model: geminiModel };
        db.saveSettings(updatedSettings);
        setSettings(updatedSettings);
        geminiAIService.setApiKey(geminiApiKey);
        geminiAIService.setModel(geminiModel);
        setMessage('API Key & Model saved locally!');
        setTimeout(() => setMessage(''), 3000);
    };
    
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

    // Target Management Functions
    const handleGenerateAITarget = async () => {
        if (!geminiApiKey || geminiApiKey.trim() === '') {
            setMessage('Please set your Gemini API key first');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        if (!geminiModel || geminiModel.trim() === '') {
            setMessage('Please set your Gemini model first');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        geminiAIService.setApiKey(geminiApiKey);
        geminiAIService.setModel(geminiModel);
        setIsGeneratingAI(true);
        try {
            const salesHistory = db.getSalesHistoryForTarget(12);
            const now = new Date();
            const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
            const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

            const suggestion = await geminiAIService.generateTargetSuggestion(
                salesHistory,
                nextMonth,
                nextYear
            );

            setTargetForm({
                year: nextYear,
                month: nextMonth,
                targetAmount: suggestion.target_amount
            });

            setMessage(`AI suggested ${formatCurrency(suggestion.target_amount)} - ${suggestion.reasoning}`);
            setTimeout(() => setMessage(''), 5000);
        } catch (error) {
            console.error('AI Target Generation Error:', error);
            setMessage('Failed to generate AI target. Check API key.');
            setTimeout(() => setMessage(''), 3000);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleSaveTarget = async () => {
        const target: MonthlyTarget = {
            id: editingTarget ? editingTarget.id : `target-${targetForm.year}-${targetForm.month}`,
            year: targetForm.year,
            month: targetForm.month,
            target_amount: targetForm.targetAmount,
            achieved_amount: editingTarget?.achieved_amount || 0,
            status: editingTarget?.status || 'draft',
            is_ai_generated: editingTarget?.is_ai_generated || false,
            ai_suggestion_reason: editingTarget?.ai_suggestion_reason,
            created_at: editingTarget?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        await db.saveTarget(target);
        setTargets(db.getAllTargets());
        setShowTargetModal(false);
        setEditingTarget(null);
        setTargetForm({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, targetAmount: 0 });
        setMessage('Target saved successfully!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleLockTarget = async (targetId: string) => {
        await db.lockTarget(targetId);
        setTargets(db.getAllTargets());
        setMessage('Target locked!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleDeleteTarget = async (targetId: string) => {
        await db.deleteTarget(targetId);
        setTargets(db.getAllTargets());
        setMessage('Target deleted!');
        setTimeout(() => setMessage(''), 3000);
    };

    const openNewTargetModal = () => {
        const now = new Date();
        const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
        const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
        setEditingTarget(null);
        setTargetForm({ year: nextYear, month: nextMonth, targetAmount: 0 });
        setShowTargetModal(true);
    };

    const openEditTargetModal = (target: MonthlyTarget) => {
        setEditingTarget(target);
        setTargetForm({ year: target.year, month: target.month, targetAmount: target.target_amount });
        setShowTargetModal(true);
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
                password: bcrypt.hashSync(passData.new, 10)
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
                                            <button onClick={() => handleEditRoutePlan(plan)} aria-label="Edit route plan" className="text-slate-400 hover:text-indigo-600 p-1 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-indigo-500 rounded">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteRoutePlan(plan.id)} aria-label="Delete route plan" className="text-slate-400 hover:text-rose-600 p-1 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-rose-500 rounded">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Section: AI API Key */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800">AI Configuration</h3>
                            <p className="text-xs text-slate-500">Gemini API for smart targets</p>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Gemini Model</label>
                        <input 
                            type="text"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all mb-3"
                            value={geminiModel}
                            onChange={e => setGeminiModel(e.target.value)}
                            placeholder="e.g., gemini-2.0-flash"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Gemini API Key</label>
                        <div className="flex gap-2">
                            <input 
                                type="password"
                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                value={geminiApiKey}
                                onChange={e => setGeminiApiKey(e.target.value)}
                                placeholder="Enter your Gemini API key..."
                            />
                            <button 
                                onClick={handleSaveApiKey}
                                className={`px-4 py-2 ${themeClasses.bg} text-white text-xs font-bold rounded-xl`}
                            >
                                Save
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Get free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">Google AI Studio</a></p>
                    </div>
                </div>

                {/* Section: Monthly Targets */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 ${themeClasses.bgSoft} rounded-xl flex items-center justify-center`}>
                                <svg className={`w-5 h-5 ${themeClasses.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800">Monthly Sales Targets</h3>
                                <p className="text-xs text-slate-500">Set and track sales targets</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleGenerateAITarget}
                                disabled={isGeneratingAI}
                                className={`px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50`}
                            >
                                {isGeneratingAI ? (
                                    <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AI...</>
                                ) : (
                                    <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> AI Suggest</>
                                )}
                            </button>
                            <button 
                                onClick={openNewTargetModal}
                                className={`${themeClasses.bg} text-white text-xs font-bold px-4 py-2 rounded-xl`}
                            >
                                + Add Target
                            </button>
                        </div>
                    </div>

                    {targets.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4 italic">No targets added yet. Click "AI Suggest" or "Add Target" to create one.</p>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {targets.map(target => {
                                const progress = target.target_amount > 0 ? (target.achieved_amount / target.target_amount) * 100 : 0;
                                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                const isLocked = target.status === 'locked';
                                
                                return (
                                    <div key={target.id} className={`p-3 rounded-xl border ${isLocked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{monthNames[target.month - 1]} {target.year}</p>
                                                <p className="text-xs text-slate-500">
                                                    Target: {formatCurrency(target.target_amount)} • Achieved: {formatCurrency(target.achieved_amount)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                                                    isLocked ? 'bg-emerald-100 text-emerald-700' :
                                                    target.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                                                    target.is_ai_generated ? 'bg-purple-100 text-purple-700' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {isLocked ? 'Locked' : target.status}
                                                </span>
                                                {!isLocked && (
                                                    <>
                                                        <button onClick={() => openEditTargetModal(target)} aria-label="Edit target" className="text-slate-400 hover:text-indigo-600 p-1 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-indigo-500 rounded">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        </button>
                                                        <button onClick={() => handleLockTarget(target.id)} aria-label="Lock target" className="text-slate-400 hover:text-emerald-600 p-1 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-emerald-500 rounded" title="Lock target">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteTarget(target.id)} aria-label="Delete target" className="text-slate-400 hover:text-rose-600 p-1 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-rose-500 rounded">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 75 ? 'bg-blue-500' : progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                style={{ width: `${Math.min(100, progress)}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">{Math.round(progress)}% achieved</p>
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
                            <button onClick={() => setShowPassModal(false)} aria-label="Close change password modal" className="text-slate-400 p-1 hover:bg-slate-200 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-indigo-500">
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
                            <button onClick={() => { setShowRouteModal(false); setEditingRoutePlan(null); }} aria-label="Close route plan modal" className="text-slate-400 p-1 hover:bg-slate-200 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-indigo-500">
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

            {/* Target Modal */}
            {showTargetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">{editingTarget ? 'Edit Target' : 'Add Monthly Target'}</h3>
                            <button onClick={() => { setShowTargetModal(false); setEditingTarget(null); }} aria-label="Close target modal" className="text-slate-400 p-1 hover:bg-slate-200 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-indigo-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Year</label>
                                    <select 
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={targetForm.year}
                                        onChange={e => setTargetForm({...targetForm, year: parseInt(e.target.value)})}
                                    >
                                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Month</label>
                                    <select 
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={targetForm.month}
                                        onChange={e => setTargetForm({...targetForm, month: parseInt(e.target.value)})}
                                    >
                                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                            <option key={i + 1} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Target Amount (Rs.)</label>
                                <input 
                                    type="number"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={targetForm.targetAmount}
                                    onChange={e => setTargetForm({...targetForm, targetAmount: parseFloat(e.target.value) || 0})}
                                    placeholder="Enter target amount"
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button 
                                    onClick={() => { setShowTargetModal(false); setEditingTarget(null); }}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSaveTarget}
                                    className={`flex-1 py-3 ${themeClasses.bg} text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all`}
                                >
                                    {editingTarget ? 'Update' : 'Save Target'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
