import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));

test('admin console groups operational workspaces and explains the active area', async () => {
  const [html, app, styles] = await Promise.all([
    readFile(path.resolve(testDir, '../admin-public/index.html'), 'utf8'),
    readFile(path.resolve(testDir, '../admin-public/app.js'), 'utf8'),
    readFile(path.resolve(testDir, '../admin-public/styles.css'), 'utf8'),
  ]);

  assert.match(html, /Find a workspace/);
  assert.match(html, /<p>Game Design<\/p>/);
  assert.match(html, /<strong>Design Studio<\/strong><small>Cosmetics and rewards<\/small>/);
  assert.match(html, /id="pageTitle">Command Center/);
  assert.match(html, /id="toggleConsoleDensity"/);
  assert.match(app, /const ADMIN_WORKSPACES =/);
  assert.match(app, /function filterAdminNavigation\(\)/);
  assert.match(app, /localStorage\.setItem\('nineBelowAdminDensity'/);
  assert.match(styles, /\.console-shell \{[\s\S]*?grid-template-areas:/);
  assert.match(styles, /@media \(max-width: 880px\)[\s\S]*?grid-template-columns: 1fr/);
});

test('game design studio provides visual presets, live preview, guided unlocks, and advanced controls', async () => {
  const [html, app, styles] = await Promise.all([
    readFile(path.resolve(testDir, '../admin-public/index.html'), 'utf8'),
    readFile(path.resolve(testDir, '../admin-public/app.js'), 'utf8'),
    readFile(path.resolve(testDir, '../admin-public/styles.css'), 'utf8'),
  ]);

  assert.match(html, /Game Design Studio/);
  assert.equal((html.match(/class="palette-card"/g) || []).length, 5);
  assert.match(html, /id="catalogLivePreview"[^>]+aria-live="polite"/);
  assert.match(html, /id="catalogAdvancedToggle"/);
  assert.match(html, /What did you change\?/);
  assert.match(html, /Players see it only after Review &amp; Publish/);
  assert.match(app, /function syncCatalogDesigner\(\)/);
  assert.match(app, /function applyCatalogPalette\(button\)/);
  assert.match(app, /function catalogUnlockSummary\(form\)/);
  assert.match(app, /const id = `custom-cosmetic-\$\{Date\.now\(\)\.toString\(36\)\}`/);
  assert.doesNotMatch(app, /prompt\('New cosmetic id/);
  assert.match(styles, /\.designer-grid/);
  assert.match(styles, /\.game-preview/);
  assert.match(styles, /\.designer:not\(\.show-advanced\) \.advanced-only/);
});
