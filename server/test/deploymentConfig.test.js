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
