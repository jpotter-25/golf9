import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));

test('admin console provides an accessible live health workspace with drill-down context', async () => {
  const [html, app, styles] = await Promise.all([
    readFile(path.resolve(testDir, '../admin-public/index.html'), 'utf8'),
    readFile(path.resolve(testDir, '../admin-public/app.js'), 'utf8'),
    readFile(path.resolve(testDir, '../admin-public/styles.css'), 'utf8'),
  ]);

  assert.match(html, /data-tab="health" class="active"/);
  assert.match(html, /id="health" class="tab active"/);
  assert.match(html, /id="healthMessage"[^>]+aria-live="polite"/);
  assert.match(html, /id="refreshHealth"/);
  assert.match(html, /Recent health changes/);
  assert.match(app, /api\(`\/health\$\{force \? '\?refresh=1' : ''\}`\)/);
  assert.match(app, /healthActive \? 10_000 : 30_000/);
  assert.match(app, /document\.visibilityState !== 'hidden'/);
  assert.match(app, /<details class="health-details">/);
  assert.match(app, /Health status:/);
  assert.match(styles, /\.health-card\.health-critical/);
  assert.match(styles, /\.health-tab-indicator\.health-warning/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]+\.health-grid/);
});
