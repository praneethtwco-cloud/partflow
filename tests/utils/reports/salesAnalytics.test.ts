import { describe, expect, test } from 'vitest';
import { calculateTopSellingItems } from '../../../utils/reports/salesAnalytics';
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
