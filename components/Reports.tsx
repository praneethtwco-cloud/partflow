import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Customer, Item, Order } from '../types';
import { pdfService } from '../services/pdf';
import { formatCurrency } from '../utils/currency';
import InvoicePreview from './InvoicePreview';
import { cleanText } from '../utils/cleanText';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

type ReportView = 'overview' | 'revenue' | 'category' | 'customer' | 'stock' | 'invoice' | 'performance';

interface ReportsProps {
    onOpenProfile?: (customer: Customer) => void;
}

import { useTheme } from '../context/ThemeContext';

export const Reports: React.FC<ReportsProps> = ({ onOpenProfile }) => {
    const { themeClasses } = useTheme();
    const [orders, setOrders] = useState<Order[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [view, setView] = useState<ReportView>('overview');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'in'>('all');
    const [dateRange, setDateRange] = useState({ 
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });

    const settings = db.getSettings();

    useEffect(() => {
        setOrders(db.getOrders());
        setItems(db.getItems());
        setCustomers(db.getCustomers());
    }, []);

    // Filtered data
    const filteredOrders = orders.filter(o => o.order_date >= dateRange.start && o.order_date <= dateRange.end);
    
    // Aggregations
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.net_total, 0);
    const customerStats: Record<string, number> = {};
    filteredOrders.forEach(o => {
        customerStats[o.customer_id] = (customerStats[o.customer_id] || 0) + o.net_total;
    });

    const topCustomers = Object.entries(customerStats)
        .sort((a, b) => b[1] - a[1])
        .map(([id, total]) => {
            const customer = customers.find(c => c.customer_id === id);
            const customerOrders = filteredOrders.filter(o => o.customer_id === id);
            return {
                id,
                name: customer?.shop_name || 'Unknown',
                totalGross: customerOrders.reduce((sum, o) => sum + o.gross_total, 0),
                totalDisc1: customerOrders.reduce((sum, o) => sum + o.discount_value, 0),
                totalDisc2: customerOrders.reduce((sum, o) => sum + (o.secondary_discount_value || 0), 0),
                totalPaid: customerOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0),
                totalBalance: customerOrders.reduce((sum, o) => sum + (o.balance_due || 0), 0),
                invoiceCount: customerOrders.length,
                total
            };
        });

    const salesTrend = React.useMemo(() => {
        const trendMap: Record<string, number> = {};
        
        // Fill gaps logic could go here, but for now specific dates
        filteredOrders.forEach(o => {
            trendMap[o.order_date] = (trendMap[o.order_date] || 0) + o.net_total;
        });

        return Object.entries(trendMap)
            .map(([date, total]) => ({ 
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
                originalDate: date,
                total 
            }))
            .sort((a, b) => a.originalDate.localeCompare(b.originalDate));
    }, [filteredOrders]);

    const handleDrillDown = (newView: ReportView, id: string | null = null) => {
        setView(newView);
        setSelectedId(id);
    };

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            const fileName = `Report_${view}_${dateRange.start}_to_${dateRange.end}.pdf`;
            await pdfService.generatePdfFromElement('#report-content', fileName);
        } catch (error) {
            alert("Failed to generate PDF report.");
        } finally {
            setIsPrinting(false);
        }
    };

    const renderOverview = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div onClick={() => handleDrillDown('performance')} className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 cursor-pointer active:scale-95 transition-transform">
                    <p className="text-[10px] uppercase font-bold text-indigo-200 tracking-widest mb-1">Period Revenue</p>
                    <p className="text-3xl font-black">{formatCurrency(totalRevenue)}</p>
                    <p className="mt-4 text-[10px] underline">View Performance Report →</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm cursor-pointer" onClick={() => handleDrillDown('stock')}>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Inventory Health</p>
                    <p className="text-3xl font-black text-slate-800">{items.length} SKUs</p>
                    <p className="text-[10px] font-bold text-indigo-600 mt-2">Check Out of Stock →</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Active Customers</p>
                    <p className="text-3xl font-black text-slate-800">{Object.keys(customerStats).length}</p>
                </div>
            </div>

            {/* Sales Trend Chart */}
            <div className="mt-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Sales Trend</h3>
                    <p className="text-xs text-slate-400 font-medium">Revenue over selected period</p>
                </div>
                <div className="h-[250px] w-full">
                    {salesTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesTrend}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={themeClasses.hex} stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor={themeClasses.hex} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} 
                                    tickFormatter={(value) => `${value / 1000}k`}
                                />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                    itemStyle={{color: '#fff', fontWeight: 'bold', fontSize: '12px'}}
                                    labelStyle={{color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase'}}
                                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="total" 
                                    stroke={themeClasses.hex} 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorSales)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-300 text-sm font-bold">
                            No sales data for this period
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                        <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                        Recent Shop Activity
                    </h3>
                    <button onClick={() => setView('performance')} className="text-xs font-black text-indigo-600 uppercase underline">Full Report</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                <th className="pb-4 px-2">Shop Name</th>
                                <th className="pb-4 px-2 text-right">Gross</th>
                                <th className="pb-4 px-2 text-right">Net Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {topCustomers.slice(0, 5).map((c, i) => (
                                <tr key={i} className="cursor-pointer hover:bg-slate-50" onClick={() => handleDrillDown('customer', c.id)}>
                                    <td className="py-3 px-2 font-bold text-slate-700">{cleanText(c.name)}</td>
                                    <td className="py-3 px-2 text-right text-slate-400 font-mono text-xs">{formatCurrency(c.totalGross, false)}</td>
                                    <td className="py-3 px-2 text-right font-black text-slate-900">{formatCurrency(c.total, false)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    const renderPerformanceReport = () => (
        <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-6 no-print">
                <button onClick={() => setView('overview')} className="text-xs font-black text-indigo-600 uppercase">← Back to Overview</button>
                <button onClick={handlePrint} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print Report
                </button>
            </div>
            <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                            <th className="px-2 py-4">Shop Name</th>
                            <th className="px-2 py-4 text-right">Invoices</th>
                            <th className="px-2 py-4 text-right">Gross Total</th>
                            <th className="px-2 py-4 text-right text-rose-500">Disc Total</th>
                            <th className="px-2 py-4 text-right">Net Revenue</th>
                            <th className="px-2 py-4 text-right text-emerald-600">Recovery</th>
                            <th className="px-2 py-4 text-right text-rose-600">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {topCustomers.map((c, i) => (
                            <tr key={i} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleDrillDown('customer', c.id)}>
                                <td className="px-2 py-4 font-bold text-slate-800">{cleanText(c.name)}</td>
                                <td className="px-2 py-4 text-right font-medium text-slate-500">{c.invoiceCount}</td>
                                <td className="px-2 py-4 text-right font-mono text-xs">{formatCurrency(c.totalGross, false)}</td>
                                <td className="px-2 py-4 text-right font-mono text-xs text-rose-500">-{formatCurrency(c.totalDisc1 + c.totalDisc2, false)}</td>
                                <td className="px-2 py-4 text-right font-black text-slate-900">{formatCurrency(c.total, false)}</td>
                                <td className="px-2 py-4 text-right font-bold text-emerald-600">{formatCurrency(c.totalPaid, false)}</td>
                                <td className="px-2 py-4 text-right font-black text-rose-600">{formatCurrency(c.totalBalance, false)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-900">
                        <tr className="font-black">
                            <td colSpan={2} className="px-2 py-4 uppercase text-[10px]">Grand Total (Period)</td>
                            <td className="px-2 py-4 text-right">{formatCurrency(topCustomers.reduce((s,c) => s + c.totalGross, 0), false)}</td>
                            <td className="px-2 py-4 text-right text-rose-600">-{formatCurrency(topCustomers.reduce((s,c) => s + (c.totalDisc1 + c.totalDisc2), 0), false)}</td>
                            <td className="px-2 py-4 text-right text-indigo-600">{formatCurrency(totalRevenue, false)}</td>
                            <td className="px-2 py-4 text-right text-emerald-600">{formatCurrency(topCustomers.reduce((s,c) => s + c.totalPaid, 0), false)}</td>
                            <td className="px-2 py-4 text-right text-rose-600">{formatCurrency(topCustomers.reduce((s,c) => s + c.totalBalance, 0), false)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {/* Mobile Card View for Performance */}
            <div className="md:hidden space-y-3">
                {topCustomers.map((c, i) => (
                    <div key={i} onClick={() => handleDrillDown('customer', c.id)} className="bg-slate-50 rounded-xl p-4 border border-slate-100 active:scale-[0.98] transition-transform">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-black text-slate-800 text-sm leading-tight">{cleanText(c.name)}</h4>
                                <p className="text-[10px] text-slate-400 font-bold mt-1">{c.invoiceCount} Invoices</p>
                            </div>
                            <span className={`text-xs font-black px-2 py-1 rounded-lg ${c.totalBalance > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {c.totalBalance > 0 ? 'Due' : 'Paid'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Net Revenue</span>
                                <span className="text-sm font-black text-indigo-900">{formatCurrency(c.total, false)}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Balance</span>
                                <span className={`text-sm font-black ${c.totalBalance > 0 ? 'text-rose-600' : 'text-slate-600'}`}>{formatCurrency(c.totalBalance, false)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderCustomerDetails = () => {
        const customer = customers.find(c => c.customer_id === selectedId);
        const custOrders = filteredOrders.filter(o => o.customer_id === selectedId);
        const totalPurchased = custOrders.reduce((sum, o) => sum + o.net_total, 0);
        const totalPaid = custOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
        const totalBalance = custOrders.reduce((sum, o) => sum + (o.balance_due || 0), 0);

        return (
            <div className="animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center mb-6 no-print">
                    <button onClick={() => setView('performance')} className="text-xs font-black text-indigo-600 uppercase">← Back to Performance</button>
                    <button onClick={handlePrint} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Print Ledger
                    </button>
                </div>
                <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-slate-800 text-xl uppercase">{cleanText(customer?.shop_name || '')}</h3>
                        <p className="text-xs text-slate-500 font-bold">{cleanText(customer?.city_ref || '')} • {customer?.phone}</p>
                    </div>
                    {customer && onOpenProfile && (
                        <button 
                            onClick={() => onOpenProfile(customer)}
                            className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl text-xs font-bold border border-indigo-100 hover:bg-indigo-50 shadow-sm flex items-center gap-2 transition-colors shrink-0 ml-4"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            Visit Profile
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                <th className="px-4 py-4">Date</th>
                                <th className="px-4 py-4">Inv #</th>
                                <th className="px-4 py-4">Delivery</th>
                                <th className="px-4 py-4 text-center">Recovery</th>
                                <th className="px-4 py-4 text-right">Items</th>
                                <th className="px-4 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {custOrders.sort((a,b) => b.order_date.localeCompare(a.order_date)).map(o => (
                                <tr key={o.order_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedOrder(o); setView('invoice'); }}>
                                    <td className="px-4 py-4 text-slate-500 font-mono text-xs">{o.order_date}</td>
                                    <td className="px-4 py-4 font-bold text-indigo-600">{settings.invoice_prefix}{o.order_id.substring(0, 6).toUpperCase()}</td>
                                    <td className="px-4 py-4 uppercase text-[9px] font-black">{o.delivery_status || 'pending'}</td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${o.payment_status === 'paid' ? 'border-emerald-200 text-emerald-600' : 'border-rose-200 text-rose-600'}`}>
                                            {o.payment_status || 'unpaid'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-400">{o.lines.length}</td>
                                    <td className="px-4 py-4 text-right font-black">{formatCurrency(o.net_total, false)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white font-black">
                            <tr><td colSpan={5} className="px-4 py-2 text-right uppercase text-[9px] text-slate-400">Total Billed</td><td className="px-4 py-2 text-right">{formatCurrency(totalPurchased, false)}</td></tr>
                            <tr className="bg-slate-800"><td colSpan={5} className="px-4 py-2 text-right uppercase text-[9px] text-emerald-400">Total Recovered</td><td className="px-4 py-2 text-right">-{formatCurrency(totalPaid, false)}</td></tr>
                            <tr><td colSpan={5} className="px-4 py-4 text-right uppercase text-[10px]">Period Balance</td><td className="px-4 py-4 text-right text-lg text-rose-500">{formatCurrency(totalBalance)}</td></tr>
                        </tfoot>
                    </table>
                </div>

                {/* Mobile Card View for Customer Details */}
                <div className="md:hidden space-y-3">
                    {custOrders.sort((a,b) => b.order_date.localeCompare(a.order_date)).map(o => (
                        <div key={o.order_id} onClick={() => { setSelectedOrder(o); setView('invoice'); }} className="bg-slate-50 p-4 rounded-xl border border-slate-100 active:scale-[0.98] transition-transform">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{settings.invoice_prefix}{o.order_id.substring(0, 6).toUpperCase()}</span>
                                    <p className="text-xs font-bold text-slate-500 mt-1">{o.order_date}</p>
                                </div>
                                <span className={`text-sm font-black ${o.payment_status === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {formatCurrency(o.net_total)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                                <span className={`text-[10px] font-black uppercase ${o.delivery_status === 'delivered' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {o.delivery_status || 'Pending Delivery'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">{o.lines.length} Items</span>
                            </div>
                        </div>
                    ))}
                    <div className="bg-slate-900 text-white p-4 rounded-xl mt-4 space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-400">Total Billed</span>
                            <span className="font-mono">{formatCurrency(totalPurchased, false)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="font-bold text-emerald-400">Recovered</span>
                            <span className="font-mono">-{formatCurrency(totalPaid, false)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-700">
                            <span>Balance Due</span>
                            <span className="text-rose-500">{formatCurrency(totalBalance)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStockReport = () => (
        <div className="overflow-x-auto animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="font-black text-slate-800 uppercase text-sm">Inventory Status</h3>
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                    {['all', 'out', 'in'].map(f => (
                        <button key={f} onClick={() => setStockFilter(f as any)} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase ${stockFilter === f ? 'bg-white shadow-sm' : 'text-slate-400'}`}>{f}</button>
                    ))}
                </div>
            </div>
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase border-b border-slate-200">
                            <th className="px-4 py-4">Part Details</th>
                            <th className="px-4 py-4">Origin</th>
                            <th className="px-4 py-4 text-right">Price</th>
                            <th className="px-4 py-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.filter(i => stockFilter === 'all' || (stockFilter === 'out' ? i.is_out_of_stock : !i.is_out_of_stock)).map(i => (
                            <tr key={i.item_id}>
                                <td className="px-4 py-4 font-bold text-slate-800">{cleanText(i.item_display_name)} <span className="block text-[10px] text-slate-400 font-mono">{cleanText(i.item_number)}</span></td>
                                <td className="px-4 py-4 text-slate-500">{cleanText(i.source_brand)}</td>
                                <td className="px-4 py-4 text-right font-mono font-bold">{formatCurrency(i.unit_value, false)}</td>
                                <td className="px-4 py-4 text-center uppercase text-[9px] font-black">{i.is_out_of_stock ? 'Out Stock' : 'In Stock'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View for Stock */}
            <div className="md:hidden space-y-3">
                {items.filter(i => stockFilter === 'all' || (stockFilter === 'out' ? i.is_out_of_stock : !i.is_out_of_stock)).map(i => (
                    <div key={i.item_id} className={`p-4 rounded-xl border ${i.is_out_of_stock ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className={`text-sm font-bold leading-tight ${i.is_out_of_stock ? 'text-rose-800' : 'text-slate-900'}`}>{cleanText(i.item_display_name)}</h4>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">{cleanText(i.item_number)}</span>
                                    <span className="text-[10px] font-bold text-slate-500">{cleanText(i.source_brand)}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block font-black text-slate-900">{formatCurrency(i.unit_value)}</span>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${i.is_out_of_stock ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {i.is_out_of_stock ? 'Out Stock' : 'In Stock'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-80px)] px-2 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 no-print shrink-0 py-4">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter">Business Intelligence</h2>
                <div className="flex items-center justify-between md:justify-start gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm w-full md:w-auto">
                    <input type="date" className="flex-1 md:w-auto text-xs font-bold text-slate-600 bg-transparent outline-none" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                    <span className="text-slate-300">→</span>
                    <input type="date" className="flex-1 md:w-auto text-xs font-bold text-slate-600 bg-transparent outline-none" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                </div>
            </div>

            <div id="report-content" className="flex-1 overflow-y-auto min-h-0 bg-white p-4 md:p-10 rounded-3xl border border-slate-100 shadow-sm text-slate-900 custom-scrollbar">
                <div id="pdf-header" className="hidden text-center border-b-2 border-slate-900 pb-6 mb-10">
                    <h1 className="text-[32px] font-black uppercase text-black m-0 tracking-tighter">{settings.company_name}</h1>
                    <p className="text-[12px] font-bold text-slate-600 mt-1">{cleanText(settings.address)}</p>
                    <div className="mt-6 inline-block bg-slate-900 text-white px-6 py-2 rounded-lg font-black text-sm tracking-widest uppercase">
                        {view === 'overview' ? 'Performance Summary' : view === 'performance' ? 'Sales Performance Report' : 'Account Ledger'}
                    </div>
                    <div className="flex justify-between mt-8 text-[10px] font-black text-slate-500 uppercase">
                        <span>Audit Period: {dateRange.start} to {dateRange.end}</span>
                        <span>Generated: {new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                {view === 'overview' && renderOverview()}
                {view === 'performance' && renderPerformanceReport()}
                {view === 'customer' && renderCustomerDetails()}
                {view === 'stock' && renderStockReport()}
                {view === 'invoice' && selectedOrder && (
                    <InvoicePreview order={selectedOrder} customer={customers.find(c => c.customer_id === selectedOrder.customer_id)!} settings={settings} onClose={() => setView('customer')} />
                )}
            </div>
        </div>
    );
};
