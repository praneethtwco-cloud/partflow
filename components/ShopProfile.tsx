import React, { useState, useEffect } from 'react';
import { Customer, Order, Payment, PaymentType } from '../types';
import { db } from '../services/db';
import { generateUUID } from '../utils/uuid';
import { formatCurrency } from '../utils/currency';
import { cleanText } from '../utils/cleanText';

import { useToast } from '../context/ToastContext';

interface ShopProfileProps {
    customer: Customer;
    onBack: () => void;
    onViewInvoice: (order: Order) => void;
}

export const ShopProfile: React.FC<ShopProfileProps> = ({ customer, onBack, onViewInvoice }) => {
    const { showToast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    
    // Settlement Modal
    const [settleOrder, setSettleOrder] = useState<Order | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState<PaymentType>('cash');
    const [paymentRef, setPaymentRef] = useState('');

    useEffect(() => {
        // Load orders for this customer
        const allOrders = db.getOrders();
        const shopOrders = allOrders
            .filter(o => o.customer_id === customer.customer_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(shopOrders);
    }, [customer]);

    const handleSettle = async () => {
        if (!settleOrder) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            showToast("Please enter a valid amount", "warning");
            return;
        }

        const payment: Payment = {
            payment_id: generateUUID(),
            order_id: settleOrder.order_id,
            amount: amount,
            payment_date: new Date().toISOString(),
            payment_type: paymentType,
            reference_number: paymentRef,
            notes: 'Settlement via Shop Profile'
        };

        await db.addPayment(payment);
        
        // Refresh
        const allOrders = db.getOrders();
        const shopOrders = allOrders
            .filter(o => o.customer_id === customer.customer_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(shopOrders);
        
        setSettleOrder(null);
        setPaymentAmount('');
        setPaymentRef('');
    };

    const unpaidOrders = orders.filter(o => o.payment_status !== 'paid');
    const paidOrders = orders.filter(o => o.payment_status === 'paid');

    const getDeliveryColor = (status: any) => {
        switch (status) {
            case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'out_for_delivery': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
            case 'shipped': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'failed': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'cancelled': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-amber-50 text-amber-700 border-amber-100';
        }
    };

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="bg-white p-4 sticky top-0 z-10 border-b border-slate-200 flex items-center gap-3">
                <button onClick={onBack} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-black text-slate-900">{cleanText(customer.shop_name)}</h2>
                    <p className="text-xs text-slate-500">{customer.city_ref}</p>
                </div>
                {customer.outstanding_balance > 0 && (
                    <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Due</span>
                        <span className="text-lg font-black text-rose-600">{formatCurrency(customer.outstanding_balance)}</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
                
                {/* Outstanding Section */}
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                        Outstanding Invoices
                    </h3>
                    {unpaidOrders.length === 0 ? (
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                            <p className="text-emerald-700 font-bold text-sm">All invoices paid!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {unpaidOrders.map(order => (
                                <div key={order.order_id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
                                    <div className="flex justify-between items-start mb-2 pl-2">
                                        <div>
                                            <p className="text-xs font-mono font-bold text-slate-400">{order.order_date}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-slate-900">Inv #{order.order_id.substring(0,6).toUpperCase()}</p>
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${getDeliveryColor(order.delivery_status || 'pending')}`}>
                                                    {order.delivery_status || 'pending'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400">Balance</p>
                                            <p className="text-lg font-black text-rose-600">{formatCurrency(order.balance_due)}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pl-2 pt-2 border-t border-slate-50 mt-2">
                                        <button onClick={() => onViewInvoice(order)} className="text-xs font-bold text-slate-500 underline">View Invoice</button>
                                        <button 
                                            onClick={() => {
                                                setSettleOrder(order);
                                                setPaymentAmount(order.balance_due.toFixed(2)); // Default to full due
                                            }}
                                            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg active:scale-95 transition-transform"
                                        >
                                            Settle Payment
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* History Section */}
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                        Recent History
                    </h3>
                    <div className="space-y-2">
                        {paidOrders.slice(0, 5).map(order => (
                            <div key={order.order_id} onClick={() => onViewInvoice(order)} className="bg-slate-50 p-3 rounded-lg flex justify-between items-center cursor-pointer active:bg-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-slate-700">#{order.order_id.substring(0,6).toUpperCase()}</p>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${getDeliveryColor(order.delivery_status || 'pending')}`}>
                                            {order.delivery_status || 'pending'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">{order.order_date}</p>
                                </div>
                                <span className="text-sm font-bold text-emerald-600">Paid {formatCurrency(order.net_total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Settlement Modal */}
            {settleOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-black text-slate-800 mb-1">Settle Invoice</h3>
                        <p className="text-sm text-slate-500 mb-4">Inv #{settleOrder.order_id.substring(0,6).toUpperCase()}</p>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (Due: {settleOrder.balance_due})</label>
                                <input 
                                    type="number" 
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-xl font-bold focus:border-indigo-500 focus:outline-none"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                                <select 
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                                    value={paymentType}
                                    onChange={e => setPaymentType(e.target.value as PaymentType)}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="bank_transfer">Transfer</option>
                                </select>
                            </div>
                            {paymentType !== 'cash' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ref No.</label>
                                    <input 
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                                        value={paymentRef}
                                        onChange={e => setPaymentRef(e.target.value)}
                                        placeholder="Check/Trans ID"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSettleOrder(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl">Cancel</button>
                            <button onClick={handleSettle} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};