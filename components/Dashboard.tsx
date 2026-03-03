import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/database';
import { useToast } from '../context/ToastContext';
import { Preferences } from '@capacitor/preferences';
import { formatCurrency } from '../utils/currency';
import { cleanText } from '../utils/cleanText';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { RoutePlanEntry, CompanySettings, VisitEntry, MonthlyTarget } from '../types';

interface DashboardProps {
    onAction: (tab: string) => void;
    onViewOrder: (order: any) => void;
    onOpenProfile: (customerId: string) => void;
    onSelectCustomerForOrder?: (customerId: string) => void;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<DashboardProps> = ({ onAction, onViewOrder, onOpenProfile, onSelectCustomerForOrder }) => {
    const { themeClasses } = useTheme();
    const [stats, setStats] = useState<any>({});
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<{ date: string, sales: number }[]>([]);
    const [greeting, setGreeting] = useState('');
    const [topCustomers, setTopCustomers] = useState<{ customerId: string; name: string; city: string; total: number; count: number }[]>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<{ name: string; value: number }[]>([]);
    const [outstandingAmount, setOutstandingAmount] = useState(0);
    const [animatedValues, setAnimatedValues] = useState<Record<string, number>>({});
    const [settings, setSettings] = useState<CompanySettings>(db.getSettings());
    const [routePlans, setRoutePlans] = useState<RoutePlanEntry[]>(db.getRoutePlans());
    const [visits, setVisits] = useState<VisitEntry[]>(db.getVisits());
    const { showToast } = useToast();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const pullRef = useRef<HTMLDivElement>(null);
    const [pullDistance, setPullDistance] = useState(0);
    const [todayRoutePlans, setTodayRoutePlans] = useState<RoutePlanEntry[]>([]);
    const [todayVisits, setTodayVisits] = useState<VisitEntry[]>([]);
    const [showRoutePlanner, setShowRoutePlanner] = useState(false);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [checkInCustomer, setCheckInCustomer] = useState<{ id: string; name: string; planId?: string } | null>(null);
    const [checkInNote, setCheckInNote] = useState('');
    const [newRoutePlan, setNewRoutePlan] = useState({ customerId: '', visitTime: '', note: '' });
    const [targets, setTargets] = useState<MonthlyTarget[]>([]);
    const [targetProgress, setTargetProgress] = useState({ lastMonthSale: 0, thisMonthTarget: 0, thisMonthSale: 0 });

    const handleRefresh = async () => {
        setIsRefreshing(true);
        db.reloadCache();
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentStats = db.getDashboardStats();
        setStats(currentStats);
        const allOrders = db.getOrders().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRecentOrders(allOrders.slice(0, 5));
        setRoutePlans(db.getRoutePlans());
        setVisits(db.getVisits());
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
            const customerTotals: Record<string, { customerId: string; name: string; city: string; total: number; count: number }> = {};
            monthOrders.forEach(order => {
                const customer = db.getCustomers().find(c => c.customer_id === order.customer_id);
                const name = customer ? cleanText(customer.shop_name) : 'Unknown';
                const city = customer ? cleanText(customer.city_ref) : 'Unknown City';
                if (!customerTotals[order.customer_id]) {
                    customerTotals[order.customer_id] = { customerId: order.customer_id, name, city, total: 0, count: 0 };
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

            // Load targets
            const allTargets = db.getAllTargets();
            setTargets(allTargets);

            // Calculate target progress
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

            // Last month sales
            const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`;
            const lastMonthEnd = new Date(lastMonthYear, lastMonth, 0).toISOString().split('T')[0];
            const lastMonthOrders = allOrders.filter(o => 
                o.order_date >= lastMonthStart && 
                o.order_date <= lastMonthEnd &&
                o.delivery_status !== 'failed' && 
                o.delivery_status !== 'cancelled'
            );
            const lastMonthSale = lastMonthOrders.reduce((sum, o) => sum + o.net_total, 0);

            // This month target
            const thisMonthTarget = allTargets.find(t => t.month === currentMonth && t.year === currentYear);
            const thisMonthTargetAmount = thisMonthTarget?.target_amount || 0;

            // This month sales (for target comparison)
            const thisMonthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
            const thisMonthOrders = allOrders.filter(o => 
                o.order_date >= thisMonthStart &&
                o.delivery_status !== 'failed' && 
                o.delivery_status !== 'cancelled'
            );
            const thisMonthSale = thisMonthOrders.reduce((sum, o) => sum + o.net_total, 0);

            setTargetProgress({
                lastMonthSale,
                thisMonthTarget: thisMonthTargetAmount,
                thisMonthSale
            });
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
        const today = new Date().toISOString().split('T')[0];
        setTodayRoutePlans((routePlans || []).filter(plan => plan.route_date === today));
        setTodayVisits((visits || []).filter(v => v.route_date === today));
    }, [routePlans, visits]);

    const getVisitStatus = (customerId: string): VisitEntry | undefined => {
        return todayVisits.find(v => v.customer_id === customerId && v.status !== 'missed');
    };

    const handleCheckIn = (customerId: string, planId?: string) => {
        const customer = db.getCustomers().find(c => c.customer_id === customerId);
        setCheckInCustomer({ id: customerId, name: cleanText(customer?.shop_name || 'Unknown'), planId });
        setCheckInNote('');
        setShowCheckInModal(true);
    };

    const handleConfirmCheckIn = async () => {
        if (!checkInCustomer) return;
        
        const today = new Date().toISOString().split('T')[0];
        const visit: VisitEntry = {
            id: `visit-${Date.now()}`,
            customer_id: checkInCustomer.id,
            plan_id: checkInCustomer.planId,
            check_in_time: new Date().toISOString(),
            check_in_note: checkInNote,
            status: 'checked_in',
            route_date: today,
            created_at: new Date().toISOString(),
            sync_status: 'pending' as const
        };

        const updatedVisits = [...(visits || []), visit];
        await db.saveVisits(updatedVisits);
        setVisits(updatedVisits);
        setShowCheckInModal(false);
        setCheckInCustomer(null);
        showToast('Checked in successfully!', 'success');
    };

    const handleCheckOut = async (visitId: string, note: string = '') => {
        const updatedVisits = (visits || []).map(v => 
            v.id === visitId 
                ? { ...v, check_out_time: new Date().toISOString(), check_out_note: note, status: 'completed' as const, sync_status: 'pending' as const }
                : v
        );
        await db.saveVisits(updatedVisits);
        setVisits(updatedVisits);
        showToast('Visit completed!', 'success');
    };

    const handleAddRoutePlan = async (): Promise<void> => {
        if (!newRoutePlan.customerId || !newRoutePlan.visitTime) {
            showToast('Select shop and visit time', 'error');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const routePlan: RoutePlanEntry = {
            id: `${Date.now()}-${newRoutePlan.customerId}`,
            customer_id: newRoutePlan.customerId,
            visit_time: newRoutePlan.visitTime,
            note: newRoutePlan.note,
            route_date: today,
            created_at: new Date().toISOString(),
            sync_status: 'pending' as const
        };

        try {
            const updatedRoutePlans = [...(routePlans || []), routePlan];
            await db.saveRoutePlans(updatedRoutePlans);
            setRoutePlans(updatedRoutePlans);
            setNewRoutePlan({ customerId: '', visitTime: '', note: '' });
            setShowRoutePlanner(false);
            showToast('Route stop added', 'success');
        } catch (error) {
            console.error('Failed to add route plan:', error);
            showToast('Failed to add route plan', 'error');
        }
    };

    const handleRemoveRoutePlan = async (planId: string): Promise<void> => {
        try {
            const updatedRoutePlans = (routePlans || []).filter(plan => plan.id !== planId);
            await db.saveRoutePlans(updatedRoutePlans);
            setRoutePlans(updatedRoutePlans);
            showToast('Route stop removed', 'info');
        } catch (error) {
            console.error('Failed to remove route plan:', error);
            showToast('Failed to remove route stop', 'error');
        }
    };

    const customerOptions = db.getCustomers().filter(customer => customer.status === 'active');

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

    // Target progress calculation
    const targetPercentage = targetProgress.thisMonthTarget > 0 
        ? Math.min((targetProgress.thisMonthSale / targetProgress.thisMonthTarget) * 100, 100) 
        : 0;
    const targetDiff = targetProgress.thisMonthTarget - targetProgress.thisMonthSale;
    const lastMonthDiff = targetProgress.thisMonthTarget > 0 
        ? targetProgress.lastMonthSale - targetProgress.thisMonthTarget 
        : 0;

    const routeStops = todayRoutePlans.length > 0
        ? todayRoutePlans.map(plan => {
            const customer = db.getCustomers().find(c => c.customer_id === plan.customer_id);
            return {
                key: plan.id,
                planId: plan.id,
                customerId: plan.customer_id,
                name: customer ? cleanText(customer.shop_name) : 'Unknown Shop',
                city: customer ? cleanText(customer.city_ref) : 'No city',
                count: 0,
                visitTime: plan.visit_time,
                note: plan.note || '',
                isPlanned: true
            };
        })
        : (topCustomers.slice(0, 3).length ? topCustomers.slice(0, 3).map(customer => ({
            key: customer.customerId,
            planId: null,
            customerId: customer.customerId,
            name: customer.name,
            city: customer.city,
            count: customer.count,
            visitTime: '',
            note: '',
            isPlanned: false
        })) : [{ key: 'empty', planId: null, customerId: '', name: 'No customer visits planned', city: 'Add customers to start route planning', count: 0, visitTime: '', note: '', isPlanned: false }]);

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
            </div>

            {/* Target Progress Card */}
            {targetProgress.thisMonthTarget > 0 && (
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-slate-800 text-sm">Monthly Target</h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-slate-900">{targetPercentage.toFixed(0)}%</p>
                                <p className="text-[10px] text-slate-400 font-bold">Achieved</p>
                            </div>
                        </div>
                    </div>
                    <div className="h-3 bg-slate-100">
                        <div 
                            className={`h-full transition-all duration-1000 ${targetPercentage >= 100 ? 'bg-emerald-500' : targetPercentage >= 75 ? 'bg-indigo-500' : targetPercentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${targetPercentage}%` }}
                        />
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-slate-100">
                        <div className="p-3 text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Target</p>
                            <p className="font-black text-slate-800 text-sm">{formatCurrency(targetProgress.thisMonthTarget)}</p>
                        </div>
                        <div className="p-3 text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Achieved</p>
                            <p className="font-black text-indigo-600 text-sm">{formatCurrency(targetProgress.thisMonthSale)}</p>
                        </div>
                        <div className="p-3 text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Last Month</p>
                            <p className={`font-black text-sm ${lastMonthDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatCurrency(targetProgress.lastMonthSale)}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* Quick Actions */}
            <section className="grid grid-cols-2 gap-3">
                <button onClick={() => onAction('customers')} className={`flex flex-col items-center justify-center gap-2 ${themeClasses.bg} text-white p-4 rounded-2xl shadow-md active:scale-95 transition-transform`}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="font-bold text-sm">New Order</span>
                </button>
                <button onClick={() => onAction('inventory')} className="flex flex-col items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 p-4 rounded-2xl shadow-sm active:scale-95 transition-transform">
                    <svg className={`w-7 h-7 ${themeClasses.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <span className="font-bold text-sm">Search Catalog</span>
                </button>
            </section>

            {/* Today's Route */}
            <section>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-slate-900 text-lg font-black">Today's Route</h2>
                    <button onClick={() => setShowRoutePlanner(true)} className={`text-sm font-bold ${themeClasses.text}`}>+ Add Stop</button>
                </div>
                <div className="space-y-2 md:space-y-3">
                    {routeStops.map((customer, index) => {
                        const visit = customer.customerId ? getVisitStatus(customer.customerId) : undefined;
                        const isCheckedIn = visit?.status === 'checked_in';
                        const isCompleted = visit?.status === 'completed';
                        const customerData = customer.customerId ? db.getCustomers().find(c => c.customer_id === customer.customerId) : null;
                        const outstandingBalance = customerData?.outstanding_balance || 0;
                        const hasOutstanding = outstandingBalance > 0;
                        
                        return (
                        <div key={`${customer.customerId || 'empty'}-${index}`} className={`rounded-xl md:rounded-2xl p-3 md:p-4 shadow-sm border ${index === 0 ? `bg-white border-l-4 ${themeClasses.border}` : 'bg-white border border-slate-100'} ${index > 0 ? 'opacity-90' : ''} ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
                            <div className="flex items-start justify-between gap-2 md:gap-3">
                                <div className="flex gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className={`mt-0.5 md:mt-1 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full flex-shrink-0 ${isCompleted ? 'bg-emerald-100 text-emerald-600' : index === 0 ? `${themeClasses.bgSoft} ${themeClasses.text}` : 'bg-slate-100 text-slate-500'}`}>
                                        {isCompleted ? (
                                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        ) : isCheckedIn ? (
                                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        ) : (
                                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414a2 2 0 010-2.828l4.243-4.243m0 0L14.828 2.5m2.829 2.829L20.5 8.172" /></svg>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 flex-wrap">
                                            <p className="text-slate-500 text-[10px] md:text-xs font-semibold truncate max-w-[80px] md:max-w-none">
                                                {isCompleted ? 'Completed' : isCheckedIn ? 'In Progress' : index === 0 ? 'Current' : index === 1 ? 'Next' : 'Upcoming'}
                                            </p>
                                            {customer.isPlanned && customer.visitTime && (
                                                <span className="text-[9px] md:text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{customer.visitTime}</span>
                                            )}
                                            {isCheckedIn && (
                                                <span className="text-[9px] md:text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">In</span>
                                            )}
                                            {hasOutstanding && (
                                                <span className="text-[9px] md:text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">{formatCurrency(outstandingBalance)}</span>
                                            )}
                                        </div>
                                        <h3 className="text-sm md:text-base font-bold text-slate-900 truncate">{customer.name}</h3>
                                        <p className="text-slate-500 text-xs md:text-sm truncate">{customer.city || 'No city'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    {customer.customerId && (
                                        <button onClick={() => onOpenProfile(customer.customerId)} className="text-slate-400 hover:text-slate-700 p-1">
                                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {customer.customerId && (
                                <div className="mt-2 md:mt-3 flex gap-1.5 md:gap-2">
                                    {!isCheckedIn && !isCompleted && (
                                        <>
                                            <button onClick={() => handleCheckIn(customer.customerId, customer.planId || undefined)} className={`flex-1 ${themeClasses.bg} text-white text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg`}>Check In</button>
                                            {hasOutstanding && (
                                                <button onClick={() => onSelectCustomerForOrder ? onSelectCustomerForOrder(customer.customerId) : onAction('orders')} className="flex-1 bg-rose-50 text-rose-700 text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg border border-rose-100">Collect {formatCurrency(outstandingBalance)}</button>
                                            )}
                                            {!hasOutstanding && (
                                                <button onClick={() => onSelectCustomerForOrder ? onSelectCustomerForOrder(customer.customerId) : onAction('orders')} className="flex-1 bg-slate-100 text-slate-700 text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg">New Order</button>
                                            )}
                                        </>
                                    )}
                                    {isCheckedIn && (
                                        <>
                                            <button onClick={() => onOpenProfile(customer.customerId)} className={`flex-1 ${themeClasses.bg} text-white text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg`}>View Shop</button>
                                            {hasOutstanding && (
                                                <button onClick={() => onSelectCustomerForOrder ? onSelectCustomerForOrder(customer.customerId) : onAction('orders')} className="flex-1 bg-rose-50 text-rose-700 text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg border border-rose-100">Collect {formatCurrency(outstandingBalance)}</button>
                                            )}
                                            {!hasOutstanding && (
                                                <button onClick={() => onSelectCustomerForOrder ? onSelectCustomerForOrder(customer.customerId) : onAction('orders')} className="flex-1 bg-emerald-50 text-emerald-700 text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg border border-emerald-100">New Order</button>
                                            )}
                                            <button onClick={() => handleCheckOut(visit!.id)} className="px-3 md:px-4 bg-slate-100 text-slate-600 text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg">Out</button>
                                        </>
                                    )}
                                    {isCompleted && (
                                        <div className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] md:text-xs font-bold py-1.5 md:py-2 rounded-lg">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Done
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            </section>

            {/* Quick Stats Row */}
            <section className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-2 text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8L10 18l-5-5-7 7" /></svg>
                        <span className="text-xs font-bold uppercase">Weekly Trend</span>
                    </div>
                    <p className="text-slate-900 text-xl font-black">{formatCurrency(trendData.reduce((acc, curr) => acc + curr.sales, 0))}</p>
                    <p className="text-slate-500 text-xs">Last 7 days total</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <div className="flex items-center gap-2 mb-2 text-orange-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M3.34 16h17.32c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L1.61 13c-.77 1.33.19 3 1.73 3z" /></svg>
                        <span className="text-xs font-bold uppercase">Pending</span>
                    </div>
                    <p className="text-slate-900 text-xl font-black">{paymentBreakdown.filter(p => p.name !== 'Paid').length}</p>
                    <p className="text-slate-500 text-xs">Payment buckets open</p>
                </div>
            </section>

            {/* Existing analytics sections */}
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
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-0 mb-4 flex justify-between items-center">
                        <h3 className="font-black text-slate-800 text-sm">Payment Status</h3>
                    </div>
                    <div className="h-40 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                                    {paymentBreakdown.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number | undefined) => formatCurrency(value || 0)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top customers / recent */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {topCustomers.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-black text-slate-800 text-sm">Top Customers This Month</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {topCustomers.map((customer, idx) => (
                                <button
                                    key={customer.customerId}
                                    onClick={() => onOpenProfile(customer.customerId)}
                                    className="w-full p-4 flex justify-between items-center hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-100 text-slate-700' : 'bg-orange-50 text-orange-700'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                                            <p className="text-[10px] text-slate-400">{customer.city} • {customer.count} orders</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-600">{formatCurrency(customer.total)}</p>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                                            Profile
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                                <div key={order.order_id} onClick={() => onViewOrder(order)} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-900">{cleanText(db.getCustomers().find(c => c.customer_id === order.customer_id)?.shop_name || 'Unknown Shop')}</p>
                                        <p className="text-[10px] text-slate-400">{order.order_date}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <p className="text-sm font-black text-slate-800">{formatCurrency(order.net_total)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Route Planner Modal */}
            {showRoutePlanner && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center pb-24 md:pb-0">
                    <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-6 animate-in slide-in-from-bottom-20 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-900">Add Route Stop</h3>
                            <button onClick={() => setShowRoutePlanner(false)} className="p-2 text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Shop</label>
                                <select 
                                    value={newRoutePlan.customerId}
                                    onChange={(e) => setNewRoutePlan(prev => ({ ...prev, customerId: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Choose a shop...</option>
                                    {customerOptions.map(customer => (
                                        <option key={customer.customer_id} value={customer.customer_id}>
                                            {cleanText(customer.shop_name)} - {cleanText(customer.city_ref)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Visit Time</label>
                                <input 
                                    type="time"
                                    value={newRoutePlan.visitTime}
                                    onChange={(e) => setNewRoutePlan(prev => ({ ...prev, visitTime: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Note (Optional)</label>
                                <textarea 
                                    value={newRoutePlan.note}
                                    onChange={(e) => setNewRoutePlan(prev => ({ ...prev, note: e.target.value }))}
                                    placeholder="Add a note for this stop..."
                                    rows={2}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            <button 
                                onClick={handleAddRoutePlan}
                                className={`w-full ${themeClasses.bg} text-white font-bold py-3 rounded-xl active:scale-95 transition-transform`}
                            >
                                Add to Route
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Check In Modal */}
            {showCheckInModal && checkInCustomer && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center pb-24 md:pb-0">
                    <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-6 animate-in slide-in-from-bottom-20 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Check In</h3>
                                <p className="text-sm text-slate-500">{checkInCustomer.name}</p>
                            </div>
                            <button onClick={() => setShowCheckInModal(false)} className="p-2 text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-xs text-emerald-600 font-bold uppercase">Check-in Time</p>
                                        <p className="text-lg font-black text-emerald-700">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Check-in Note (Optional)</label>
                                <textarea 
                                    value={checkInNote}
                                    onChange={(e) => setCheckInNote(e.target.value)}
                                    placeholder="Add notes about this visit..."
                                    rows={3}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setShowCheckInModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleConfirmCheckIn}
                                    className={`flex-1 py-3 ${themeClasses.bg} text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Confirm Check In
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
