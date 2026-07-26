import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const companySiteDir = path.resolve(testDir, '../../company-site');

async function readSiteFile(fileName) {
  return readFile(path.join(companySiteDir, fileName), 'utf8');
}

test('Potterwell contact actions open the private support form', async () => {
  const html = await readSiteFile('index.html');

  assert.match(html, /data-support-endpoint="https:\/\/ninebelow\.potterwell\.com\/support\/public"/);
  assert.match(html, /data-support-source="potterwell"/);
  assert.ok((html.match(/data-support-open/g) || []).length >= 3);
  assert.doesNotMatch(html, /mailto:/);
});

test('Potterwell contact form offers parent-company inquiry categories', async () => {
  const html = await readSiteFile('index.html');

  assert.match(html, /value="general">General inquiry</);
  assert.match(html, /value="partnership">Partnership</);
  assert.match(html, /value="suggestion">Suggestion</);
  assert.match(html, /value="proposal">Product or venture proposal</);
  assert.match(html, /value="press">Media and press</);
  assert.match(html, /value="website">Website feedback</);
  assert.match(html, /value="other">Other</);
});

test('Potterwell legal pages direct visitors to the private contact form', async () => {
  const privacy = await readSiteFile('privacy.html');
  const terms = await readSiteFile('terms.html');

  assert.match(privacy, /href="\/\?support=1">Potterwell contact form</);
  assert.match(terms, /href="\/\?support=1">Potterwell contact form</);
  assert.doesNotMatch(privacy, /mailto:/);
  assert.doesNotMatch(terms, /mailto:/);
});
