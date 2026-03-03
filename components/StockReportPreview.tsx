import * as React from 'react';
import { Item, CompanySettings } from '../types';
import { pdfService } from '../services/pdf';
import { formatCurrency } from '../utils/currency';
import { cleanText } from '../utils/cleanText';
import { useToast } from '../context/ToastContext';

interface StockReportPreviewProps {
    items: Item[];
    settings: CompanySettings;
    filter: 'all' | 'out' | 'in';
    onClose: () => void;
}

const ITEMS_PER_PAGE_1 = 15;
const ITEMS_PER_PAGE_REST = 25;

const StockReportPreview: React.FC<StockReportPreviewProps> = ({ items, settings, filter, onClose }) => {
    const { showToast } = useToast();
    const [currentPage, setCurrentPage] = React.useState(0);

    const filteredItems = items.filter(i => filter === 'all' || (filter === 'out' ? i.is_out_of_stock : !i.is_out_of_stock));

    const totalItems = filteredItems.length;
    const outOfStockCount = filteredItems.filter(i => i.is_out_of_stock).length;
    const inStockCount = filteredItems.filter(i => !i.is_out_of_stock).length;
    const totalInventoryValue = filteredItems.reduce((sum, i) => sum + (i.unit_value || 0), 0);

    const paginateItems = (allItems: Item[]) => {
        const pages: Item[][] = [];
        if (!allItems || allItems.length === 0) return [[]];

        if (allItems.length <= ITEMS_PER_PAGE_1) {
            pages.push(allItems);
            return pages;
        }

        pages.push(allItems.slice(0, ITEMS_PER_PAGE_1));
        let remaining = allItems.slice(ITEMS_PER_PAGE_1);
        while (remaining.length > 0) {
            pages.push(remaining.slice(0, ITEMS_PER_PAGE_REST));
            remaining = remaining.slice(ITEMS_PER_PAGE_REST);
        }
        return pages;
    };

    const itemPages = paginateItems(filteredItems);
    const isMultiPage = itemPages.length > 1;

    const handlePrint = () => {
        window.print();
    };

    const handleSave = async () => {
        try {
            const fileName = `StockReport_${new Date().toISOString().split('T')[0]}.pdf`;
            await pdfService.generatePdfFromElement('.stock-report-page', fileName);
            showToast('PDF saved successfully', 'success');
        } catch (error) {
            console.error('Save PDF error:', error);
            showToast('Failed to save PDF', 'error');
        }
    };

    const handleShare = async () => {
        try {
            const fileName = `StockReport_${new Date().toISOString().split('T')[0]}.pdf`;
            const { blob } = await pdfService.generatePdfFromElement('.stock-report-page', fileName);
            
            if (navigator.share) {
                const file = new File([blob], fileName, { type: 'application/pdf' });
                await navigator.share({
                    title: 'Stock Report',
                    text: `Stock Status Report - ${new Date().toLocaleDateString()}`,
                    files: [file]
                });
            } else {
                showToast('Sharing not supported on this device', 'error');
            }
        } catch (error) {
            console.error('Share error:', error);
            showToast('Failed to share PDF', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] overflow-y-auto flex justify-center p-0 md:p-4 backdrop-blur-sm">
            <div className="w-full max-w-5xl bg-white shadow-2xl flex flex-col relative min-h-screen md:min-h-0 md:rounded-2xl overflow-hidden">
                {/* Controls Bar */}
                <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-[110] md:rounded-t-2xl">
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-full active:scale-90 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    {isMultiPage && (
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                disabled={currentPage === 0}
                                className="p-2 bg-slate-100 rounded-full disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <span className="text-sm font-bold">{currentPage + 1} / {itemPages.length}</span>
                            <button 
                                onClick={() => setCurrentPage(Math.min(itemPages.length - 1, currentPage + 1))}
                                disabled={currentPage === itemPages.length - 1}
                                className="p-2 bg-slate-100 rounded-full disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 transition-all text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Print
                        </button>
                        <button
                            onClick={handleShare}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            Share
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-white text-slate-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-slate-200 shadow-sm active:scale-95 transition-all text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Save
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-100 flex flex-col gap-8">
                    {itemPages.map((pageItems, pageIndex) => {
                        const isFirstPage = pageIndex === 0;
                        const isLastPage = pageIndex === itemPages.length - 1;
                        const previousItems = itemPages.slice(0, pageIndex).flat();
                        const previousValue = previousItems.reduce((sum, i) => sum + (i.unit_value || 0), 0);
                        const currentPageValue = pageItems.reduce((sum, i) => sum + (i.unit_value || 0), 0);
                        const cumulativeValue = previousValue + currentPageValue;

                        return (
                            <div
                                key={pageIndex}
                                className="stock-report-page bg-white text-black p-[15mm] w-[210mm] min-h-[297mm] font-sans text-[12px] leading-tight relative flex flex-col shrink-0 mx-auto"
                                style={{ boxShadow: 'none', minHeight: '297mm' }}
                            >
                                {/* Header - Only on first page */}
                                {isFirstPage && (
                                    <div className="text-center border-b-2 border-black pb-2 mb-4">
                                        {settings.logo_base64 ? (
                                            <div className="flex justify-center mb-1">
                                                <img src={settings.logo_base64} alt="Logo" className="h-10 object-contain" />
                                            </div>
                                        ) : null}
                                        <h1 className="text-[26px] font-black text-black m-0 leading-tight uppercase tracking-tighter">{settings.company_name}</h1>
                                        <p className="mt-0.5 font-medium text-[11px]">{cleanText(settings.address)}</p>
                                        <p className="m-0 font-medium text-[10px] text-slate-700">Tel: {settings.phone}</p>
                                        <div className="text-[20px] font-bold underline mt-1 uppercase">STOCK STATUS REPORT</div>
                                    </div>
                                )}

                                {/* Continuation Header - For subsequent pages */}
                                {!isFirstPage && (
                                    <div className="flex justify-between border-b border-black pb-2 mb-4">
                                        <span className="font-bold uppercase">{settings.company_name} - Stock Report</span>
                                        <span className="font-bold">Page {pageIndex + 1}</span>
                                    </div>
                                )}

                                {/* Info Grid - Only on first page */}
                                {isFirstPage && (
                                    <div className="flex justify-between mb-4">
                                        <div className="w-1/2">
                                            <p className="font-bold mb-1 uppercase text-[10px] text-slate-500">Report Details:</p>
                                            <p className="font-medium">Location: Main Warehouse</p>
                                            <p className="font-medium">Category: General Inventory</p>
                                            <p className="font-bold">Generated By: {settings.rep_name || 'Sales Rep'}</p>
                                        </div>
                                        <div className="w-[40%]">
                                            <div className="flex mb-1 justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px]">Date:</span>
                                                <span className="font-bold">{new Date().toLocaleDateString('en-GB')}</span>
                                            </div>
                                            <div className="flex mb-1 justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px]">Report No:</span>
                                                <span className="font-black">SR-{new Date().getFullYear()}-{String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}</span>
                                            </div>
                                            <div className="flex mb-1 justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px]">Time:</span>
                                                <span className="font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="flex mb-1 justify-between">
                                                <span className="font-bold text-slate-500 uppercase text-[10px]">Filter:</span>
                                                <span className="font-bold uppercase">{filter === 'all' ? 'All Items' : filter === 'out' ? 'Out of Stock' : 'In Stock'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Items Table */}
                                <table className="w-full border-collapse mb-4">
                                    <thead>
                                        <tr className="bg-slate-100 border-y border-black">
                                            <th className="py-2 px-2 text-center font-black uppercase text-[10px] w-[15%]">Part Number</th>
                                            <th className="py-2 px-2 text-left font-black uppercase text-[10px] w-[30%]">Part Details</th>
                                            <th className="py-2 px-2 text-center font-black uppercase text-[10px] w-[15%]">Vehicle Model</th>
                                            <th className="py-2 px-2 text-left font-black uppercase text-[10px] w-[15%]">Brand</th>
                                            <th className="py-2 px-2 text-right font-black uppercase text-[10px] w-[15%]">Price (Rs)</th>
                                            <th className="py-2 px-2 text-center font-black uppercase text-[10px] w-[10%]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pageItems.map((item, idx) => (
                                            <tr key={item.item_id} className={idx % 2 === 0 ? '' : 'bg-slate-50/50'}>
                                                <td className="py-2 px-2 text-center font-mono text-[11px] align-middle">{cleanText(item.item_number)}</td>
                                                <td className="py-2 px-2 font-bold uppercase text-[11px] align-middle">{cleanText(item.item_display_name)}</td>
                                                <td className="py-2 px-2 text-center font-medium text-[11px] align-middle">{cleanText(item.vehicle_model || '-')}</td>
                                                <td className="py-2 px-2 font-medium text-[11px] align-middle">{cleanText(item.source_brand)}</td>
                                                <td className="py-2 px-2 text-right font-mono font-bold text-[11px] align-middle">{formatCurrency(item.unit_value, false)}</td>
                                                <td className={`py-2 px-2 text-center font-black uppercase text-[10px] align-middle ${item.is_out_of_stock ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {item.is_out_of_stock ? 'Out Stock' : 'In Stock'}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Subtotal row for multi-page (not last page) */}
                                        {isMultiPage && !isLastPage && (
                                            <tr className="font-black bg-slate-100 border-t border-black">
                                                <td colSpan={4} className="py-1 px-2 text-right uppercase italic text-[10px]">Sub Total (C/F)</td>
                                                <td className="py-1 px-2 text-right font-mono underline decoration-double">{formatCurrency(cumulativeValue, false)}</td>
                                                <td></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Summary Section - Only on last page */}
                                {isLastPage && (
                                    <div className="mt-auto pt-4">
                                        <div className="flex justify-end">
                                            <div className="w-[40%]">
                                                <div className="flex justify-between py-1">
                                                    <span className="font-bold">Total Items Listed</span>
                                                    <span className="font-black">{totalItems}</span>
                                                </div>
                                                <div className="flex justify-between py-1">
                                                    <span className="font-bold">Items In Stock</span>
                                                    <span className="font-black text-emerald-600">{inStockCount}</span>
                                                </div>
                                                <div className="flex justify-between py-1">
                                                    <span className="font-bold">Items Out of Stock</span>
                                                    <span className="font-black text-rose-600">{outOfStockCount}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-t-2 border-b-4 border-double border-black mt-1">
                                                    <span className="font-black text-[14px] uppercase">Total Active Inventory Value</span>
                                                    <span className="font-black text-[14px]">Rs. {formatCurrency(totalInventoryValue, false)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Signatures */}
                                        <div className="flex justify-between mt-16 mb-8">
                                            <div className="w-[30%] border-t border-black pt-1 text-center text-[10px] font-black uppercase">Prepared By</div>
                                            <div className="w-[30%] border-t border-black pt-1 text-center text-[10px] font-black uppercase">Checked By</div>
                                            <div className="w-[30%] border-t border-black pt-1 text-center text-[10px] font-black uppercase">Authorized Manager</div>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute bottom-4 left-0 right-0 text-center text-[9px] text-slate-400 font-bold">
                                    Page {pageIndex + 1} of {itemPages.length} | Generated by PartFlow Pro
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default StockReportPreview;
