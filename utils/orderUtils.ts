import { Order } from '../types';

/**
 * Checks if an order has a valid delivery status.
 * An order is considered valid if it hasn't failed and hasn't been cancelled.
 * @param order The order to check
 * @returns true if the order is valid, false otherwise
 */
export function isValidOrder(order: Order): boolean {
    return order.delivery_status !== 'failed' && order.delivery_status !== 'cancelled';
}
