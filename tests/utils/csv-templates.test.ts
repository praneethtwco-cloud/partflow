import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCsvTemplate, CSV_TEMPLATES } from '../../utils/csv-templates';
import Papa from 'papaparse';

describe('csv-templates', () => {
  describe('generateCsvTemplate', () => {
    it('should generate a valid CSV string for a known template', () => {
      const templateName = 'customers';
      const template = CSV_TEMPLATES[templateName];
      const expectedHeader = template.headers.join(',');
      const expectedRow = template.exampleRow.map(cell => `"${cell}"`).join(',');
      const expectedCsv = `${expectedHeader}\n${expectedRow}`;

      const result = generateCsvTemplate(templateName);

      assert.strictEqual(result, expectedCsv);
    });

    it('should throw an error for an unknown template', () => {
      const invalidTemplateName = 'non_existent_template';

      assert.throws(
        () => generateCsvTemplate(invalidTemplateName),
        new Error(`Template '${invalidTemplateName}' not found`)
      );
    });

    it('should correctly format cells with internal quotes or commas if present', () => {
      const result = generateCsvTemplate('items');

      assert.ok(result.includes('ID,Display Name,Internal Name,SKU,Vehicle,Brand/Origin,Category,Unit Value,Stock Qty,Low Stock Threshold,Out of Stock,Status,Last Updated,created_at,updated_at,sync_status'));
      assert.ok(result.includes('"item_123456","Brake Pads - Front","Front Brake Pads","BP-FRONT-001","Toyota Camry","Genuine Toyota","Brakes","1500.00","50","10","true","active"'));
    });

    it('should test generation of all available templates without error', () => {
      Object.keys(CSV_TEMPLATES).forEach((templateKey) => {
        const result = generateCsvTemplate(templateKey);

        const template = CSV_TEMPLATES[templateKey];
        const expectedHeader = template.headers.join(',');

        assert.ok(result.startsWith(expectedHeader));
        assert.strictEqual(result.split('\n').length, 2);
      });
    });
  });
});
