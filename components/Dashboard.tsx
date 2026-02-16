import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';
import { Preferences } from '@capacitor/preferences';
import { formatCurrency } from '../utils/currency';
import { cleanText } from '../utils/cleanText';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useTheme } from '../context/ThemeContext';

interface DashboardProps {
    onAction: (tab: string) => void;
    onViewOrder: (order: any) => void;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<DashboardProps> = ({ onAction, onViewOrder }) => {
    const { themeClasses } = useTheme();
    const [stats, setStats] = useState<any>({});
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<{ date: string, sales: number }[]>([]);
    const [greeting, setGreeting] = useState('');
    const [topCustomers, setTopCustomers] = useState<{ name: string; total: number; count: number }[]>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([]);
    const [outstandingAmount, setOutstandingAmount] = useState(0);
    const [animatedValues, setAnimatedValues] = useState<Record<string, number>>({});
    const settings = db.getSettings();
    const { showToast } = useToast();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const pullRef = useRef<HTMLDivElement>(null);
    const [pullDistance, setPullDistance] = useState(0);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        db.reloadCache();
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentStats = db.getDashboardStats();
        setStats(currentStats);
        const allOrders = db.getOrders().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRecentOrders(allOrders.slice(0, 5));
        setIsRefreshing(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            pullRef.current?.setAttribute('data-touch-start', String(e.touches[0].clientY));
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const start = pullRef.current?.getAttribute('data-touch-start');
        if (start && window.scrollY === 0) {
            const currentY = e.touches[0].clientY;
            const diff = currentY - parseFloat(start);
            if (diff > 0) {
                setPullDistance(Math.min(diff * 0.5, 100));
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 60) {
            handleRefresh();
        }
        setPullDistance(0);
        pullRef.current?.removeAttribute('data-touch-start');
    };

    useEffect(() => {
        const updateWidget = async () => {
            const currentStats = db.getDashboardStats();
            setStats(currentStats);
            
            // Initialize animated values
            setAnimatedValues({
                dailySales: 0,
                monthlySales: 0,
                monthlyOrders: 0,
                totalRevenue: 0
            });

            const allOrders = db.getOrders().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setRecentOrders(allOrders.slice(0, 5));

            // Weekly Trend
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d.toISOString().split('T')[0];
            });

            const trend = last7Days.map(date => ({
                date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                fullDate: date,
                sales: allOrders.filter(o => o.order_date === date && o.delivery_status !== 'failed' && o.delivery_status !== 'cancelled').reduce((sum, o) => sum + o.net_total, 0)
            }));
            setTrendData(trend);

            // Top Customers this month
            const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const monthOrders = allOrders.filter(o => o.order_date >= firstOfMonth && o.delivery_status !== 'failed' && o.delivery_status !== 'cancelled');
            const customerTotals: Record<string, { name: string; total: number; count: number }> = {};
            monthOrders.forEach(order => {
                const customer = db.getCustomers().find(c => c.customer_id === order.customer_id);
                const name = customer ? cleanText(customer.shop_name) : 'Unknown';
                if (!customerTotals[order.customer_id]) {
                    customerTotals[order.customer_id] = { name, total: 0, count: 0 };
                }
                customerTotals[order.customer_id].total += order.net_total;
                customerTotals[order.customer_id].count += 1;
            });
            setTopCustomers(Object.values(customerTotals).sort((a, b) => b.total - a.total).slice(0, 5));

            // Payment Breakdown
            const paid = allOrders.filter(o => o.payment_status === 'paid' && o.delivery_status !== 'failed' && o.delivery_status !== 'cancelled').reduce((sum, o) => sum + o.net_total, 0);
            const partial = allOrders.filter(o => o.payment_status === 'partial' && o.delivery_status !== 'failed' && o.delivery_status !== 'cancelled').reduce((sum, o) => sum + o.balance_due, 0);
            const unpaid = allOrders.filter(o => o.payment_status === 'unpaid' && o.delivery_status !== 'failed' && o.delivery_status !== 'cancelled').reduce((sum, o) => sum + o.net_total, 0);
            setPaymentBreakdown([
                { name: 'Paid', value: paid },
                { name: 'Partial', value: partial },
                { name: 'Unpaid', value: unpaid }
            ]);
            setOutstandingAmount(partial + unpaid);

            // Greeting
            const hour = new Date().getHours();
            if (hour < 12) setGreeting('Good Morning');
            else if (hour < 18) setGreeting('Good Afternoon');
            else setGreeting('Good Evening');

            // Widget storage
            await Preferences.set({ key: 'widget_daily_sales', value: formatCurrency(currentStats.dailySales) });
            await Preferences.set({ key: 'widget_last_update', value: `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });
        };

        updateWidget();
        const interval = setInterval(updateWidget, 30000);
        return () => clearInterval(interval);
    }, []);

    // Animated counter effect
    useEffect(() => {
        const targetValues = {
            dailySales: stats.dailySales || 0,
            monthlySales: stats.monthlySales || 0,
            monthlyOrders: stats.monthlyOrders || 0,
            totalRevenue: stats.totalRevenue || 0
        };

        const duration = 1500;
        const steps = 60;
        const stepDuration = duration / steps;
        
        let step = 0;
        const interval = setInterval(() => {
            step++;
            const progress = step / steps;
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            
            setAnimatedValues({
                dailySales: Math.round(targetValues.dailySales * eased),
                monthlySales: Math.round(targetValues.monthlySales * eased),
                monthlyOrders: Math.round(targetValues.monthlyOrders * eased),
                totalRevenue: Math.round(targetValues.totalRevenue * eased)
            });

            if (step >= steps) clearInterval(interval);
        }, stepDuration);

        return () => clearInterval(interval);
    }, [stats.dailySales, stats.monthlySales, stats.monthlyOrders]);

    // Auto-scroll carousel
    useEffect(() => {
        const interval = setInterval(() => {
            if (scrollContainerRef.current) {
                setCurrentSlide(prev => (prev + 1) % 3);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const statCards = [
        {
            title: "Today's Sales",
            value: animatedValues.dailySales,
            subtitle: 'Daily revenue',
            gradient: 'from-indigo-500 via-indigo-600 to-indigo-700',
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            action: () => { onAction('reports'); showToast('Opening sales reports', 'info'); }
        },
        {
            title: 'This Month',
            value: animatedValues.monthlySales,
            subtitle: 'Monthly revenue',
            gradient: 'from-emerald-500 via-emerald-600 to-emerald-700',
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            action: () => { onAction('reports'); showToast('Opening sales reports', 'info'); }
        },
        {
            title: 'Orders',
            value: animatedValues.monthlyOrders,
            subtitle: 'This month',
            gradient: 'from-violet-500 via-violet-600 to-violet-700',
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
            ),
            action: () => { onAction('history'); showToast('Viewing order history', 'info'); },
            isCount: true
        }
    ];

    return (
        <div 
            ref={pullRef}
            className="space-y-4 pb-20 md:pb-0 px-2"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull to Refresh Indicator */}
            {pullDistance > 0 && (
                <div 
                    className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 transition-transform duration-200"
                    style={{ transform: `translateY(${pullDistance}px)` }}
                >
                    <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="font-bold text-sm">{isRefreshing ? 'Refreshing...' : 'Pull to refresh'}</span>
                </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                        {greeting}, <span className={`text-transparent bg-clip-text bg-gradient-to-r ${themeClasses.gradient}`}>{settings.rep_name || 'User'}</span>
                    </h2>
                    <p className="text-slate-500 font-medium text-sm">Here's your performance overview</p>
                </div>
                <div className="text-right hidden sm:block">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Today</span>
                    <p className="text-slate-800 font-bold">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                </div>
            </div>

            {/* Auto-sliding Stats Cards */}
            <div className="relative overflow-hidden rounded-3xl">
                <div 
                    ref={scrollContainerRef}
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                    {statCards.map((card, idx) => (
                        <div key={idx} className="w-full flex-shrink-0 px-1">
                            <div
                                onClick={card.action}
                                className={`bg-gradient-to-br ${card.gradient} p-5 md:p-6 rounded-3xl shadow-lg shadow-indigo-100 text-white relative overflow-hidden group cursor-pointer active:scale-95 transition-transform`}
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    {card.icon}
                                </div>
                                <div className="relative z-10">
                                    <p className="text-xs uppercase font-bold text-white/80 tracking-wider mb-1">{card.title}</p>
                                    <p className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight truncate">
                                        {card.isCount ? card.value : formatCurrency(card.value)}
                                    </p>
                                    <p className="text-white/60 text-xs font-medium mt-1">{card.subtitle}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Slide Indicators */}
                <div className="flex justify-center gap-2 mt-3">
                    {statCards.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${currentSlide === idx ? 'w-6 bg-indigo-600' : 'bg-slate-300'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customers</p>
                    <p className="text-xl md:text-2xl font-black text-slate-800">{stats.totalCustomers || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Items</p>
                    <p className="text-xl md:text-2xl font-black text-slate-800">{stats.totalItems || 0}</p>
                </div>
                {settings.stock_tracking_enabled ? (
                    <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => onAction('inventory')}>
                        <p className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Low Stock</p>
                        <p className="text-xl md:text-2xl font-black text-rose-600">{stats.criticalItems || 0}</p>
                    </div>
                ) : (
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">System</p>
                        <p className="text-xl md:text-2xl font-black text-emerald-600">Active</p>
                    </div>
                )}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outstanding</p>
                    <p className="text-lg md:text-xl font-black text-amber-600 truncate" title={formatCurrency(outstandingAmount)}>
                        {formatCurrency(outstandingAmount)}
                    </p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Weekly Performance */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="font-black text-slate-800">Weekly Performance</h3>
                            <p className="text-xs text-slate-400">Last 7 days</p>
                        </div>
                        <div className="text-right">
                            <p className={`text-lg font-black ${themeClasses.text}`}>{formatCurrency(trendData.reduce((acc, curr) => acc + curr.sales, 0))}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                        </div>
                    </div>
                    <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorSalesDash" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={themeClasses.hex} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={themeClasses.hex} stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                                <Tooltip formatter={(value: number | undefined) => [formatCurrency(value || 0), 'Sales']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                <Area type="monotone" dataKey="sales" stroke={themeClasses.hex} strokeWidth={3} fill="url(#colorSalesDash)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Payment Status */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="font-black text-slate-800">Payment Status</h3>
                            <p className="text-xs text-slate-400">Collection overview</p>
                        </div>
                    </div>
                    <div className="h-40 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={paymentBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={70}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {paymentBreakdown.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number | undefined) => formatCurrency(value || 0)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                        {paymentBreakdown.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                                <span className="text-[10px] font-medium text-slate-500">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Customers & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Customers */}
                {topCustomers.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-black text-slate-800 text-sm">Top Customers This Month</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {topCustomers.map((customer, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{customer.name}</p>
                                            <p className="text-[10px] text-slate-400">{customer.count} orders</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-black text-emerald-600">{formatCurrency(customer.total)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Transactions */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-black text-slate-800 text-sm">Recent Transactions</h3>
                        <button onClick={() => onAction('history')} className={`text-[10px] ${themeClasses.text} font-black uppercase hover:underline`}>View All</button>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {recentOrders.length === 0 ? (
                            <p className="p-8 text-center text-slate-400 text-sm italic">No recent activity</p>
                        ) : (
                            recentOrders.slice(0, 4).map(order => (
                                <div
                                    key={order.order_id}
                                    onClick={() => onViewOrder(order)}
                                    className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 truncate max-w-[140px]">
                                            {cleanText(db.getCustomers().find(c => c.customer_id === order.customer_id)?.shop_name || 'Unknown Shop')}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{order.order_date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-800">{formatCurrency(order.net_total)}</p>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${order.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {order.payment_status || 'unpaid'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-lg font-black text-slate-800 mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => onAction('customers')} className="flex flex-col items-center justify-center bg-indigo-50 hover:bg-indigo-100 p-4 rounded-2xl transition-all active:scale-95 group">
                        <div className={`w-12 h-12 ${themeClasses.bg} text-white rounded-xl flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-700">New Sale</span>
                    </button>
                    <button onClick={() => { onAction('inventory'); showToast('Checking stock', 'info'); }} className="flex flex-col items-center justify-center bg-emerald-50 hover:bg-emerald-100 p-4 rounded-2xl transition-all active:scale-95 group">
                        <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-900">Stock</span>
                    </button>
                    <button onClick={() => { onAction('sync'); showToast('Sync center', 'info'); }} className="flex flex-col items-center justify-center bg-amber-50 hover:bg-amber-100 p-4 rounded-2xl transition-all active:scale-95 group">
                        <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-amber-900">Sync</span>
                    </button>
                    <button onClick={() => onAction('reports')} className="flex flex-col items-center justify-center bg-rose-50 hover:bg-rose-100 p-4 rounded-2xl transition-all active:scale-95 group">
                        <div className="w-12 h-12 bg-rose-500 text-white rounded-xl flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <span className="text-[10px] font-bold text-rose-900">Reports</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
