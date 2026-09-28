import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('latest report tab embeds same-origin source-layout mirror', async () => {
  const html = await readFile('public/report-tinh-nang/index.html', 'utf8');
  assert.match(html, /\/report-tinh-nang\/latest-frame/);
  assert.doesNotMatch(html, /href=["']https:\/\/aenhatrang\.com\/report-tinh-nang/i);
});

test('worker exposes sanitized latest-frame mirror route', async () => {
  const worker = await readFile('src/worker.js', 'utf8');
  assert.match(worker, /report-tinh-nang\/latest-frame/);
  assert.match(worker, /sanitizeReportMirror/);
  assert.match(worker, /script-src 'none'/);
  assert.match(worker, /frame-ancestors 'self'/);
});
