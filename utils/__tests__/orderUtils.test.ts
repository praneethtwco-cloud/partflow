import { describe, test, expect } from 'vitest';
import { isValidOrder } from '../orderUtils';
import { Order } from '../../types';

describe('isValidOrder', () => {
    const createOrderWithStatus = (status: string): Order => ({
        delivery_status: status as any,
    } as Order);

    test('returns false for failed orders', () => {
        expect(isValidOrder(createOrderWithStatus('failed'))).toBe(false);
    });

    test('returns false for cancelled orders', () => {
        expect(isValidOrder(createOrderWithStatus('cancelled'))).toBe(false);
    });

    test('returns true for pending orders', () => {
        expect(isValidOrder(createOrderWithStatus('pending'))).toBe(true);
    });

    test('returns true for delivered orders', () => {
        expect(isValidOrder(createOrderWithStatus('delivered'))).toBe(true);
    });
});
