import React, { useEffect, useState } from 'react';
import { SyncStats } from '../types';
import { db } from '../services/database';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  hasActiveDraft?: boolean;
  // OrderBuilder specific props for mobile
  orderShopName?: string;
  onOrderClose?: () => void;
  isOrderScreen?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange, 
  onSync, 
  isSyncing, 
  hasActiveDraft,
  orderShopName,
  onOrderClose,
  isOrderScreen
}) => {
  const { themeClasses } = useTheme();
  const [stats, setStats] = useState<SyncStats>({ pendingCustomers: 0, pendingItems: 0, pendingOrders: 0, pendingAdjustments: 0 });

  const refreshStats = () => {
    setStats(db.getSyncStats());
  };

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, [isSyncing]);

  const totalPending = stats.pendingCustomers + stats.pendingItems + stats.pendingOrders;

  const tabs = [
    {
      id: 'home', label: 'Home', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
      )
    },
    {
      id: 'customers', label: 'Shops', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      )
    },
    {
      id: 'orders', label: 'Sale', icon: (
        <div className="relative">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {hasActiveDraft && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          )}
        </div>
      )
    },

    {
      id: 'inventory', label: 'Stock', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      )
    },
    {
      id: 'history', label: 'History', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )
    },
    {
      id: 'reports', label: 'Reports', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      )
    },
    {
      id: 'sync', label: 'Sync', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      )
    },
    {
      id: 'settings', label: 'Settings', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      )
    },
  ];

  const topBarIds = ['sync'];
  const topBarTabs = tabs.filter(t => topBarIds.includes(t.id));

  // Custom Mobile Nav: Home, Inventory, New Sale (Center), Shops, Menu (More)
  const mobileNavOrder = ['home', 'customers', 'orders', 'inventory', 'menu'];
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleMobileNavClick = (id: string) => {
    if (id === 'menu') {
      setShowMobileMenu(!showMobileMenu);
    } else {
      onTabChange(id);
      setShowMobileMenu(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">

      {/* Desktop Header */}
      <header className="hidden md:block bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 ${themeClasses.bg} rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg ${themeClasses.shadow}`}>PF</div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">PartFlow <span className={themeClasses.text}>Pro</span></h1>
          </div>

          <nav className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                    ? `${themeClasses.bgSoft} ${themeClasses.text}`
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <span>{tab.label}</span>
                {tab.id === 'sync' && totalPending > 0 && (
                  <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-sm">{totalPending}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-100 p-3 sticky top-0 z-40 no-print">
        <div className="flex justify-between items-center">
          {/* Left: Close button + Shop name (for Order screen) or Logo (for other screens) */}
          <div className="flex items-center gap-2">
            {isOrderScreen && onOrderClose ? (
              // Order screen: show close button and shop name
              <>
                <button
                  onClick={onOrderClose}
                  className="p-1.5 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <h1 className="text-sm font-bold text-slate-800 truncate max-w-[180px]">
                  {orderShopName || 'New Order'}
                </h1>
              </>
            ) : (
              // Other screens: show logo
              <>
                <div className={`w-8 h-8 ${themeClasses.bg} rounded-lg flex items-center justify-center text-white font-bold text-xs ${themeClasses.shadow} shadow-lg`}>PF</div>
                <h1 className="text-sm font-black tracking-wider text-slate-800">
                  PARTFLOW
                </h1>
              </>
            )}
          </div>

          {/* Right: Sync button and pending count */}
          <div className="flex items-center gap-2">
            {totalPending > 0 && !isOrderScreen && (
              <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-full border border-amber-100">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-[10px] font-bold">{totalPending} Pending</span>
              </div>
            )}
            <button
              onClick={() => onTabChange('sync')}
              className={`p-2 rounded-full relative transition-colors ${activeTab === 'sync' ? `${themeClasses.bgSoft} ${themeClasses.text}` : 'text-slate-400'}`}
            >
              {tabs.find(t => t.id === 'sync')?.icon}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-8 mb-24 md:mb-0 print:p-0 print:m-0">
        {children}
      </main>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300"></div>
          <div className="absolute bottom-24 left-4 right-4 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-300 overflow-hidden">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'history', label: 'History', icon: tabs.find(t => t.id === 'history')?.icon, color: 'text-blue-600', bg: 'bg-blue-50' },
                { id: 'reports', label: 'Reports', icon: tabs.find(t => t.id === 'reports')?.icon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'settings', label: 'Settings', icon: tabs.find(t => t.id === 'settings')?.icon, color: 'text-slate-600', bg: 'bg-slate-50' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleMobileNavClick(item.id)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
                >
                  <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-xl flex items-center justify-center shadow-sm`}>
                    {item.icon}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-tight text-slate-600">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-15px_50px_-15px_rgba(0,0,0,0.1)] z-50 pb-safe no-print">
        <div className="flex justify-between items-center h-20 px-2 max-w-md mx-auto">
          {mobileNavOrder.map(id => {
            if (id === 'menu') {
              return (
                <button
                  key="menu"
                  onClick={() => handleMobileNavClick('menu')}
                  className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all active:scale-90 ${showMobileMenu ? themeClasses.text : 'text-slate-400'}`}
                >
                  <div className={`p-2 rounded-xl transition-colors ${showMobileMenu ? themeClasses.bgSoft : ''}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tighter">More</span>
                </button>
              );
            }

            const tab = tabs.find(t => t.id === id);
            if (!tab) return null;

            const isFab = id === 'orders';
            const isActive = activeTab === id;

            if (isFab) {
              return (
                <div key={id} className="relative px-2">
                  <button
                    onClick={() => handleMobileNavClick(id)}
                    className={`w-16 h-16 rounded-2xl ${themeClasses.bg} text-white shadow-xl ${themeClasses.shadow} flex flex-col items-center justify-center transform -translate-y-4 border-4 border-white active:scale-95 transition-all relative`}
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    <span className="text-[8px] font-black uppercase mt-0.5">Sale</span>
                    {hasActiveDraft && (
                      <span className="absolute top-3 right-3 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 ${themeClasses.border}`}></span>
                      </span>
                    )}
                  </button>
                </div>
              );
            }

            return (
              <button
                key={id}
                onClick={() => handleMobileNavClick(id)}
                className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all active:scale-90 ${isActive ? themeClasses.text : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <div className={`p-2 rounded-xl transition-colors ${isActive ? themeClasses.bgSoft : ''}`}>
                  {tab.icon}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-tighter ${isActive ? themeClasses.textDark : 'text-slate-500'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
};