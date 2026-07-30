import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const adminAppPath = path.resolve(testDir, '../admin-public/app.js');

test('admin recovery clears the submitted form after an asynchronous reset', async () => {
  const source = await readFile(adminAppPath, 'utf8');
  let submitHandler = null;
  let resetCount = 0;

  const formNode = {
    addEventListener(type, handler) {
      if (type === 'submit') submitHandler = handler;
    },
    reset() {
      resetCount += 1;
    },
  };
  const classList = {
    contains: () => true,
    toggle: () => {},
  };
  const messageNode = { textContent: '' };
  const nodes = new Map([
    ['#recoveryStatus', { textContent: '' }],
    ['#toggleRecovery', { addEventListener: () => {}, classList, disabled: false, textContent: '' }],
    ['#recoveryPanel', { classList }],
    ['#recoveryMessage', messageNode],
    ['#recoveryCompleteForm', formNode],
  ]);

  class FormDataStub {
    constructor(node) {
      assert.equal(node, formNode);
    }

    get(key) {
      return {
        identifier: 'admin-user',
        code: '123456',
        newPassword: 'new-password',
      }[key];
    }
  }

  const fetch = async url => {
    if (url.endsWith('/auth/recovery/config')) {
      return { ok: true, json: async () => ({ enabled: true }) };
    }
    if (url.endsWith('/auth/recovery/complete')) {
      await Promise.resolve();
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
  };

  vm.runInNewContext(source, {
    console,
    document: {
      querySelector: selector => nodes.get(selector) || null,
      querySelectorAll: () => [],
    },
    fetch,
    FormData: FormDataStub,
    Set,
  });

  assert.equal(typeof submitHandler, 'function');
  const event = {
    currentTarget: formNode,
    preventDefault: () => {},
  };
  const submission = submitHandler(event);

  // Browsers clear currentTarget once the synchronous event dispatch completes.
  event.currentTarget = null;
  await submission;

  assert.equal(resetCount, 1);
  assert.equal(messageNode.textContent, 'Password updated. Sign in with the new password.');
});
