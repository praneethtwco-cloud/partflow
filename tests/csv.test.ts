import { describe, it, expect } from 'vitest';
import { jsonToCsv } from '../utils/csv';

describe('jsonToCsv', () => {
  it('converts a simple array of objects to CSV format', () => {
    const data = [
      { name: 'John Doe', age: 30, city: 'New York' },
      { name: 'Jane Smith', age: 25, city: 'Los Angeles' }
    ];

    const result = jsonToCsv(data);
    const expected = `name,age,city\r\nJohn Doe,30,New York\r\nJane Smith,25,Los Angeles`;

    expect(result).toBe(expected);
  });

  it('handles an empty array', () => {
    const result = jsonToCsv([]);
    expect(result).toBe('');
  });

  it('handles missing fields and nulls', () => {
    const data = [
      { id: 1, name: 'Item 1', description: null },
      { id: 2, name: 'Item 2' } // missing description
    ];

    const result = jsonToCsv(data);
    const expected = `id,name,description\r\n1,Item 1,\r\n2,Item 2,`;

    expect(result).toBe(expected);
  });

  it('handles special characters correctly', () => {
    const data = [
      {
        id: 1,
        text: 'This has a comma, and a "quote"',
        multiline: 'Line 1\nLine 2'
      }
    ];

    const result = jsonToCsv(data);
    // PapaParse typically quotes fields with commas, quotes, or newlines
    // Quotes inside quotes are escaped by doubling them
    const expected = `id,text,multiline\r\n1,"This has a comma, and a ""quote""","Line 1\nLine 2"`;

    expect(result).toBe(expected);
  });
});
