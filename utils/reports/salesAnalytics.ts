import { Order, Item } from '../../types';

export interface SalesTrendDataPoint {
  date: string;
  sales: number;
  transactions: number;
  grossSales: number;
  netSales: number;
}

export interface TopSellingItem {
  name: string;
  quantity: number;
  percentage: number;
}

/**
 * Aggregates sales data by date range
 * @param orders List of orders to analyze
 * @param startDate Start date for the analysis period
 * @param endDate End date for the analysis period
 * @returns Aggregated sales data points
 */
export function aggregateSalesByDate(
  orders: Order[],
  startDate: Date,
  endDate: Date
): SalesTrendDataPoint[] {
  // Filter orders by date range and delivery status
  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.order_date);
    return orderDate >= startDate && orderDate <= endDate && 
           order.delivery_status !== 'failed' && 
           order.delivery_status !== 'cancelled';
  });

  // Group orders by date
  const groupedByDate: Record<string, Order[]> = {};
  filteredOrders.forEach(order => {
    const dateStr = new Date(order.order_date).toISOString().split('T')[0];
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = [];
    }
    groupedByDate[dateStr].push(order);
  });

  // Calculate sales metrics for each date
  const result: SalesTrendDataPoint[] = Object.keys(groupedByDate).map(date => {
    const ordersForDate = groupedByDate[date];
    const totalSales = ordersForDate.reduce((sum, order) => sum + order.net_total, 0);
    const totalTransactions = ordersForDate.length;
    const totalGrossSales = ordersForDate.reduce((sum, order) => sum + order.gross_total, 0);
    
    return {
      date,
      sales: parseFloat(totalSales.toFixed(2)),
      transactions: totalTransactions,
      grossSales: parseFloat(totalGrossSales.toFixed(2)),
      netSales: parseFloat(totalSales.toFixed(2))
    };
  });

  // Sort by date
  result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return result;
}

/**
 * Calculates top selling items by quantity
 * @param orders List of orders to analyze
 * @param limit Number of top items to return (default: 10)
 * @returns Top selling items with quantity and percentage
 */
export function calculateTopSellingItems(
  orders: Order[],
  items: Item[],
  limit: number = 10
): TopSellingItem[] {
  // Create a map of item_id to item details
  const itemMap = new Map(items.map(item => [item.item_id, item]));
  
  // Aggregate quantities by item
  const itemQuantities: Record<string, number> = {};
  
  orders.forEach(order => {
    // Only count delivered orders
    if (order.delivery_status !== 'failed' && order.delivery_status !== 'cancelled') {
      order.lines.forEach(line => {
        if (!itemQuantities[line.item_id]) {
          itemQuantities[line.item_id] = 0;
        }
        itemQuantities[line.item_id] += line.quantity;
      });
    }
  });
  
  // Convert to array and sort by quantity
  const sortedItems = Object.entries(itemQuantities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
  
  // Calculate total quantity for percentage calculation
  const totalQuantity = sortedItems.reduce((sum, [, qty]) => sum + qty, 0);
  
  // Create result with item names and percentages
  const result: TopSellingItem[] = sortedItems.map(([itemId, quantity]) => {
    const item = itemMap.get(itemId);
    const name = item ? item.item_display_name || item.item_name : `Item ${itemId}`;
    const percentage = totalQuantity > 0 ? parseFloat(((quantity / totalQuantity) * 100).toFixed(2)) : 0;
    
    return {
      name,
      quantity,
      percentage
    };
  });
  
  return result;
}

/**
 * Filters sales data by custom date range
 * @param orders List of orders to filter
 * @param startDate Start date for the filter
 * @param endDate End date for the filter
 * @returns Filtered orders
 */
export function filterOrdersByDateRange(
  orders: Order[],
  startDate: Date,
  endDate: Date
): Order[] {
  return orders.filter(order => {
    const orderDate = new Date(order.order_date);
    return orderDate >= startDate && orderDate <= endDate;
  });
}