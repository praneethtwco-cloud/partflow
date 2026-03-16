import { describe, expect, test } from 'vitest';
import { aggregateSalesByDate, calculateTopSellingItems } from '../../../utils/reports/salesAnalytics';
import { Order, Item, OrderLine } from '../../../types';

describe('calculateTopSellingItems', () => {
  const mockItems: Item[] = [
    {
      item_id: 'item-1',
      item_display_name: 'Brake Pad (Toyota)',
      item_name: 'Brake Pad',
      item_number: 'BP-001',
      vehicle_model: 'Toyota',
      source_brand: 'Toyota',
      category: 'Brakes',
      unit_value: 50,
      current_stock_qty: 100,
      low_stock_threshold: 10,
      is_out_of_stock: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    },
    {
      item_id: 'item-2',
      item_display_name: 'Oil Filter',
      item_name: 'Oil Filter',
      item_number: 'OF-001',
      vehicle_model: 'Universal',
      source_brand: 'Generic',
      category: 'Filters',
      unit_value: 15,
      current_stock_qty: 200,
      low_stock_threshold: 20,
      is_out_of_stock: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    },
    {
      item_id: 'item-3',
      item_display_name: 'Air Filter',
      item_name: 'Air Filter',
      item_number: 'AF-001',
      vehicle_model: 'Universal',
      source_brand: 'Generic',
      category: 'Filters',
      unit_value: 20,
      current_stock_qty: 150,
      low_stock_threshold: 15,
      is_out_of_stock: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    },
  ];

  const createMockOrder = (
    order_id: string,
    lines: { item_id: string; quantity: number }[],
    delivery_status: 'delivered' | 'failed' | 'cancelled' | 'pending' | 'shipped' = 'delivered'
  ): Order => {
    return {
      order_id,
      customer_id: 'cust-1',
      order_date: new Date().toISOString(),
      discount_rate: 0,
      gross_total: 100,
      discount_value: 0,
      net_total: 100,
      paid_amount: 100,
      balance_due: 0,
      payment_status: 'paid',
      delivery_status,
      order_status: 'confirmed',
      approval_status: 'approved',
      lines: lines.map((line, index) => ({
        line_id: `line-${index}`,
        order_id,
        item_id: line.item_id,
        item_name: `Item ${line.item_id}`,
        quantity: line.quantity,
        unit_value: 10,
        line_total: line.quantity * 10,
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
      payments: [],
    };
  };

  test('should aggregate item quantities correctly', () => {
    const orders: Order[] = [
      createMockOrder('order-1', [
        { item_id: 'item-1', quantity: 2 },
        { item_id: 'item-2', quantity: 5 },
      ]),
      createMockOrder('order-2', [
        { item_id: 'item-1', quantity: 3 },
        { item_id: 'item-3', quantity: 1 },
      ]),
    ];

    const result = calculateTopSellingItems(orders, mockItems);

    expect(result.length).toBe(3);
    // order-1 (item-1: 2) + order-2 (item-1: 3) = 5
    // order-1 (item-2: 5) = 5
    // order-2 (item-3: 1) = 1
    // Total quantity = 11

    // Sorting is stable, so item-1 and item-2 might be in any order for the first 2 slots
    const item1 = result.find(r => r.name === 'Brake Pad (Toyota)');
    const item2 = result.find(r => r.name === 'Oil Filter');
    const item3 = result.find(r => r.name === 'Air Filter');

    expect(item1?.quantity).toBe(5);
    expect(item1?.percentage).toBe(45.45); // (5 / 11) * 100

    expect(item2?.quantity).toBe(5);
    expect(item2?.percentage).toBe(45.45);

    expect(item3?.quantity).toBe(1);
    expect(item3?.percentage).toBe(9.09); // (1 / 11) * 100
  });

  test('should ignore failed and cancelled orders', () => {
    const orders: Order[] = [
      createMockOrder('order-1', [{ item_id: 'item-1', quantity: 5 }], 'delivered'),
      createMockOrder('order-2', [{ item_id: 'item-1', quantity: 10 }], 'failed'),
      createMockOrder('order-3', [{ item_id: 'item-1', quantity: 15 }], 'cancelled'),
      createMockOrder('order-4', [{ item_id: 'item-2', quantity: 3 }], 'shipped'),
    ];

    const result = calculateTopSellingItems(orders, mockItems);

    expect(result.length).toBe(2);
    const item1 = result.find(r => r.name === 'Brake Pad (Toyota)');
    const item2 = result.find(r => r.name === 'Oil Filter');

    expect(item1?.quantity).toBe(5); // Only from order-1
    expect(item2?.quantity).toBe(3); // From order-4 (shipped is not failed/cancelled)
  });

  test('should limit results correctly', () => {
    const orders: Order[] = [
      createMockOrder('order-1', [
        { item_id: 'item-1', quantity: 10 },
        { item_id: 'item-2', quantity: 5 },
        { item_id: 'item-3', quantity: 2 },
      ]),
    ];

    const resultLimit1 = calculateTopSellingItems(orders, mockItems, 1);
    expect(resultLimit1.length).toBe(1);
    expect(resultLimit1[0].name).toBe('Brake Pad (Toyota)'); // item-1 has highest quantity

    const resultLimit2 = calculateTopSellingItems(orders, mockItems, 2);
    expect(resultLimit2.length).toBe(2);
    expect(resultLimit2[0].name).toBe('Brake Pad (Toyota)');
    expect(resultLimit2[1].name).toBe('Oil Filter');
  });

  test('should handle items not found in items list', () => {
    const orders: Order[] = [
      createMockOrder('order-1', [
        { item_id: 'item-unknown', quantity: 5 },
      ]),
    ];

    const result = calculateTopSellingItems(orders, mockItems);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Item item-unknown');
    expect(result[0].quantity).toBe(5);
    expect(result[0].percentage).toBe(100);
  });

  test('should handle empty orders array', () => {
    const result = calculateTopSellingItems([], mockItems);
    expect(result.length).toBe(0);
  });

  test('should fallback to item_name if item_display_name is missing', () => {
     const mockItemsWithMissingDisplayName: Item[] = [
      {
        item_id: 'item-1',
        item_display_name: '',
        item_name: 'Fallback Name',
        item_number: 'BP-001',
        vehicle_model: 'Toyota',
        source_brand: 'Toyota',
        category: 'Brakes',
        unit_value: 50,
        current_stock_qty: 100,
        low_stock_threshold: 10,
        is_out_of_stock: false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'synced',
      }
     ];

    const orders: Order[] = [
      createMockOrder('order-1', [
        { item_id: 'item-1', quantity: 5 },
      ]),
    ];

    const result = calculateTopSellingItems(orders, mockItemsWithMissingDisplayName);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Fallback Name');
  });
});

describe('aggregateSalesByDate', () => {
  const createMockOrder = (overrides: Partial<Order> = {}): Order => {
    return {
      order_id: '1',
      customer_id: 'CUST-001',
      order_date: new Date().toISOString(),
      discount_rate: 0,
      gross_total: 100,
      discount_value: 0,
      net_total: 100,
      paid_amount: 0,
      balance_due: 100,
      payment_status: 'unpaid',
      payments: [],
      delivery_status: 'delivered',
      order_status: 'confirmed',
      lines: [],
      approval_status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
      ...overrides
    };
  };

  test('should handle an empty order list', () => {
    const orders: Order[] = [];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toEqual([]);
  });

  test('should aggregate valid orders within the date range', () => {
    const orders: Order[] = [
      createMockOrder({ order_id: '1', order_date: '2023-01-15T10:00:00.000Z', net_total: 150, gross_total: 150 }),
      createMockOrder({ order_id: '2', order_date: '2023-01-15T14:00:00.000Z', net_total: 250, gross_total: 250 }),
      createMockOrder({ order_id: '3', order_date: '2023-01-16T10:00:00.000Z', net_total: 100, gross_total: 100 }),
    ];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toHaveLength(2);

    const day1 = result.find(r => r.date === '2023-01-15');
    expect(day1).toBeDefined();
    expect(day1?.sales).toBe(400);
    expect(day1?.transactions).toBe(2);
    expect(day1?.netSales).toBe(400);
    expect(day1?.grossSales).toBe(400);

    const day2 = result.find(r => r.date === '2023-01-16');
    expect(day2).toBeDefined();
    expect(day2?.sales).toBe(100);
    expect(day2?.transactions).toBe(1);
    expect(day2?.netSales).toBe(100);
    expect(day2?.grossSales).toBe(100);
  });

  test('should exclude orders entirely outside the date range', () => {
    const orders: Order[] = [
      createMockOrder({ order_date: '2022-12-31T23:59:59.999Z' }),
      createMockOrder({ order_date: '2023-02-01T00:00:00.000Z' }),
    ];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toEqual([]);
  });

  test('should include orders exactly on the boundary dates', () => {
    const orders: Order[] = [
      createMockOrder({ order_id: '1', order_date: '2023-01-01T00:00:00.000Z', net_total: 100, gross_total: 100 }),
      createMockOrder({ order_id: '2', order_date: '2023-01-31T23:59:59.999Z', net_total: 200, gross_total: 200 }),
    ];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toHaveLength(2);
    expect(result.find(r => r.date === '2023-01-01')).toBeDefined();
    expect(result.find(r => r.date === '2023-01-31')).toBeDefined();
  });

  test('should exclude orders with delivery_status === "failed"', () => {
    const orders: Order[] = [
      createMockOrder({ order_id: '1', order_date: '2023-01-15T10:00:00.000Z', delivery_status: 'failed', net_total: 100 }),
      createMockOrder({ order_id: '2', order_date: '2023-01-15T12:00:00.000Z', delivery_status: 'delivered', net_total: 200 }),
    ];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2023-01-15');
    expect(result[0].sales).toBe(200);
    expect(result[0].transactions).toBe(1);
  });

  test('should exclude orders with delivery_status === "cancelled"', () => {
    const orders: Order[] = [
      createMockOrder({ order_id: '1', order_date: '2023-01-15T10:00:00.000Z', delivery_status: 'cancelled', net_total: 100 }),
      createMockOrder({ order_id: '2', order_date: '2023-01-15T12:00:00.000Z', delivery_status: 'delivered', net_total: 200 }),
    ];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2023-01-15');
    expect(result[0].sales).toBe(200);
    expect(result[0].transactions).toBe(1);
  });

  test('should aggregate multiple orders correctly including $0 totals', () => {
    const orders: Order[] = [
      createMockOrder({ order_id: '1', order_date: '2023-01-15T10:00:00.000Z', net_total: 0, gross_total: 0 }),
      createMockOrder({ order_id: '2', order_date: '2023-01-15T12:00:00.000Z', net_total: 150, gross_total: 200 }),
      createMockOrder({ order_id: '3', order_date: '2023-01-15T14:00:00.000Z', net_total: 50, gross_total: 50 }),
    ];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2023-01-15');
    expect(result[0].sales).toBe(200);
    expect(result[0].transactions).toBe(3);
    expect(result[0].netSales).toBe(200);
    expect(result[0].grossSales).toBe(250);
  });

  test('should sort results by date in ascending order', () => {
    const orders: Order[] = [
      createMockOrder({ order_date: '2023-01-17T10:00:00.000Z' }),
      createMockOrder({ order_date: '2023-01-15T10:00:00.000Z' }),
      createMockOrder({ order_date: '2023-01-16T10:00:00.000Z' }),
    ];
    const startDate = new Date('2023-01-01T00:00:00.000Z');
    const endDate = new Date('2023-01-31T23:59:59.999Z');

    const result = aggregateSalesByDate(orders, startDate, endDate);

    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2023-01-15');
    expect(result[1].date).toBe('2023-01-16');
    expect(result[2].date).toBe('2023-01-17');
  });
});
