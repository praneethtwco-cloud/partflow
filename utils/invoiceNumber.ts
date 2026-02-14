/**
 * Utility functions for invoice number generation and validation
 */

import { db } from '../services/db';
import { Order } from '../types';

/**
 * Extracts the numeric part from an invoice number
 * @param invoiceNumber The invoice number string (e.g., "VM0001")
 * @returns The numeric part as a number (e.g., 1)
 */
export function extractInvoiceNumber(invoiceNumber: string): number {
  const match = invoiceNumber.match(/\d+$/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return 0;
}

/**
 * Finds the highest invoice number in the database
 * @returns The highest invoice number used, or 0 if none exist
 */
export function findHighestInvoiceNumber(): number {
  const orders = db.getOrders();
  const invoiceNumbers = orders
    .filter(order => order.invoice_number) // Only consider orders with invoice numbers
    .map(order => extractInvoiceNumber(order.invoice_number!));

  if (invoiceNumbers.length === 0) {
    return 0;
  }

  return Math.max(...invoiceNumbers);
}

/**
 * Generates the next sequential invoice number based on settings
 * @returns The next invoice number string (e.g., "VM0001")
 */
export function generateNextInvoiceNumber(): string {
  const settings = db.getSettings();
  const prefix = settings.invoice_prefix || 'INV';
  const startingNumber = settings.starting_invoice_number || 1;

  // Find the highest invoice number currently in the system
  const highestNumber = findHighestInvoiceNumber();

  // Determine the next number to use
  const nextNumber = highestNumber > 0 ? highestNumber + 1 : startingNumber;

  // Format the number with zero padding (minimum 4 digits)
  const paddedNumber = nextNumber.toString().padStart(4, '0');

  // Combine prefix and padded number
  return `${prefix}${paddedNumber}`;
}

/**
 * Formats an invoice number with the given prefix and number
 * @param prefix The invoice prefix (e.g., "VM")
 * @param number The invoice number (e.g., 1)
 * @returns The formatted invoice number string (e.g., "VM0001")
 */
export function formatInvoiceNumber(prefix: string, number: number): string {
  const paddedNumber = number.toString().padStart(4, '0');
  return `${prefix}${paddedNumber}`;
}

/**
 * Validates if an invoice number is unique in the system
 * @param invoiceNumber The invoice number to validate
 * @param excludeOrderId Optional order ID to exclude from validation (for updating existing orders)
 * @returns True if the invoice number is unique, false otherwise
 */
export function validateInvoiceNumberUniqueness(invoiceNumber: string, excludeOrderId?: string): boolean {
  const orders = db.getOrders();
  const existingOrder = orders.find(
    order => order.invoice_number === invoiceNumber && order.order_id !== excludeOrderId
  );
  return !existingOrder;
}

/**
 * Validates the format of an invoice number
 * @param invoiceNumber The invoice number to validate
 * @param prefix The expected prefix
 * @returns True if the format is valid, false otherwise
 */
export function validateInvoiceNumberFormat(invoiceNumber: string, prefix: string): boolean {
  const regex = new RegExp(`^${prefix}\\d+$`);
  return regex.test(invoiceNumber);
}