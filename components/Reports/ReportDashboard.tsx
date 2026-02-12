import React, { useState, useEffect } from 'react';
import { SalesTrendsChart, SalesTrendDataPoint } from './SalesTrendsChart';
import { TopSellingItemsChart, TopSellingItem } from './TopSellingItemsChart';
import { DateRangeSelector } from './DateRangeSelector';
import { PresetDateRange, getPresetDateRange } from '../../utils/reports/dateUtils';
import { aggregateSalesByDate, calculateTopSellingItems } from '../../utils/reports/salesAnalytics';
import { Order, Item, Customer } from '../../types';
import { db } from '../../services/db';
import { exportSalesReportToPDF } from '../../utils/reports/exportUtils';

interface FilterOptions {
  category: string;
  customer: string;
  salesRep: string;
}

interface ReportDashboardProps {
  initialPreset?: PresetDateRange;
}

export const ReportDashboard: React.FC<ReportDashboardProps> = ({ 
  initialPreset = PresetDateRange.THIS_MONTH 
}) => {
  const [salesData, setSalesData] = useState<SalesTrendDataPoint[]>([]);
  const [topSellingItems, setTopSellingItems] = useState<TopSellingItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ 
    category: 'all', 
    customer: 'all', 
    salesRep: 'all' 
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Check network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load orders, items, and customers from the database
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allOrders = db.getOrders();
        const allItems = db.getItems();
        const allCustomers = db.getCustomers();
        
        setOrders(allOrders);
        setItems(allItems);
        setCustomers(allCustomers);
        
        // Set initial date range based on preset
        const presetRange = getPresetDateRange(initialPreset);
        setDateRange({ start: presetRange.startDate, end: presetRange.endDate });
      } catch (error) {
        console.error('Error loading data for reports:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Update reports when date range or filters change
  useEffect(() => {
    if (dateRange && orders.length > 0 && items.length > 0) {
      try {
        // Apply filters to orders
        let filteredOrders = [...orders];
        
        // Filter by date range
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.order_date);
          return orderDate >= dateRange.start && orderDate <= dateRange.end;
        });
        
        // Filter by category if not 'all'
        if (filters.category !== 'all') {
          filteredOrders = filteredOrders.filter(order => {
            return order.lines.some(line => {
              const item = items.find(i => i.item_id === line.item_id);
              return item && item.category === filters.category;
            });
          });
        }
        
        // Filter by customer if not 'all'
        if (filters.customer !== 'all') {
          filteredOrders = filteredOrders.filter(order => order.customer_id === filters.customer);
        }
        
        // Filter by sales rep if not 'all'
        if (filters.salesRep !== 'all') {
          filteredOrders = filteredOrders.filter(order => order.rep_id === filters.salesRep);
        }

        // Generate sales trend data
        const trendData = aggregateSalesByDate(filteredOrders, dateRange.start, dateRange.end);
        setSalesData(trendData);

        // Generate top selling items
        const topItems = calculateTopSellingItems(filteredOrders, items, 10);
        setTopSellingItems(topItems);
      } catch (error) {
        console.error('Error generating reports:', error);
      }
    }
  }, [dateRange, orders, items, filters]);

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ start: startDate, end: endDate });
  };

  const handleFilterChange = (filterType: keyof FilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleExportPDF = () => {
    exportSalesReportToPDF(salesData, topSellingItems, dateRange, filters);
  };

  // Get unique categories for filter dropdown
  const categories = Array.from(new Set(items.map(item => item.category))).filter(cat => cat);

  // Get unique customers for filter dropdown
  const uniqueCustomers = customers.map(customer => ({
    id: customer.customer_id,
    name: customer.shop_name
  }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isOnline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-yellow-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-yellow-700">
              You are currently offline. Reports are generated using cached data.
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Sales Reports</h2>
        
        {/* Export button and filters */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleExportPDF}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export PDF
          </button>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
            <select
              value={filters.customer}
              onChange={(e) => handleFilterChange('customer', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Customers</option>
              {uniqueCustomers.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <DateRangeSelector 
        onDateRangeChange={handleDateRangeChange} 
        initialPreset={initialPreset}
        initialStartDate={dateRange?.start}
        initialEndDate={dateRange?.end}
      />
      
      <div id="sales-trends-chart">
        {salesData.length > 0 ? (
          <SalesTrendsChart data={salesData} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No sales data available for the selected date range.</p>
          </div>
        )}
      </div>
      
      <div id="top-selling-items-chart">
        {topSellingItems.length > 0 ? (
          <TopSellingItemsChart data={topSellingItems} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No top selling items data available for the selected date range.</p>
          </div>
        )}
      </div>
    </div>
  );
};