import React, { useState, useEffect } from 'react';
import { Customer, Item, Order, OrderLine, Payment, PaymentType } from '../types';
import { db } from '../services/db';
import { generateUUID } from '../utils/uuid';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { useToast } from '../context/ToastContext';
import { cleanText } from '../utils/cleanText';
import { useTheme } from '../context/ThemeContext';

interface OrderBuilderProps {
  onCancel: () => void;
  onOrderCreated: (order: Order) => void;
  existingCustomer?: Customer;
  editingOrder?: Order;
  draftState?: Partial<Order> | null;
  onUpdateDraft?: (draft: Partial<Order>) => void;
}

export const OrderBuilder: React.FC<OrderBuilderProps> = ({ onCancel, onOrderCreated, existingCustomer, editingOrder, draftState, onUpdateDraft }) => {
    const { themeClasses } = useTheme();
    const { showToast } = useToast();
    const { user } = useAuth();
    const settings = db.getSettings();
    const [customer] = useState<Customer | undefined>(existingCustomer || (editingOrder ? db.getCustomers().find(c => c.customer_id === editingOrder.customer_id) : undefined));
    const [items, setItems] = useState<Item[]>([]);
    const [lines, setLines] = useState<OrderLine[]>(draftState?.lines || editingOrder?.lines || []);
    const [orderDate, setOrderDate] = useState(draftState?.order_date || editingOrder?.order_date || new Date().toISOString().split('T')[0]);
    const [discountRate, setDiscountRate] = useState<number>((draftState?.discount_rate !== undefined ? draftState.discount_rate : (editingOrder ? editingOrder.discount_rate : (existingCustomer?.discount_rate || 0))) * 100);
    const [secondaryDiscountRate, setSecondaryDiscountRate] = useState<number>((draftState?.secondary_discount_rate !== undefined ? draftState.secondary_discount_rate : (editingOrder ? (editingOrder.secondary_discount_rate || 0) : (existingCustomer?.secondary_discount_rate || 0))) * 100);
    const [taxRate, setTaxRate] = useState<number>((draftState?.tax_rate !== undefined ? draftState.tax_rate : (editingOrder ? (editingOrder.tax_rate || 0) : (settings.tax_rate || 0))) * 100);
    
    // Utility function to extract the numeric part from an invoice number
    const extractInvoiceNumber = (invoiceNumber: string): number => {
        const match = invoiceNumber.match(/\d+$/);
        if (match) {
            return parseInt(match[0], 10);
        }
        return 0;
    };
    
    // Invoice Number State
    const [invoiceNumber, setInvoiceNumber] = useState<string>(() => {
        if (editingOrder) {
            return editingOrder.invoice_number || '';
        } else {
            // For new orders, generate the next sequential invoice number
            const settings = db.getSettings();
            const prefix = settings.invoice_prefix || 'INV';
            const startingNumber = settings.starting_invoice_number || 1;

            // Find the highest invoice number currently in the system
            const orders = db.getOrders();
            const invoiceNumbers = orders
                .filter(order => order.invoice_number) // Only consider orders with invoice numbers
                .map(order => extractInvoiceNumber(order.invoice_number!));

            // Determine the next number to use
            const highestNumber = invoiceNumbers.length > 0 ? Math.max(...invoiceNumbers) : 0;
            const nextNumber = highestNumber > 0 ? highestNumber + 1 : startingNumber;

            // Format the number with zero padding (minimum 4 digits)
            const paddedNumber = nextNumber.toString().padStart(4, '0');

            // Combine prefix and padded number
            return `${prefix}${paddedNumber}`;
        }
    });
    const [useSuggestedInvoiceNumber, setUseSuggestedInvoiceNumber] = useState<boolean>(!editingOrder?.invoice_number);
    const [invoiceNumberError, setInvoiceNumberError] = useState<string>('');
    
    // UI State
    const [catalogSearch, setCatalogSearch] = useState('');
    const [cartSearch, setCartSearch] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [modelFilter, setModelFilter] = useState('All');
    const [countryFilter, setCountryFilter] = useState('All');
    const [sortOrder, setSortOrder] = useState<'A-Z' | 'Price-High' | 'Price-Low'>('A-Z');
    const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog'); // Mobile Toggle
    const [showScanner, setShowScanner] = useState(false);
    const [showOutOfStock, setShowOutOfStock] = useState(true);
    
    // Add Item Modal/State
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [qtyInput, setQtyInput] = useState<string>('1');

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentType, setPaymentType] = useState<PaymentType>('cash');
    const [paymentRef, setPaymentRef] = useState('');

    const searchContainerRef = React.useRef<HTMLDivElement>(null);

    // Click outside handler for search dropdown
    useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (mobileTab === 'cart' && searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
            setCartSearch('');
        }
    };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [mobileTab]);

    useEffect(() => {
        const allItems = db.getItems();
        // Deduplicate by SKU (item_number) to ensure same SKU doesn't show multiple lines
        const uniqueItems: Item[] = [];
        const skus = new Set();
        allItems.forEach(item => {
            if (!skus.has(item.item_number)) {
                skus.add(item.item_number);
                uniqueItems.push(item);
            }
        });
        setItems(uniqueItems);
    }, []);

    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        if (showScanner) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
            scanner.render((decodedText) => {
                if (mobileTab === 'catalog') setCatalogSearch(decodedText);
                else setCartSearch(decodedText);
                setShowScanner(false);
                if (scanner) scanner.clear();
            }, () => {});
        }
        return () => {
            if (scanner) scanner.clear().catch(e => console.error("Scanner Cleanup Error", e));
        };
    }, [showScanner]);

    useEffect(() => {
        if (onUpdateDraft) {
            onUpdateDraft({
                lines,
                order_date: orderDate,
                discount_rate: discountRate / 100,
                secondary_discount_rate: secondaryDiscountRate / 100,
                tax_rate: taxRate / 100,
                invoice_number: invoiceNumber
            });
        }
    }, [lines, orderDate, discountRate, secondaryDiscountRate, taxRate, invoiceNumber]);

    // Effect to handle suggested invoice number (using sequential numbering)
    useEffect(() => {
        if (useSuggestedInvoiceNumber) {
            // Generate the next sequential invoice number based on settings
            const settings = db.getSettings();
            const prefix = settings.invoice_prefix || 'INV';
            const startingNumber = settings.starting_invoice_number || 1;

            // Find the highest invoice number currently in the system
            const orders = db.getOrders();
            const invoiceNumbers = orders
                .filter(order => order.invoice_number) // Only consider orders with invoice numbers
                .map(order => extractInvoiceNumber(order.invoice_number!));

            // Determine the next number to use
            const highestNumber = invoiceNumbers.length > 0 ? Math.max(...invoiceNumbers) : 0;
            const nextNumber = highestNumber > 0 ? highestNumber + 1 : startingNumber;

            // Format the number with zero padding (minimum 4 digits)
            const paddedNumber = nextNumber.toString().padStart(4, '0');

            // Combine prefix and padded number
            const suggestedNumber = `${prefix}${paddedNumber}`;

            setInvoiceNumber(suggestedNumber);
            setInvoiceNumberError('');
        }
    }, [useSuggestedInvoiceNumber]);

    // Effect to validate invoice number when it changes
    useEffect(() => {
        if (!useSuggestedInvoiceNumber && invoiceNumber) {
            // Validate that the invoice number follows the correct format (prefix + number)
            const settings = db.getSettings();
            const prefix = settings.invoice_prefix || 'INV';
            const regex = new RegExp(`^${prefix}\\d+$`);

            if (!regex.test(invoiceNumber)) {
                setInvoiceNumberError(`Invalid format. Must start with "${prefix}" followed by numbers.`);
                return;
            }

            // Validate that the invoice number is unique in the system
            const orders = db.getOrders();
            const existingOrder = orders.find(
                order => order.invoice_number === invoiceNumber && order.order_id !== editingOrder?.order_id
            );

            if (existingOrder) {
                setInvoiceNumberError('Invoice number already exists. Please choose a different one.');
                return;
            }

            setInvoiceNumberError('');
        }
    }, [invoiceNumber, useSuggestedInvoiceNumber, editingOrder?.order_id, editingOrder?.approval_status]);

    const grossTotal = lines.reduce((sum, line) => sum + line.line_total, 0);
    const primaryDiscountValue = grossTotal * (discountRate / 100);
    const amountAfterPrimary = grossTotal - primaryDiscountValue;
    // Allow editing for all orders (including synced/approved ones)
    const isEditingDisabled = false;

    const secondaryDiscountValue = amountAfterPrimary * (secondaryDiscountRate / 100);
    const amountAfterDiscounts = amountAfterPrimary - secondaryDiscountValue;
    const taxValue = amountAfterDiscounts * (taxRate / 100);
    const netTotal = amountAfterDiscounts + taxValue;

    const addItem = () => {
        if (!selectedItem) return;
        const qty = parseInt(qtyInput);
        
        if (isNaN(qty) || qty <= 0) return;
        
        if (settings.stock_tracking_enabled && qty > selectedItem.current_stock_qty) {
            showToast(`Insufficient stock. Only ${selectedItem.current_stock_qty} available.`, "error");
            return;
        }

        const existingLineIndex = lines.findIndex(l => l.item_id === selectedItem.item_id);
        if (existingLineIndex >= 0) {
             const newLines = [...lines];
             const newQty = newLines[existingLineIndex].quantity + qty;
             if (settings.stock_tracking_enabled && newQty > selectedItem.current_stock_qty) {
                 showToast("Total quantity exceeds stock.", "error");
                 return;
             }
             newLines[existingLineIndex].quantity = newQty;
             newLines[existingLineIndex].line_total = newQty * selectedItem.unit_value;
             setLines(newLines);
        } else {
             const newLine: OrderLine = {
                line_id: generateUUID(),
                order_id: '',
                item_id: selectedItem.item_id,
                item_name: cleanText(`${selectedItem.item_name} - ${selectedItem.vehicle_model} - ${selectedItem.source_brand}`), // Format for invoice
                quantity: qty,
                unit_value: selectedItem.unit_value,
                line_total: qty * selectedItem.unit_value
            };
            setLines([...lines, newLine]);
        }
        showToast("Added to cart", "success");
        setSelectedItem(null);
        setQtyInput('1');
    };

    // Memoize the items lookup to avoid repeated iterations
    const itemsMap = React.useMemo(() => {
        const map = new Map<string, Item>();
        items.forEach(i => map.set(i.item_id, i));
        return map;
    }, [items]);

    const removeLine = (lineId: string) => {
        setLines(lines.filter(l => l.line_id !== lineId));
    };

    const updateLineQty = (lineId: string, delta: number) => {
        const lineIndex = lines.findIndex(l => l.line_id === lineId);
        if (lineIndex === -1) return;

        const line = lines[lineIndex];
        const newQty = line.quantity + delta;

        if (newQty <= 0) {
            removeLine(lineId);
            return;
        }

        // Stock check
        if (settings.stock_tracking_enabled && delta > 0) {
            const item = itemsMap.get(line.item_id);
            if (item && newQty > item.current_stock_qty) {
                showToast(`Insufficient stock. Only ${item.current_stock_qty} available.`, "error");
                return;
            }
        }

        const newLines = [...lines];
        newLines[lineIndex] = {
            ...line,
            quantity: newQty,
            line_total: newQty * line.unit_value
        };
        setLines(newLines);
    };

    const initiateCheckout = () => {
        if (!customer) return;
        if (lines.length === 0) return;

        // Credit Limit Check
        const currentBalance = customer.outstanding_balance || 0;
        const creditLimit = customer.credit_limit || 0;
        const newTotalBalance = currentBalance + netTotal;

        if (creditLimit > 0 && newTotalBalance > creditLimit && paymentType !== 'cash') {
             // Warn user but allow proceed if they pay cash?
             // Or strict block? Let's use a Toast warning for now, maybe block if unpaid.
             showToast(`Warning: Credit Limit Exceeded (Limit: ${formatCurrency(creditLimit)}, New Balance: ${formatCurrency(newTotalBalance)})`, "warning");
        }

        setPaymentAmount('0'); // Default to 0 as requested
        setShowPaymentModal(true);
    };

    const handleFinalizeOrder = async () => {
        if (!customer) return;

        // Validate invoice number before proceeding
        if (!invoiceNumber) {
            showToast("Please enter an invoice number", "error");
            return;
        }

        if (invoiceNumberError) {
            showToast(invoiceNumberError, "error");
            return;
        }

        // For existing orders, preserve the original order ID
        // For new orders, we can use the invoice number as the order ID
        const orderId = editingOrder ? editingOrder.order_id : invoiceNumber;
        const finalLines = lines.map(l => ({...l, order_id: orderId}));

        // Prepare Payment Data
        const payAmount = parseFloat(paymentAmount) || 0;

        if (payAmount > netTotal) {
             showToast("Payment cannot exceed total amount", "error");
             return;
        }

        const payments: Payment[] = editingOrder ? editingOrder.payments : [];

        if (payAmount > 0) {
            payments.push({
                payment_id: generateUUID(),
                order_id: orderId,
                amount: payAmount,
                payment_date: new Date().toISOString(),
                payment_type: paymentType,
                reference_number: paymentRef,
                notes: editingOrder ? 'Additional payment during edit' : 'Initial payment at checkout'
            });
        }

        const newOrder: Order = {
            ...editingOrder,
            order_id: editingOrder?.order_id || orderId, // Preserve original order ID for existing orders
            customer_id: customer.customer_id,
            rep_id: user?.id.toString(),
            order_date: orderDate,
            discount_rate: discountRate / 100,
            gross_total: grossTotal,
            discount_value: primaryDiscountValue,
            secondary_discount_rate: secondaryDiscountRate / 100,
            secondary_discount_value: secondaryDiscountValue,
            tax_rate: taxRate / 100,
            tax_value: taxValue,
            net_total: netTotal,
            credit_period: customer.credit_period || 90,

            // Payment Fields (Will be recalculated by db.saveOrder but good to pass)
            paid_amount: payments.reduce((sum, p) => sum + p.amount, 0),
            balance_due: netTotal - payments.reduce((sum, p) => sum + p.amount, 0),
            payment_status: 'unpaid', // DB will calculate 'paid' | 'partial' | 'unpaid'
            payments: payments,

            order_status: 'confirmed',
            delivery_status: editingOrder?.delivery_status || 'pending',
            lines: finalLines,
            invoice_number: invoiceNumber, // Use the user-specified invoice number
            approval_status: editingOrder?.approval_status || 'approved', // Default to approved
            // Preserve the original invoice number for sync tracking if this was previously synced
            original_invoice_number: editingOrder?.original_invoice_number || editingOrder?.invoice_number,
            created_at: editingOrder?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_status: 'pending'
        };

        // If editing, restore original stock first
        if (editingOrder && settings.stock_tracking_enabled) {
            for (const line of editingOrder.lines) {
                await db.updateStock(line.item_id, line.quantity);
            }
        }

        // Deduce New Stock
        if (settings.stock_tracking_enabled) {
            for (const line of finalLines) {
                await db.updateStock(line.item_id, -line.quantity);
            }
        }

        // Save Order (DB handles balance updates)
        await db.saveOrder(newOrder);
        showToast(editingOrder ? "Order updated!" : "Sale confirmed!", "success");
        
        setShowPaymentModal(false);
        onOrderCreated(newOrder);
    };

    // Faceted Filter Logic
    const itemsMatchingText = items.filter(i => 
        catalogSearch.trim() === '' || 
        i.item_display_name.toLowerCase().includes(catalogSearch.toLowerCase()) || 
        i.item_number.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        i.vehicle_model.toLowerCase().includes(catalogSearch.toLowerCase())
    );

    const availableModels = ['All', ...Array.from(new Set(
        itemsMatchingText
            .filter(i => countryFilter === 'All' || i.source_brand === countryFilter)
            .map(i => i.vehicle_model)
            .filter(Boolean)
    ))].sort();

    const availableCountries = ['All', ...Array.from(new Set(
        itemsMatchingText
            .filter(i => modelFilter === 'All' || i.vehicle_model === modelFilter)
            .map(i => i.source_brand)
            .filter(Boolean)
    ))].sort();

    const filteredItems = itemsMatchingText.filter(i => {
        const matchesModel = modelFilter === 'All' || i.vehicle_model === modelFilter;
        const matchesCountry = countryFilter === 'All' || i.source_brand === countryFilter;
        
        const isOutOfStock = settings.stock_tracking_enabled 
            ? i.current_stock_qty <= 0 
            : i.is_out_of_stock;

        if (!showOutOfStock && isOutOfStock) return false;

        return matchesModel && matchesCountry && i.status === 'active';
    }).sort((a, b) => {
        if (sortOrder === 'A-Z') return a.item_display_name.localeCompare(b.item_display_name);
        if (sortOrder === 'Price-High') return b.unit_value - a.unit_value;
        if (sortOrder === 'Price-Low') return a.unit_value - b.unit_value;
        return 0;
    });

    // State for header visibility and filter visibility
    const [headerVisible, setHeaderVisible] = useState(true);
    const [filtersVisible, setFiltersVisible] = useState(false);

    // Handle scroll to show/hide header
    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        // Show header when at top or scrolling up, hide when scrolling down
        if (scrollTop > 10) {
            setHeaderVisible(scrollTop < (e.currentTarget.scrollHeight - e.currentTarget.clientHeight - 10));
        } else {
            setHeaderVisible(true);
        }
    };

    const isInCart = (itemId: string) => lines.some(l => l.item_id === itemId);

    if (!customer) return <div className="p-4 text-center">Please select a customer first.</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)]">

            {/* Header */}
            <div className={`bg-white px-4 py-3 border-b border-slate-200 rounded-t-xl shadow-sm shrink-0 transition-all duration-300 ${isSearchFocused ? 'md:block hidden' : 'block'}`}>
                <div className="flex items-center justify-between gap-2">
                    {/* Left: Customer Name - Hidden on mobile (now in header title bar) */}
                    <div className="hidden md:flex items-center gap-2 min-w-0">
                        <button
                            onClick={onCancel}
                            className="text-white bg-rose-500 hover:bg-rose-600 p-1.5 rounded-full shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                        <div className="overflow-hidden w-full md:w-auto min-w-0 flex-1">
                            <div className="max-w-[140px] md:max-w-none overflow-hidden">
                                <h2 className="text-sm md:text-base font-bold text-slate-800 whitespace-nowrap animate-marquee">{cleanText(customer.shop_name)}</h2>
                            </div>
                        </div>
                        {editingOrder && editingOrder.sync_status === 'synced' && (
                            <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">SYNCED</span>
                        )}
                    </div>

                    {/* Right: Invoice Info - All in one row */}
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        {/* Invoice Date */}
                        <div className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <input
                                type="date"
                                value={orderDate}
                                onChange={e => setOrderDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 text-xs rounded px-1.5 py-1 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none w-28 md:w-32"
                            />
                        </div>

                        {/* Invoice Number */}
                        <div className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={e => {
                                    setInvoiceNumber(e.target.value);
                                    setUseSuggestedInvoiceNumber(false);
                                }}
                                className={`bg-slate-50 border text-xs rounded px-1.5 py-1 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none w-20 md:w-24 ${invoiceNumberError ? 'border-rose-500' : 'border-slate-200'}`}
                                placeholder="INV#"
                            />
                            <button
                                onClick={() => setUseSuggestedInvoiceNumber(!useSuggestedInvoiceNumber)}
                                className={`p-1 rounded shrink-0 ${useSuggestedInvoiceNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                title={useSuggestedInvoiceNumber ? "Using suggested" : "Use suggested"}
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error Messages */}
                {invoiceNumberError && (
                    <div className="text-[10px] text-rose-600 font-medium mt-1">{invoiceNumberError}</div>
                )}
                {editingOrder && editingOrder.sync_status === 'synced' && (
                    <div className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Synced to cloud
                    </div>
                )}
            </div>

            {/* Mobile Tabs */}
            <div className={`md:hidden flex border-b border-slate-200 bg-white transition-all ${isSearchFocused ? 'hidden' : 'flex'}`}>
                <button 
                    onClick={() => setMobileTab('catalog')} 
                    className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${mobileTab === 'catalog' ? `border-${themeClasses.text.split('-')[1]}-600 ${themeClasses.text}` : 'border-transparent text-slate-500'}`}
                >
                    Catalog
                </button>
                <button 
                    onClick={() => setMobileTab('cart')} 
                    className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${mobileTab === 'cart' ? `border-${themeClasses.text.split('-')[1]}-600 ${themeClasses.text}` : 'border-transparent text-slate-500'}`}
                >
                    Cart ({lines.length})
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50 relative">
                
                {/* Catalog Pane (Left on Desktop, Tab 1 on Mobile) */}
                <div className={`w-full md:w-3/5 flex flex-col h-full ${mobileTab === 'catalog' ? 'block' : 'hidden md:flex'}`}>
                    {/* Search & Filters */}
                    <div className="p-3 bg-white border-b border-slate-100 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    placeholder="Search parts or SKU..."
                                    className={`block w-full pl-9 pr-10 p-2.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 ${themeClasses.ring}`}
                                    value={catalogSearch}
                                    onChange={e => setCatalogSearch(e.target.value)}
                                />
                                {catalogSearch && (
                                    <button
                                        onClick={() => setCatalogSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}

                                {/* Catalog Search Dropdown */}
                                {isSearchFocused && catalogSearch.trim().length > 0 && (
                                    <div className="hidden md:block absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-[70] max-h-96 overflow-y-auto divide-y divide-slate-50">
                                        {filteredItems.length > 0 ? (
                                            filteredItems.slice(0, 20).map(item => {
                                                const isOutOfStock = settings.stock_tracking_enabled
                                                    ? item.current_stock_qty <= 0
                                                    : item.is_out_of_stock;

                                                if (isOutOfStock) return null;

                                                return (
                                                    <div
                                                        key={item.item_id}
                                                        className={`p-3 flex justify-between items-center transition-colors ${isInCart(item.item_id) ? `${themeClasses.bgSoft}/50` : 'hover:bg-slate-50'}`}
                                                    >
                                                        <div className="min-w-0 flex items-center gap-2">
                                                            {isInCart(item.item_id) && <span className={`w-1.5 h-1.5 ${themeClasses.bg} rounded-full`}></span>}
                                                            <div className="min-w-0">
                                                                <p className={`text-xs font-bold truncate ${isInCart(item.item_id) ? themeClasses.textDark : 'text-slate-800'}`}>{cleanText(item.item_display_name)}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono truncate">
                                                            {settings.show_sku_in_item_cards && (
                                                                <>
                                                                    {cleanText(item.item_number)} •
                                                                </>
                                                            )}
                                                            {cleanText(item.vehicle_model)} • {cleanText(item.source_brand)}
                                                        </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-right">
                                                                <p className={`text-xs font-black ${isInCart(item.item_id) ? themeClasses.text : themeClasses.text}`}>{formatCurrency(item.unit_value)}</p>
                                                                {isInCart(item.item_id) && <span className={`text-[8px] font-black ${themeClasses.text} uppercase tracking-tighter`}>Added</span>}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedItem(item);
                                                                    setCatalogSearch('');
                                                                    setIsSearchFocused(false);
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold min-w-[60px] ${
                                                                    isInCart(item.item_id)
                                                                        ? 'bg-slate-200 text-slate-600'
                                                                        : `${themeClasses.bg} text-white`
                                                                }`}
                                                            >
                                                                {isInCart(item.item_id) ? 'Added' : 'Add'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-4 text-center text-slate-500 text-sm">
                                                No items found for "{catalogSearch}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowOutOfStock(!showOutOfStock)}
                                    className={`p-2.5 rounded-lg transition-colors ${!showOutOfStock ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}
                                    title={showOutOfStock ? "Hide Out of Stock" : "Show Out of Stock"}
                                >
                                    {showOutOfStock ? (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    )}
                                </button>
                                {/* Replaced scanner button with filter toggle button */}
                                <button
                                    onClick={() => setFiltersVisible(!filtersVisible)}
                                    className={`p-2.5 rounded-lg transition-colors ${filtersVisible ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Collapsible filters */}
                        <div className={`flex gap-2 overflow-x-auto no-scrollbar transition-all duration-300 ease-in-out ${
                            filtersVisible ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                        } ${isSearchFocused ? 'hidden md:flex' : 'flex'}`}>
                            <select
                                className="w-32 md:flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none shrink-0"
                                value={modelFilter}
                                onChange={e => setModelFilter(e.target.value)}
                            >
                                <option value="All">All Models</option>
                                {availableModels.filter(m => m !== 'All').map(m => <option key={String(m)} value={String(m)}>{cleanText(String(m))}</option>)}
                            </select>
                            <select
                                className="w-32 md:flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none shrink-0"
                                value={countryFilter}
                                onChange={e => setCountryFilter(e.target.value)}
                            >
                                <option value="All">All Origins</option>
                                {availableCountries.filter(c => c !== 'All').map(c => <option key={String(c)} value={String(c)}>{cleanText(String(c))}</option>)}
                            </select>
                            <select
                                className="w-32 md:flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none shrink-0"
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value as 'A-Z' | 'Price-High' | 'Price-Low')}
                            >
                                <option value="A-Z">Name A-Z</option>
                                <option value="Price-High">Price High</option>
                                <option value="Price-Low">Price Low</option>
                            </select>
                        </div>
                    </div>

                    {showScanner && (
                        <div className="px-3 pb-3 bg-white border-b">
                            <div className={`rounded-xl overflow-hidden border-2 ${themeClasses.border.replace('200', '500')}`}>
                                <div id="reader"></div>
                            </div>
                        </div>
                    )}
                    
                    {/* Item List */}
                    <div 
                        className={`flex-1 overflow-y-auto p-2 md:p-4 space-y-1.5 ${(isSearchFocused && catalogSearch.trim().length > 0) ? 'md:hidden' : ''}`} 
                        onScroll={handleScroll}
                    >
                            {filteredItems.map(item => {
                            const isOutOfStock = settings.stock_tracking_enabled
                                ? item.current_stock_qty <= 0
                                : item.is_out_of_stock;

                            return (
                                <div
                                    key={item.item_id}
                                    className={`bg-white rounded-2xl border shadow-sm transition-all relative overflow-hidden ${
                                        isOutOfStock
                                        ? 'border-rose-200 bg-rose-50/30 cursor-not-allowed opacity-75'
                                        : isInCart(item.item_id)
                                            ? `${themeClasses.border} ${themeClasses.bgSoft}/30`
                                            : `border-slate-200 hover:${themeClasses.border.replace('200', '300')} hover:shadow-md`
                                    } ${selectedItem?.item_id === item.item_id ? `${themeClasses.border.replace('200', '500')} ring-2 ${themeClasses.ring.replace('focus:', '')} ring-offset-2` : ''}`}
                                >
                                    <div className={`p-2 flex justify-between items-center relative z-10`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${isOutOfStock ? 'bg-rose-100 text-rose-600' : isInCart(item.item_id) ? `${themeClasses.bg} text-white` : `${themeClasses.bgSoft} ${themeClasses.text}`}`}>
                                                {isInCart(item.item_id) ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`font-bold text-sm truncate leading-tight ${isOutOfStock ? 'text-rose-700' : isInCart(item.item_id) ? themeClasses.textDark : 'text-slate-800'}`}>
                                                    {cleanText(item.item_display_name)}
                                                    {isOutOfStock && <span className="ml-2 text-[10px] font-black uppercase text-rose-600 underline decoration-double">Out of Stock</span>}
                                                    {isInCart(item.item_id) && !isOutOfStock && <span className={`ml-2 text-[10px] font-black uppercase ${themeClasses.text}`}>In Cart</span>}
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5 text-[10px] leading-none text-slate-500">
                                                    <>
                                                        {settings.show_sku_in_item_cards && (
                                                            <>
                                                                <span className={`font-black ${themeClasses.text} font-mono text-xs`}>{cleanText(item.item_number)}</span>
                                                                <span className="text-slate-300">•</span>
                                                            </>
                                                        )}
                                                        <span className={`uppercase font-bold ${themeClasses.text} text-[11px]`}>{cleanText(item.vehicle_model)}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className={`${themeClasses.text} text-[11px]`}>{cleanText(item.source_brand)}</span>
                                                    </>
                                                </div>

                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <div className="text-right">
                                                <div className={`font-black text-sm ${isOutOfStock ? 'text-rose-400' : 'text-slate-900'}`}>{formatCurrency(item.unit_value)}</div>
                                                {settings.stock_tracking_enabled && (
                                                    <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block ${item.current_stock_qty > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-700'}`}>
                                                        {item.current_stock_qty} in stock
                                                    </div>
                                                )}
                                            </div>
                                            {!isOutOfStock && (
                                                <button
                                                    onClick={() => setSelectedItem(item)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold min-w-[60px] ${
                                                        isInCart(item.item_id)
                                                            ? 'bg-slate-200 text-slate-600'
                                                            : `${themeClasses.bg} text-white`
                                                    }`}
                                                >
                                                    {isInCart(item.item_id) ? 'Added' : 'Add'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {!isOutOfStock && <div className={`absolute inset-0 bg-gradient-to-r ${themeClasses.gradient.split(' ')[0]}/0 to-${themeClasses.gradient.split(' ')[0].replace('from-', '')}/50 opacity-0 transition-opacity pointer-events-none`} />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Cart Pane (Right on Desktop, Tab 2 on Mobile) */}
                <div className={`w-full md:w-2/5 flex flex-col h-full border-l border-slate-200 bg-white ${mobileTab === 'cart' ? 'block' : 'hidden md:flex'}`}>
                     <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 shrink-0">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">Order Summary</h3>
                            <button 
                                onClick={() => setMobileTab('catalog')}
                                className={`md:hidden ${themeClasses.text} text-[10px] font-black uppercase flex items-center gap-1 ${themeClasses.bgSoft} px-2 py-1 rounded-md`}
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add Items
                            </button>
                        </div>
                        
                        {/* Quick Add Search in Cart (Mobile Only) */}
                        <div ref={searchContainerRef} className="relative group md:hidden">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Quick add item..."
                                className={`block w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 ${themeClasses.ring} outline-none`}
                                value={cartSearch}
                                onFocus={() => setCartSearch(' ')}
                                onBlur={() => setTimeout(() => setCartSearch(''), 200)}
                                onChange={(e) => setCartSearch(e.target.value)}
                            />
                            {cartSearch.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-[70] max-h-96 overflow-y-auto divide-y divide-slate-50">
                                    {items
                                        .filter(item => {
                                            const isOutOfStock = settings.stock_tracking_enabled ? item.current_stock_qty <= 0 : item.is_out_of_stock;
                                            if (isOutOfStock) return false;
                                            const search = cartSearch.trim().toLowerCase();
                                            if (search === "") return true;
                                            return item.item_display_name.toLowerCase().includes(search) ||
                                                   item.item_number.toLowerCase().includes(search) ||
                                                   item.vehicle_model.toLowerCase().includes(search);
                                        })
                                        .slice(0, 20)
                                        .map(item => (
                                            <div
                                                key={item.item_id}
                                                className={`p-3 flex justify-between items-center transition-colors ${isInCart(item.item_id) ? `${themeClasses.bgSoft}/50` : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="min-w-0 flex items-center gap-2">
                                                    {isInCart(item.item_id) && <span className={`w-1.5 h-1.5 ${themeClasses.bg} rounded-full`}></span>}
                                                    <div className="min-w-0">
                                                        <p className={`text-xs font-bold truncate ${isInCart(item.item_id) ? themeClasses.textDark : 'text-slate-800'}`}>{cleanText(item.item_display_name)}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono truncate">
                                                            {settings.show_sku_in_item_cards && (
                                                                <>
                                                                    {cleanText(item.item_number)} •
                                                                </>
                                                            )}
                                                            {cleanText(item.vehicle_model)} • {cleanText(item.source_brand)}
                                                        </p>
                                                    </div>

                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-right">
                                                        <p className={`text-xs font-black ${isInCart(item.item_id) ? themeClasses.text : themeClasses.text}`}>{formatCurrency(item.unit_value)}</p>
                                                        {isInCart(item.item_id) && <span className={`text-[8px] font-black ${themeClasses.text} uppercase tracking-tighter`}>Added</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedItem(item);
                                                            setCartSearch('');
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold min-w-[60px] ${
                                                            isInCart(item.item_id) 
                                                                ? 'bg-slate-200 text-slate-600' 
                                                                : `${themeClasses.bg} text-white`
                                                        }`}
                                                    >
                                                        {isInCart(item.item_id) ? 'Added' : 'Add'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto bg-slate-50/50 flex flex-col">
                        {lines.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center min-h-[200px]">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                </div>
                                <h4 className="font-bold text-slate-600">Your cart is empty</h4>
                                <p className="text-xs mt-1 max-w-[150px]">Select items from the catalog to start building an order.</p>
                            </div>
                        ) : (
                            <div className="flex-1">
                                <ul className="divide-y divide-slate-100">
                                    {lines.map(line => (
                                        <li key={line.line_id} className="p-3 flex justify-between items-start hover:bg-white transition-colors group bg-white border-b border-slate-100 last:border-0">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className={`text-xs font-bold ${themeClasses.textDark} break-words leading-snug`}>{cleanText(line.item_name)}</div>
                                                <div className="text-[11px] text-slate-500 font-medium flex gap-1 mt-0.5">
                                                    <span>{itemsMap.get(line.item_id)?.vehicle_model || ''}</span>
                                                    <span>•</span>
                                                    <span>{itemsMap.get(line.item_id)?.source_brand || ''}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <div className="flex items-center bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
                                                        <button
                                                            onClick={() => !isEditingDisabled && updateLineQty(line.line_id, -1)}
                                                            className={`px-2 py-0.5 ${isEditingDisabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200 active:bg-slate-300'} transition-colors`}
                                                            disabled={isEditingDisabled}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
                                                        </button>
                                                        <span className="px-2 py-0.5 bg-white text-[10px] font-black text-slate-800 border-x border-slate-200 min-w-[24px] text-center">
                                                            {line.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => !isEditingDisabled && updateLineQty(line.line_id, 1)}
                                                            className={`px-2 py-0.5 ${isEditingDisabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200 active:bg-slate-300'} transition-colors`}
                                                            disabled={isEditingDisabled}
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                                        </button>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-medium italic">x {formatCurrency(line.unit_value)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="font-bold text-slate-800 text-xs">{formatCurrency(line.line_total)}</span>
                                                <button 
                                                    onClick={() => !isEditingDisabled && removeLine(line.line_id)} 
                                                    className={`w-6 h-6 rounded-full ${isEditingDisabled ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-50 text-slate-300 hover:bg-rose-100 hover:text-rose-500'} flex items-center justify-center transition-colors`}
                                                    disabled={isEditingDisabled}
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="p-4 border-t border-slate-200 bg-slate-50 mt-auto shrink-0">
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(grossTotal)}</span>
                                </div>

                                <div className="flex justify-between items-center text-sm text-slate-600">
                                    <span>Discount 1 (%)</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            max="100"
                                            className={`w-16 p-1 text-right text-xs border rounded focus:ring-2 ${themeClasses.ring} outline-none font-bold ${isEditingDisabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                            value={discountRate}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                let val = parseFloat(e.target.value) || 0;
                                                if (val < 0) val = 0;
                                                if (val > 100) val = 100;
                                                setDiscountRate(val);
                                            }}
                                            disabled={isEditingDisabled}
                                        />
                                        <span className="text-rose-600">-{formatCurrency(primaryDiscountValue)}</span>
                                    </div>
                                </div>

                                {secondaryDiscountRate > 0 && (
                                    <div className="flex justify-between items-center text-sm text-slate-600">
                                        <span>Discount 2 (%)</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100"
                                                className={`w-16 p-1 text-right text-xs border rounded focus:ring-2 ${themeClasses.ring} outline-none font-bold ${isEditingDisabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                                value={secondaryDiscountRate}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                    let val = parseFloat(e.target.value) || 0;
                                                    if (val < 0) val = 0;
                                                    if (val > 100) val = 100;
                                                    setSecondaryDiscountRate(val);
                                                }}
                                                disabled={isEditingDisabled}
                                            />
                                            <span className="text-rose-600">-{formatCurrency(secondaryDiscountValue)}</span>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center text-sm text-slate-600">
                                    <span>Tax (%)</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            className={`w-16 p-1 text-right text-xs border rounded focus:ring-2 ${themeClasses.ring} outline-none font-bold ${isEditingDisabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                            value={taxRate}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                let val = parseFloat(e.target.value) || 0;
                                                if (val < 0) val = 0;
                                                if (val > 100) val = 100;
                                                setTaxRate(val);
                                            }}
                                            disabled={isEditingDisabled}
                                        />
                                        <span className="text-slate-800">+{formatCurrency(taxValue)}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
                                    <span>Total</span>
                                    <span>{formatCurrency(netTotal)}</span>
                                </div>
                            </div>
                            <button
                                disabled={lines.length === 0 || isEditingDisabled}
                                onClick={() => !isEditingDisabled && setShowPaymentModal(true)}
                                className={`w-full ${themeClasses.bg} text-white py-3 rounded-xl font-bold ${themeClasses.bgHover} disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98] transition-all text-sm`}
                            >
                                {isEditingDisabled ? 'Editing Locked (Approved)' : `Checkout (${lines.length} Items)`}
                            </button>
                        </div>
                     </div>
                </div>
            </div>

            {/* Quantity Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-24 md:p-4 pb-safe">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 leading-tight">{cleanText(selectedItem.item_display_name)}</h3>
                            <div className="flex justify-center flex-wrap gap-1.5 text-xs text-slate-500 font-bold uppercase mt-2">
                                <span className={`${themeClasses.bgSoft} ${themeClasses.text} px-1.5 py-0.5 rounded`}>{cleanText(selectedItem.vehicle_model)}</span>
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{cleanText(selectedItem.source_brand)}</span>
                            </div>
                            {settings.stock_tracking_enabled && (
                                <p className="text-xs text-slate-400 mt-2 font-medium">Available: {selectedItem.current_stock_qty}</p>
                            )}
                        </div>
                        
                        <div className="flex items-center justify-center gap-4 mb-8">
                             <button onClick={() => setQtyInput(Math.max(1, parseInt(qtyInput)-1).toString())} className="w-12 h-12 rounded-full bg-slate-100 text-2xl font-bold text-slate-600 hover:bg-slate-200">-</button>
                            <input 
                                type="number" 
                                className={`w-24 text-center text-3xl font-bold border-b-2 ${themeClasses.border.replace('200', '500')} focus:outline-none`} 
                                value={qtyInput}
                                onChange={e => setQtyInput(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                autoFocus
                            />
                             <button onClick={() => setQtyInput((parseInt(qtyInput)+1).toString())} className="w-12 h-12 rounded-full bg-slate-100 text-2xl font-bold text-slate-600 hover:bg-slate-200">+</button>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSelectedItem(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl">Cancel</button>
                            <button onClick={addItem} className={`flex-1 py-3 ${themeClasses.bg} text-white font-bold rounded-xl shadow-lg`}>Add Item</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
                    <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 pb-24 md:pb-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-300 relative">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800">Checkout & Payment</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 mb-6 flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Net Payable</span>
                            <span className="text-2xl font-black text-slate-900">{formatCurrency(netTotal)}</span>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Payment Amount</label>
                                <input
                                    type="number"
                                    className={`w-full p-3 ${isEditingDisabled ? 'bg-slate-100' : 'bg-white'} border-2 border-slate-200 rounded-xl text-lg font-bold focus:${themeClasses.border.replace('200', '500')} focus:outline-none`}
                                    value={paymentAmount}
                                    onFocus={(e) => e.target.select()}
                                    onChange={e => !isEditingDisabled && setPaymentAmount(e.target.value)}
                                    placeholder={isEditingDisabled ? "Editing locked" : "Enter amount"}
                                    disabled={isEditingDisabled}
                                />
                                <div className="flex justify-between mt-1 px-1">
                                    <button 
                                        onClick={() => !isEditingDisabled && setPaymentAmount(netTotal.toFixed(2))} 
                                        className={`text-xs font-bold ${themeClasses.text} ${isEditingDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={isEditingDisabled}
                                    >
                                        Full Payment
                                    </button>
                                    <span className={`text-xs font-bold ${netTotal - (parseFloat(paymentAmount) || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        Balance Due: {formatCurrency(Math.max(0, netTotal - (parseFloat(paymentAmount) || 0)))}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Method</label>
                                    <select
                                        className={`w-full p-3 ${isEditingDisabled ? 'bg-slate-100' : 'bg-white'} border-2 border-slate-200 rounded-xl font-medium focus:${themeClasses.border.replace('200', '500')} focus:outline-none`}
                                        value={paymentType}
                                        onChange={e => !isEditingDisabled && setPaymentType(e.target.value as PaymentType)}
                                        disabled={isEditingDisabled}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="cheque">Cheque</option>
                                        <option value="bank_transfer">Transfer</option>
                                        <option value="credit">Credit (Unpaid)</option>
                                    </select>
                                </div>
                                {paymentType !== 'cash' && paymentType !== 'credit' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Reference No.</label>
                                        <input
                                            type="text"
                                            className={`w-full p-3 ${isEditingDisabled ? 'bg-slate-100' : 'bg-white'} border-2 border-slate-200 rounded-xl font-medium focus:${themeClasses.border.replace('200', '500')} focus:outline-none`}
                                            value={paymentRef}
                                            onChange={e => !isEditingDisabled && setPaymentRef(e.target.value)}
                                            placeholder={isEditingDisabled ? "Editing locked" : "Last 4 digits"}
                                            disabled={isEditingDisabled}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={isEditingDisabled ? undefined : handleFinalizeOrder}
                            disabled={isEditingDisabled}
                            className={`w-full ${themeClasses.bg} text-white py-4 rounded-xl font-black text-lg shadow-lg ${themeClasses.shadow} active:scale-95 transition-transform ${isEditingDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isEditingDisabled ? 'Editing Locked' : 'Confirm Sale'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
