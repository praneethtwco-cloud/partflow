import React from 'react';
import { Order, Customer, CompanySettings, OrderLine } from '../types';
import { pdfService } from '../services/pdf';
import { formatCurrency } from '../utils/currency';
import { cleanText } from '../utils/cleanText';

import { useToast } from '../context/ToastContext';

interface InvoicePreviewProps {
    order: Order;
    customer: Customer;
    settings: CompanySettings;
    onClose: () => void;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ order, customer, settings, onClose }) => {
    const { showToast } = useToast();
    
    // Pagination Logic
    const ITEMS_PER_PAGE_1 = 20; 
    const ITEMS_PER_PAGE_REST = 20;

    const paginateLines = (lines: OrderLine[]) => {
        const pages: OrderLine[][] = [];
        if (!lines || lines.length === 0) return [[]];
        
        if (lines.length <= 20) {
            pages.push(lines);
            return pages;
        }

        pages.push(lines.slice(0, ITEMS_PER_PAGE_1));
        let remaining = lines.slice(ITEMS_PER_PAGE_1);
        while (remaining.length > 0) {
            pages.push(remaining.slice(0, ITEMS_PER_PAGE_REST));
            remaining = remaining.slice(ITEMS_PER_PAGE_REST);
        }
        return pages;
    };

    if (!order || !customer) {
        return (
            <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-slate-500 font-bold mb-4">Error: Order data missing.</p>
                    <button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Go Back</button>
                </div>
            </div>
        );
    }

    const linePages = paginateLines(order.lines || []);
    const safeInvNo = (order.order_id || '').toUpperCase();

    const handleDownload = async () => {
        try {
            await pdfService.generateInvoice(order, customer, settings, '.invoice-page');
        } catch (error) {
            console.error(error);
            showToast("Failed to generate PDF.", "error");
        }
    };

    const handleShare = async () => {
        try {
            await pdfService.shareInvoice(order, customer, settings, '.invoice-page');
        } catch (error) {
            console.error(error);
            showToast("Failed to share PDF.", "error");
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] overflow-y-auto flex justify-center p-0 md:p-4 backdrop-blur-sm">
            <div className="w-full max-w-5xl bg-white shadow-2xl flex flex-col relative min-h-screen md:min-h-0 md:rounded-2xl overflow-hidden">
                
                {/* Controls Bar */}
                <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-[110] md:rounded-t-2xl">
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-full active:scale-90 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleShare} 
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            Share
                        </button>
                        <button 
                            onClick={handleDownload} 
                            className="bg-white text-slate-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-slate-200 shadow-sm active:scale-95 transition-all text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Save
                        </button>
                    </div>
                </div>

                {/* Actual Invoice Content */}
                <div className="flex-1 overflow-auto p-4 md:p-12 bg-slate-100 flex flex-col gap-8">
                    {linePages.map((pageLines, pageIndex) => {
                        const isFirstPage = pageIndex === 0;
                        const isLastPage = pageIndex === linePages.length - 1;
                        const isMultiPage = linePages.length > 1;

                        const previousLines = linePages.slice(0, pageIndex).flat();
                        const previousTotal = previousLines.reduce((sum, l) => sum + l.line_total, 0);
                        const currentPageTotal = pageLines.reduce((sum, l) => sum + l.line_total, 0);
                        const cumulativeTotal = previousTotal + currentPageTotal;

                        return (
                            <div 
                                key={pageIndex}
                                className="invoice-page bg-white text-black p-[15mm] w-[210mm] min-h-[297mm] shadow-xl font-sans text-[12px] leading-tight relative flex flex-col shrink-0 mx-auto"
                            >
                                {/* Header */}
                                {isFirstPage ? (
                                    <div className="text-center border-b-2 border-black pb-2 mb-5">
                                        <h1 className="text-[28px] font-black text-black m-0 leading-none uppercase tracking-tighter">{settings.company_name}</h1>
                                        <p className="mt-1 font-medium">{cleanText(settings.address)}</p>
                                        <p className="m-0 font-medium text-slate-700">Tel: {settings.phone} | Email: vidushan.motors@gmail.com</p>
                                        <div className="text-[22px] font-bold underline mt-4 uppercase">INVOICE</div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between border-b border-black pb-2 mb-5">
                                        <span className="font-bold uppercase">{settings.company_name} - Page {pageIndex + 1}</span>
                                        <span className="font-bold">Inv: {settings.invoice_prefix}{safeInvNo}</span>
                                    </div>
                                )}

                                {/* Info Grid */}
                                {isFirstPage && (
                                    <div className="flex justify-between mb-6">
                                        <div className="w-1/2">
                                            <p className="font-bold mb-1 uppercase text-[10px] text-slate-500">Bill To:</p>
                                            <div className="font-black text-[16px] uppercase leading-tight mb-1">{cleanText(customer.shop_name)}</div>
                                            <p className="font-medium text-slate-700">{cleanText(customer.address)}</p>
                                            <p className="font-medium text-slate-700">{cleanText(customer.city_ref)}</p>
                                            <p className="mt-1 font-bold">Tel: {customer.phone}</p>
                                        </div>
                                        <div className="w-[40%]">
                                            <div className="flex mb-1 justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px]">Date:</span>
                                                <span className="font-bold">{order.order_date}</span>
                                            </div>
                                            <div className="flex mb-1 justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px]">Invoice No:</span>
                                                <span className="font-black text-indigo-600">{settings.invoice_prefix}{safeInvNo}</span>
                                            </div>
                                            <div className="flex mb-1 justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px]">Rep:</span>
                                                <span className="font-bold">{settings.rep_name || 'Vidushan'}</span>
                                            </div>
                                             <div className="flex mb-1 justify-between border-t pt-1 mt-1">
                                                 <span className="font-bold text-slate-500 uppercase text-[10px]">Terms:</span>
                                                 <span className="font-bold italic text-[10px]">CREDIT {customer.credit_period || 90} DAYS</span>
                                             </div>
                                          </div>
                                      </div>
                                  )}

                                {/* Items Table */}
                                <table className="w-full border-collapse mb-5 overflow-hidden rounded-lg">
                                    <thead>
                                        <tr className="bg-slate-100 border-y border-black">
                                            <th className="p-2 w-[5%] text-center font-black uppercase text-[10px]">No</th>
                                            <th className="p-2 w-[55%] text-left font-black uppercase text-[10px]">Description</th>
                                            <th className="p-2 w-[10%] text-center font-black uppercase text-[10px]">Qty</th>
                                            <th className="p-2 w-[15%] text-right font-black uppercase text-[10px]">Price</th>
                                            <th className="p-2 w-[15%] text-right font-black uppercase text-[10px]">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pageLines.map((line, idx) => {
                                            const globalIdx = linePages.slice(0, pageIndex).flat().length + idx;
                                            return (
                                                <tr key={line.line_id} className="even:bg-slate-50/50">
                                                    <td className="p-2 text-center font-medium">{globalIdx + 1}</td>
                                                    <td className="p-2 font-bold uppercase text-[11px]">{cleanText(line.item_name)}</td>
                                                    <td className="p-2 text-center font-bold">{line.quantity}</td>
                                                    <td className="p-2 text-right font-medium">{formatCurrency(line.unit_value, false)}</td>
                                                    <td className="p-2 text-right font-black">{formatCurrency(line.line_total, false)}</td>
                                                </tr>
                                            );
                                        })}
                                        {isMultiPage && !isLastPage && (
                                            <tr className="font-black bg-slate-100 border-t border-black">
                                                <td colSpan={4} className="p-2 text-right uppercase italic text-[10px]">Sub Total (C/F)</td>
                                                <td className="p-2 text-right underline decoration-double">
                                                    {formatCurrency(cumulativeTotal, false)}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Footer Summary */}
                                {isLastPage && (
                                    <div className="mt-auto pt-4">
                                        <div className="flex justify-end">
                                            <table className="w-[45%] border-collapse overflow-hidden rounded-lg">
                                                <tbody className="divide-y divide-slate-100">
                                                    <tr>
                                                        <td className="px-3 py-2 text-left font-bold uppercase text-[10px]">Gross Total</td>
                                                        <td className="px-3 py-2 text-right font-black">
                                                            {formatCurrency(order.gross_total, false)}
                                                        </td>
                                                    </tr>
                                                    {(order.discount_value || 0) > 0 && (
                                                        <>
                                                            <tr>
                                                                <td className="px-3 py-2 text-left font-bold text-rose-600 uppercase text-[9px]">
                                                                    Discount - {((order.discount_rate || 0) * 100).toFixed(0)}%
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-black text-rose-600">
                                                                    -{formatCurrency(order.discount_value || 0, false)}
                                                                </td>
                                                            </tr>
                                                            {(order.secondary_discount_value || 0) > 0 && (
                                                                <tr className="bg-slate-50 border-t border-slate-100">
                                                                    <td className="px-3 py-1.5 text-left font-bold uppercase text-[9px] text-slate-500">
                                                                        Sub Total
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right font-black text-slate-700">
                                                                        {formatCurrency(order.gross_total - (order.discount_value || 0), false)}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    )}
                                                    {(order.secondary_discount_value || 0) > 0 && (
                                                        <tr>
                                                            <td className="px-3 py-2 text-left font-bold text-rose-600 uppercase text-[9px]">
                                                                Discount - {((order.secondary_discount_rate || 0) * 100).toFixed(0)}%
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black text-rose-600">
                                                                -{formatCurrency(order.secondary_discount_value || 0, false)}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    <tr className="bg-slate-100 border-y border-black">
                                                        <td className="px-3 py-3 text-left font-black text-[14px] uppercase tracking-tighter">Net Total</td>
                                                        <td className="px-3 py-3 text-right font-black text-[16px]">
                                                            {formatCurrency(order.net_total)}
                                                        </td>
                                                    </tr>
                                                    { (order.paid_amount || 0) > 0 && (
                                                        <tr>
                                                            <td className="px-3 py-2 text-left font-bold text-emerald-700 uppercase text-[10px]">Paid Amount</td>
                                                            <td className="px-3 py-2 text-right font-black text-emerald-700">
                                                                -{formatCurrency(order.paid_amount || 0, false)}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex justify-between mt-16 mb-8">
                                            <div className="w-[30%] border-t border-black pt-2 text-center text-[10px] font-black uppercase">Customer Signature</div>
                                            <div className="w-[30%] border-t border-black pt-2 text-center text-[10px] font-black uppercase">Authorized Signature</div>
                                            <div className="w-[30%] border-t border-black pt-2 text-center text-[10px] font-black uppercase">Checked By</div>
                                        </div>
                                        <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{settings.footer_note}</p>
                                    </div>
                                )}

                                <div className="absolute bottom-4 left-0 right-0 text-center text-[9px] text-slate-400 font-bold">
                                    Page {pageIndex + 1} of {linePages.length} | System Generated Invoice
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
