import { describe, it, expect } from 'vitest';
import { isValidDateRange } from '../../../utils/reports/dateUtils';

describe('isValidDateRange', () => {
  it('should return true for valid date range (start before end)', () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-12-31');
    expect(isValidDateRange(startDate, endDate)).toBe(true);
  });

  it('should return true when start date equals end date', () => {
    const date = new Date('2023-06-15');
    expect(isValidDateRange(date, date)).toBe(true);
  });

  it('should return false for invalid date range (start after end)', () => {
    const startDate = new Date('2023-12-31');
    const endDate = new Date('2023-01-01');
    expect(isValidDateRange(startDate, endDate)).toBe(false);
  });

  it('should return false if startDate is missing or null', () => {
    const endDate = new Date('2023-12-31');
    expect(isValidDateRange(null as any, endDate)).toBe(false);
    expect(isValidDateRange(undefined as any, endDate)).toBe(false);
  });

  it('should return false if endDate is missing or null', () => {
    const startDate = new Date('2023-01-01');
    expect(isValidDateRange(startDate, null as any)).toBe(false);
    expect(isValidDateRange(startDate, undefined as any)).toBe(false);
  });

  it('should return false if startDate is not a Date object', () => {
    const endDate = new Date('2023-12-31');
    expect(isValidDateRange('2023-01-01' as any, endDate)).toBe(false);
    expect(isValidDateRange(1672531200000 as any, endDate)).toBe(false);
    expect(isValidDateRange({} as any, endDate)).toBe(false);
  });

  it('should return false if endDate is not a Date object', () => {
    const startDate = new Date('2023-01-01');
    expect(isValidDateRange(startDate, '2023-12-31' as any)).toBe(false);
    expect(isValidDateRange(startDate, 1703980800000 as any)).toBe(false);
    expect(isValidDateRange(startDate, {} as any)).toBe(false);
  });
});
