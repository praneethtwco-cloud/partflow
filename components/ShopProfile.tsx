import React, { useState, useEffect } from 'react';
import { Customer, Order, Payment, PaymentType } from '../types';
import { db } from '../services/database';
import { generateUUID } from '../utils/uuid';
import { formatCurrency } from '../utils/currency';
import { cleanText } from '../utils/cleanText';
import { pdfService } from '../services/pdf';
import { useTheme } from '../context/ThemeContext';

import { useToast } from '../context/ToastContext';

interface ShopProfileProps {
    customer: Customer;
    onBack: () => void;
    onViewInvoice: (order: Order) => void;
}

export const ShopProfile: React.FC<ShopProfileProps> = ({ customer, onBack, onViewInvoice }) => {
    const { themeClasses } = useTheme();
    const { showToast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Settlement Modal
    const [settleOrder, setSettleOrder] = useState<Order | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState<PaymentType>('cash');
    const [paymentRef, setPaymentRef] = useState('');
    
    // Edit Customer Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        shop_name: customer.shop_name,
        address: customer.address,
        city_ref: customer.city_ref,
        phone: customer.phone,
        credit_limit: customer.credit_limit || 0
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Load orders for this customer
        const allOrders = db.getOrders();
        const shopOrders = allOrders
            .filter(o => o.customer_id === customer.customer_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(shopOrders);
        
        // Reset edit form when customer changes
        setEditForm({
            shop_name: customer.shop_name,
            address: customer.address,
            city_ref: customer.city_ref,
            phone: customer.phone,
            credit_limit: customer.credit_limit || 0
        });
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

    const handleGenerateStatement = async () => {
        setIsGenerating(true);
        try {
            // Temporarily show the statement template for PDF generation
            const statementTemplate = document.getElementById('statement-template');
            if (statementTemplate) {
                statementTemplate.classList.remove('hidden');
                // Wait for a moment to ensure rendering
                await new Promise(resolve => setTimeout(resolve, 100));
                
                await pdfService.generatePdfFromElement('#statement-template', `Statement_${cleanText(customer.shop_name)}_${new Date().toISOString().split('T')[0]}.pdf`);
                
                // Hide it again after PDF generation
                statementTemplate.classList.add('hidden');
            } else {
                throw new Error("Statement template not found");
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to generate statement", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    // Filter out cancelled/failed delivery status - these don't count as unpaid/paid
    const activeOrders = orders.filter(o => o.delivery_status !== 'cancelled' && o.delivery_status !== 'failed');
    const unpaidOrders = activeOrders.filter(o => o.payment_status !== 'paid');
    const paidOrders = activeOrders.filter(o => o.payment_status === 'paid');

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
                <button 
                    onClick={() => setShowEditModal(true)} 
                    className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                {customer.outstanding_balance > 0 && (
                    <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Due</span>
                        <span className="text-lg font-black text-rose-600">{formatCurrency(customer.outstanding_balance)}</span>
                    </div>
                )}
            </div>

            {/* Actions Bar */}
            <div className="px-4 py-2 bg-slate-50 flex gap-2">
                <a 
                    href={`tel:${customer.phone}`}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    Call
                </a>
                <a 
                    href={`sms:${customer.phone}`}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    Message
                </a>
                <button 
                    onClick={handleGenerateStatement}
                    disabled={isGenerating}
                    className={`flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2 ${isGenerating ? 'opacity-50' : ''}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    {isGenerating ? '...' : 'Statement'}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="px-4 py-2 grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Total Spent</p>
                    <p className="text-xl font-black text-slate-800">
                        {formatCurrency(orders.reduce((sum, o) => sum + o.net_total, 0))}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Credit Limit</p>
                    <p className="text-xl font-black text-slate-800">
                        {customer.credit_limit ? formatCurrency(customer.credit_limit) : 'Unlimited'}
                    </p>
                </div>
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
                                                <p className="text-sm font-bold text-slate-900 break-all">Inv #{(order.invoice_number || order.order_id).toUpperCase()}</p>
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
                                        <p className="text-xs font-bold text-slate-700 break-all">#{(order.invoice_number || order.order_id).toUpperCase()}</p>
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
                        <p className="text-sm text-slate-500 mb-4 break-all">Inv #{(settleOrder.invoice_number || settleOrder.order_id).toUpperCase()}</p>

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
            
            {/* Edit Customer Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-black text-slate-800 mb-4">Edit Customer Details</h3>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shop Name</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                                    value={editForm.shop_name}
                                    onChange={e => setEditForm(prev => ({ ...prev, shop_name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                                    value={editForm.address}
                                    onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                                    value={editForm.city_ref}
                                    onChange={e => setEditForm(prev => ({ ...prev, city_ref: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                                    value={editForm.phone}
                                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Credit Limit</label>
                                <input
                                    type="number"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                                    value={editForm.credit_limit}
                                    onChange={e => setEditForm(prev => ({ ...prev, credit_limit: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowEditModal(false)} 
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        const updatedCustomer: Customer = {
                                            ...customer,
                                            shop_name: editForm.shop_name,
                                            address: editForm.address,
                                            city_ref: editForm.city_ref,
                                            phone: editForm.phone,
                                            credit_limit: editForm.credit_limit
                                        };
                                        await db.saveCustomer(updatedCustomer);
                                        showToast("Customer updated successfully!", "success");
                                        setShowEditModal(false);
                                    } catch (error) {
                                        console.error('Error saving customer:', error);
                                        showToast("Failed to update customer", "error");
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }} 
                                disabled={isSaving}
                                className={`flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg ${isSaving ? 'opacity-50' : ''}`}
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Hidden Statement Template */}
            <div id="statement-template" className="hidden bg-white p-8 w-[210mm] mx-auto text-slate-900">
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                    <h1 className="text-2xl font-black uppercase">{db.getSettings().company_name}</h1>
                    <p className="text-sm text-slate-600">{cleanText(db.getSettings().address)}</p>
                    <p className="text-sm text-slate-600">Tel: {db.getSettings().phone}</p>
                    <h2 className="text-xl font-bold mt-4 uppercase underline">Customer Statement</h2>
                </div>

                <div className="flex justify-between mb-8">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Statement For:</p>
                        <p className="text-lg font-bold">{cleanText(customer.shop_name)}</p>
                        <p className="text-sm">{cleanText(customer.address)}</p>
                        <p className="text-sm">{cleanText(customer.city_ref)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase">Date:</p>
                        <p className="font-bold">{new Date().toLocaleDateString()}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase mt-2">Total Due:</p>
                        <p className="text-xl font-black text-rose-600">{formatCurrency(unpaidOrders.reduce((sum, order) => sum + (order.balance_due || 0), 0))}</p>
                    </div>
                </div>

                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-200 text-left">
                            <th className="py-2 font-bold uppercase text-xs">Date</th>
                            <th className="py-2 font-bold uppercase text-xs">Invoice #</th>
                            <th className="py-2 text-right font-bold uppercase text-xs">Amount</th>
                            <th className="py-2 text-right font-bold uppercase text-xs">Paid</th>
                            <th className="py-2 text-right font-bold uppercase text-xs">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {unpaidOrders.map(order => (
                            <tr key={order.order_id} className="border-b border-slate-100">
                                <td className="py-3">{order.order_date}</td>
                                <td className="py-3 font-mono break-all">{(order.invoice_number || order.order_id).toUpperCase()}</td>
                                <td className="py-3 text-right">{formatCurrency(order.net_total, false)}</td>
                                <td className="py-3 text-right">{formatCurrency(order.paid_amount, false)}</td>
                                <td className="py-3 text-right font-bold">{formatCurrency(order.balance_due, false)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-slate-900 font-bold">
                            <td colSpan={2} className="py-4 text-right uppercase text-xs">Total Outstanding</td>
                            <td className="py-4 text-right">{formatCurrency(unpaidOrders.reduce((sum, order) => sum + order.net_total, 0), false)}</td>
                            <td className="py-4 text-right">{formatCurrency(unpaidOrders.reduce((sum, order) => sum + (order.paid_amount || 0), 0), false)}</td>
                            <td className="py-4 text-right text-rose-600 text-lg">{formatCurrency(unpaidOrders.reduce((sum, order) => sum + (order.balance_due || 0), 0), false)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-12 text-center text-xs text-slate-400 italic">
                    <p>Thank you for your business.</p>
                </div>
            </div>
        </div>
    );
};