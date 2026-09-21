import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Railway deployment configuration prevents persistent-writer overlap and replaces fenced processes', async () => {
  const configUrl = new URL('../../railway.json', import.meta.url);
  const config = JSON.parse(await readFile(configUrl, 'utf8'));

  assert.equal(config.deploy.healthcheckPath, '/health');
  assert.equal(config.deploy.overlapSeconds, 0);
  assert.ok(config.deploy.drainingSeconds >= 2);
  assert.equal(config.deploy.restartPolicyType, 'ON_FAILURE');
  assert.ok(config.deploy.restartPolicyMaxRetries >= 1);
});

test('Railway builds the browser game using locked server and client dependencies', async () => {
  const config = JSON.parse(await readFile(new URL('../../railway.json', import.meta.url), 'utf8'));
  const rootPackage = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(config.build.buildCommand, 'npm run build');
  assert.equal(rootPackage.engines.node, '22.x');
  assert.match(rootPackage.scripts.build, /npm --prefix server ci --omit=dev/);
  assert.match(rootPackage.scripts.build, /npm --prefix client ci --include=dev/);
  assert.match(rootPackage.scripts.build, /npm run build:web/);
  const script = await readFile(new URL('../../scripts/build-web.mjs', import.meta.url), 'utf8');
  assert.match(script, /EXPO_NO_DOTENV: '1'/);
  assert.doesNotMatch(script, /--source-maps/);
});
