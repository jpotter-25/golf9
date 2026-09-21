import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createGameWebRouter } from '../gameWeb.js';

test('browser game serves an isolated, CSP-protected SPA without exposing build internals', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ninebelow-web-test-'));
  await mkdir(path.join(directory, '_expo'));
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><title>Nine Below</title>');
  await writeFile(path.join(directory, '_expo', 'app.js'), 'console.log("game")');
  await writeFile(path.join(directory, '_expo', 'app.js.map'), 'private source map');
  await writeFile(path.join(directory, 'metadata.json'), 'private export metadata');
  await writeFile(path.join(directory, '.env'), 'secret');
  const app = express();
  app.use('/play', createGameWebRouter({ directory }));
  app.use('/unbuilt', createGameWebRouter({ directory: path.join(directory, 'missing') }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  await t.test('canonical entry redirects under /play and preserves query', async () => {
    const response = await fetch(`${base}/play?from=test`, { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/play/?from=test');
  });
  await t.test('entry HTML and SPA paths revalidate while scripts are cached', async () => {
    for (const suffix of ['/', '/index.html', '/room/ABCDEF']) {
      const response = await fetch(`${base}/play${suffix}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(await response.text(), /Nine Below/);
      const csp = response.headers.get('content-security-policy');
      assert.match(csp, /script-src 'self';/);
      assert.doesNotMatch(csp, /unsafe-eval|script-src[^;]*unsafe-inline/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    const script = await fetch(`${base}/play/_expo/app.js`);
    assert.equal(script.status, 200);
    assert.equal(script.headers.get('cache-control'), 'public, max-age=3600');
    assert.match(script.headers.get('content-type'), /javascript/);
  });
  await t.test('source maps, hidden files, config, and missing assets are not a SPA route', async () => {
    for (const suffix of ['/_expo/app.js.map', '/metadata.json', '/.env', '/%2eenv', '/missing.js', '/%2e%2e%5cpackage.json']) {
      const response = await fetch(`${base}/play${suffix}`);
      assert.equal(response.status, 404, suffix);
      assert.doesNotMatch(await response.text(), /private source map|private export|secret|Nine Below/);
    }
  });
  await t.test('non-browser fetches, mutations, and unrelated API routes are not swallowed', async () => {
    assert.equal((await fetch(`${base}/play/room/ABCDEF`, { headers: { Accept: 'application/json' } })).status, 404);
    const post = await fetch(`${base}/play/`, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
    assert.deepEqual(await (await fetch(`${base}/health`)).json(), { ok: true });
    assert.equal((await fetch(`${base}/not-an-api`)).status, 404);
    assert.equal((await fetch(`${base}/unbuilt/`)).status, 503);
  });
});
