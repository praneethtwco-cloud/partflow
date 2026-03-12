import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCsvTemplate, CSV_TEMPLATES, validateCsvAgainstTemplate } from '../../utils/csv-templates';
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

  describe('validateCsvAgainstTemplate', () => {
    it('should return invalid for unknown template', () => {
      const result = validateCsvAgainstTemplate('a,b\n1,2', 'non_existent_template');
      assert.strictEqual(result.isValid, false);
      assert.deepStrictEqual(result.errors, ["Template 'non_existent_template' not found"]);
    });

    it('should return invalid for less than 2 rows', () => {
      const result = validateCsvAgainstTemplate('header_only', 'customers');
      assert.strictEqual(result.isValid, false);
      assert.deepStrictEqual(result.errors, ['CSV must contain at least one header row and one data row']);
    });

    it('should validate missing headers and extra headers', () => {
      const csvStr = 'shop_name,extra_col\nData 1,Data 2';
      const result = validateCsvAgainstTemplate(csvStr, 'customers');

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('Missing required headers'));
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings[0].includes('Extra headers found'));
    });

    it('should validate correctly for a valid template csv', () => {
      const csvStr = generateCsvTemplate('items');
      const result = validateCsvAgainstTemplate(csvStr, 'items');

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.warnings.length, 0);
    });

    it('should report mismatched column counts on rows', () => {
      const template = CSV_TEMPLATES['items'];
      const headers = template.headers.join(',');
      const invalidRow = '"item_123"';
      const csvStr = `${headers}\n${invalidRow}`;

      const result = validateCsvAgainstTemplate(csvStr, 'items');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(err => err.includes('Row 2 has')));
    });

    it('should stop reporting errors after 5 mismatched rows', () => {
      const template = CSV_TEMPLATES['items'];
      const headers = template.headers.join(',');

      const invalidRows = Array(7).fill('"item_123"').join('\n');
      const csvStr = `${headers}\n${invalidRows}`;

      const result = validateCsvAgainstTemplate(csvStr, 'items');
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 7);
      assert.strictEqual(result.errors[result.errors.length - 1], '...and more errors (fix first 5 and try again)');
    });

  });
});
