import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatCurrency } from '../../utils/currency';
import { db } from '../../services/db';

vi.mock('../../services/db', () => ({
  db: {
    getSettings: vi.fn()
  }
}));

describe('formatCurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    (db.getSettings as any).mockReturnValue({ currency_symbol: 'Rs.' });
  });

  describe('Edge cases (undefined, null, NaN)', () => {
    it('returns "0.00" when amount is undefined', () => {
      expect(formatCurrency(undefined)).toBe('0.00');
    });

    it('returns "0.00" when amount is null', () => {
      expect(formatCurrency(null as any)).toBe('0.00');
    });

    it('returns "0.00" when amount is NaN', () => {
      expect(formatCurrency(NaN)).toBe('0.00');
    });
  });

  describe('Formatting with default/DB symbol', () => {
    it('formats a normal number with default symbol from DB', () => {
      expect(formatCurrency(100)).toBe('Rs.100.00');
    });

    it('formats zero with default symbol from DB', () => {
      expect(formatCurrency(0)).toBe('Rs.0.00');
    });

    it('formats a large number with thousands separators', () => {
      expect(formatCurrency(1000000)).toBe('Rs.1,000,000.00');
    });

    it('formats a number with decimals correctly', () => {
      expect(formatCurrency(100.5)).toBe('Rs.100.50');
      expect(formatCurrency(100.55)).toBe('Rs.100.55');
      // Should round correctly
      expect(formatCurrency(100.555)).toBe('Rs.100.56');
    });

    it('formats negative numbers correctly', () => {
      expect(formatCurrency(-100.5)).toBe('Rs.-100.50');
    });

    it('uses different symbol if DB settings change', () => {
      (db.getSettings as any).mockReturnValue({ currency_symbol: '$' });
      expect(formatCurrency(100)).toBe('$100.00');
    });

    it('uses "Rs." as fallback if DB returns empty symbol', () => {
      (db.getSettings as any).mockReturnValue({ currency_symbol: '' });
      expect(formatCurrency(100)).toBe('Rs.100.00');
    });

    it('uses "Rs." as fallback if DB returns undefined symbol', () => {
      (db.getSettings as any).mockReturnValue({});
      expect(formatCurrency(100)).toBe('Rs.100.00');
    });
  });

  describe('Formatting without symbol (includeSymbol = false)', () => {
    it('formats a normal number without symbol', () => {
      expect(formatCurrency(100, false)).toBe('100.00');
    });

    it('formats zero without symbol', () => {
      expect(formatCurrency(0, false)).toBe('0.00');
    });

    it('formats a large number without symbol', () => {
      expect(formatCurrency(1000000, false)).toBe('1,000,000.00');
    });
  });
});
