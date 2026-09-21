const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(readFileSync(path.join(__dirname, '../src/utils/alert.web.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Exercise actual adapter callbacks with a small DOM surface; browser smoke
// tests additionally cover rendering and integration with React Native Web.
function setup() {
  const documentListeners = new Map();
  let document;
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.style = {};
      this.attributes = {};
      this.listeners = new Map();
      this.inert = false;
      this.parent = null;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    appendChild(child) { this.children.push(child); child.parent = this; return child; }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    contains(target) { return this === target || this.children.some(child => child.contains(target)); }
    get isConnected() { return document.body.contains(this); }
    focus() { document.activeElement = this; documentListeners.get('focusin')?.({ target: this }); }
    remove() {
      this.parent.children = this.parent.children.filter(child => child !== this);
      this.parent = null;
    }
    click() { this.listeners.get('click')?.({ target: this }); }
  }
  document = {
    body: new Element('body'), activeElement: null,
    createElement: tag => new Element(tag),
    addEventListener: (type, callback) => documentListeners.set(type, callback),
    removeEventListener: type => documentListeners.delete(type),
  };
  const root = document.body.appendChild(new Element('main'));
  const trigger = root.appendChild(new Element('button'));
  trigger.focus();
  const moduleExports = {};
  vm.runInNewContext(compiled, { exports: moduleExports, document, HTMLElement: Element });
  const overlay = () => document.body.children.find(element => element !== root);
  const dialog = () => overlay()?.children[0];
  const buttons = () => dialog()?.children.at(-1).children;
  const key = (type, value, shiftKey = false) => {
    const event = { key: value, shiftKey, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    documentListeners.get(type)?.(event);
    return event;
  };
  return { Alert: moduleExports.Alert, document, root, trigger, overlay, dialog, buttons, key };
}

test('browser alerts show escaped text, every action, and invoke only the chosen callback once', () => {
  const ui = setup();
  const called = [];
  ui.Alert.alert('<title>', '<img src=x onerror=alert(1)>', [
    { text: 'Cancel', style: 'cancel', onPress: () => called.push('cancel') },
    { text: 'Another action', onPress: () => called.push('another') },
    { text: 'Delete', style: 'destructive', onPress: () => called.push('delete') },
  ]);
  assert.equal(ui.dialog().attributes.role, 'alertdialog');
  assert.equal(ui.dialog().attributes['aria-modal'], 'true');
  assert.equal(ui.dialog().children[0].textContent, '<title>');
  assert.equal(ui.dialog().children[1].textContent, '<img src=x onerror=alert(1)>');
  assert.deepEqual(Array.from(ui.buttons(), button => button.textContent), ['Cancel', 'Another action', 'Delete']);
  assert.equal(ui.root.inert, true);
  const deleteButton = ui.buttons()[2];
  deleteButton.click();
  deleteButton.click();
  assert.deepEqual(called, ['delete']);
  assert.equal(ui.overlay(), undefined);
  assert.equal(ui.root.inert, false);
  assert.equal(ui.document.activeElement, ui.trigger);
});

test('mandatory round dialogs cannot dismiss through Escape or backdrop', () => {
  const ui = setup();
  let nextRound = 0;
  let dismissed = 0;
  ui.Alert.alert('Round complete', 'Continue', [{ text: 'Next', onPress: () => nextRound++ }], {
    cancelable: false, onDismiss: () => dismissed++,
  });
  ui.key('keydown', 'Escape');
  assert.equal(ui.key('keyup', 'Escape').stopped, true);
  ui.overlay().click();
  assert.ok(ui.overlay());
  assert.equal(dismissed, 0);
  ui.buttons()[0].click();
  assert.equal(nextRound, 1);
});

test('cancelable dismissal preserves queued alerts and calls onDismiss without selecting a choice', () => {
  const ui = setup();
  let dismissed = 0;
  let selected = 0;
  ui.Alert.alert('First', '', [{ text: 'Do it', onPress: () => selected++ }], {
    cancelable: true, onDismiss: () => dismissed++,
  });
  ui.Alert.alert('Second', 'Still visible');
  assert.equal(ui.dialog().children[0].textContent, 'First');
  ui.key('keyup', 'Escape');
  assert.equal(dismissed, 1);
  assert.equal(selected, 0);
  assert.equal(ui.dialog().children[0].textContent, 'Second');
  assert.equal(ui.buttons()[0].textContent, 'OK');
  ui.buttons()[0].click();
  assert.equal(ui.overlay(), undefined);
});

test('keyboard focus wraps through every button and explicit cancel invokes its callback', () => {
  const ui = setup();
  let cancelled = 0;
  let dismissed = 0;
  ui.Alert.alert('Choose', '', [
    { text: 'One' }, { text: 'Two' },
    { text: 'Cancel', style: 'cancel', onPress: () => cancelled++ },
  ], { cancelable: true, onDismiss: () => dismissed++ });
  const buttons = ui.buttons();
  assert.equal(ui.document.activeElement, buttons[2]);
  ui.key('keydown', 'Tab');
  assert.equal(ui.document.activeElement, buttons[0]);
  ui.key('keydown', 'Tab', true);
  assert.equal(ui.document.activeElement, buttons[2]);
  buttons[2].click();
  assert.equal(cancelled, 1);
  assert.equal(dismissed, 0);
});

test('a follow-up opened by a callback preserves older queued messages', () => {
  const ui = setup();
  ui.Alert.alert('First', '', [{ text: 'Next', onPress: () => ui.Alert.alert('Third') }]);
  ui.Alert.alert('Second');
  ui.buttons()[0].click();
  assert.equal(ui.dialog().children[0].textContent, 'Second');
  ui.buttons()[0].click();
  assert.equal(ui.dialog().children[0].textContent, 'Third');
  ui.buttons()[0].click();
  assert.equal(ui.overlay(), undefined);
});
