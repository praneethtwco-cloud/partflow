import React, { useState } from 'react';
import { CompanySettings } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';

import { API_CONFIG } from '../config';
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
            // Call Python Backend
            const response = await fetch(`${API_CONFIG.BACKEND_URL}/change-password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-API-KEY': API_CONFIG.BACKEND_KEY
                },
                body: JSON.stringify({
                    userId: user.id,
                    oldPassword: passData.old,
                    newPassword: passData.new
                })
            });

            const data = await response.json();

            if (data.success) {
                // Also update local DB for offline access if applicable
                try {
                    await db.changePassword(user.id, passData.old, passData.new);
                } catch (e) {
                    console.log("Local password sync skipped or failed:", e);
                }

                setPassMsg({ text: 'Password changed successfully!', type: 'success' });
                setPassData({ old: '', new: '', confirm: '' });
                setTimeout(() => setShowPassModal(false), 2000);
            } else {
                setPassMsg({ text: data.message || 'Failed to change password', type: 'danger' });
            }
        } catch (e: any) {
            setPassMsg({ text: 'Could not connect to backend server', type: 'danger' });
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
                    onClick={onLogout}
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

                {/* Section: Data Sync */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <SectionHeader 
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                        title="Cloud Sync"
                        subtitle="Google sheets integration"
                    />

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-wider">Google Sheet ID</label>
                            <input 
                                className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:bg-white focus:ring-2 ${themeClasses.ring} focus:border-transparent outline-none transition-all`}
                                value={settings.google_sheet_id}
                                onChange={e => setSettings({...settings, google_sheet_id: e.target.value})}
                                placeholder="Enter Sheet ID from URL"
                            />
                        <p className="text-[9px] text-slate-400 mt-2 px-1 leading-relaxed">
                            Sharing your data with Google Sheets requires a valid Sheet ID. You can find this in the URL of your Google Sheet.
                        </p>
                    </div>
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
        </div>
    );
};
