import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));

test('admin navigation wraps every tab without a horizontal scroll strip', async () => {
  const [html, styles] = await Promise.all([
    readFile(path.resolve(testDir, '../admin-public/index.html'), 'utf8'),
    readFile(path.resolve(testDir, '../admin-public/styles.css'), 'utf8'),
  ]);

  const navigation = html.match(/<nav class="tabs">([\s\S]*?)<\/nav>/)?.[1] || '';
  const tabStyles = styles.match(/\.tabs \{([^}]*)\}/)?.[1] || '';
  assert.equal((navigation.match(/<button data-tab=/g) || []).length, 14);
  assert.match(navigation, /data-tab="health"/);
  assert.match(navigation, /data-tab="audit"/);
  assert.match(tabStyles, /flex-wrap: wrap;/);
  assert.match(tabStyles, /overflow-x: visible;/);
  assert.doesNotMatch(tabStyles, /overflow-x: auto;/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.tabs \{ gap: 0\.4rem; \}/);
});
