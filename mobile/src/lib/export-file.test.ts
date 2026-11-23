/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { exportFilename, exportPath } from './export-file.ts';

test('export path carries the dataset, format and requested dates', () => {
  assert.equal(
    exportPath('business-1', {
      dataset: 'sales',
      format: 'xlsx',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    }),
    '/businesses/business-1/exports/sales?format=xlsx&start_date=2026-01-01&end_date=2026-01-31',
  );
});

test('export path omits dates that were not requested', () => {
  assert.equal(
    exportPath('business-2', { dataset: 'all', format: 'pdf' }),
    '/businesses/business-2/exports/all?format=pdf',
  );
});

test('export filename matches the downloaded file type and end date', () => {
  assert.equal(
    exportFilename('income_statement', '2026-01-31', 'xlsx'),
    'khoebo-income_statement-2026-01-31.xlsx',
  );
  assert.equal(
    exportFilename('sales', undefined, 'pdf'),
    `khoebo-sales-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
});
