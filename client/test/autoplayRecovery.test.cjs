const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const React = require('react');
const RN = require('react-native-web');
const { renderToStaticMarkup } = require('react-dom/server');
const { compile, descendants } = require('./helpers/topBarFixture.cjs');
const { viewerRecovery, selectGameOverlay } = compile('src/game/recovery.ts');
const { AutoplayRecovery } = compile('src/components/AutoplayRecovery.tsx', { react: React, 'react-native': RN });
const flags = { quit: false, pass: false, summary: false, shop: false, avatar: false, settings: false, chat: false, clubChat: false, notice: false };

test('recovery is available to either seat without a popup, independent of whose turn it is', () => {
  for (const viewerIndex of [0, 1]) {
    for (const currentPlayerIndex of [0, 1]) {
      for (const phase of ['peek', 'turn', 'roundSummary']) {
        const recovery = viewerRecovery({ online: true, seated: viewerIndex >= 0, viewer: { active: true } });
        assert.equal(recovery.active, true, `${viewerIndex}/${currentPlayerIndex}/${phase}`);
        assert.equal(recovery.canReclaim, true);
        assert.equal(selectGameOverlay({ ...flags, notice: true }, true, recovery.active), null);
        let pressed = 0;
        const tree = AutoplayRecovery({ busy: false, forfeited: false, error: null, onTakeControl: () => pressed++ });
        const button = descendants(tree).find(node => node.props.accessibilityRole === 'button');
        assert.ok(button);
        assert.equal(button.props.disabled, false);
        button.props.onPress();
        assert.equal(pressed, 1);
        assert.match(renderToStaticMarkup(tree), /Take Back Control/);
        assert.ok(!descendants(tree).some(node => node.type === RN.Modal));
      }
    }
  }
});

test('authoritative reclaim response clears autoplay even when a room summary is still stale', () => {
  const input = { online: true, seated: true, seat: { autoplayActive: true } };
  assert.equal(viewerRecovery(input).active, true);
  assert.equal(viewerRecovery({ ...input, viewer: { active: false } }).active, false);
  assert.equal(viewerRecovery({ ...input, viewer: { active: true }, seat: { autoplayActive: false } }).active, true);
  for (const change of [{ online: false }, { seated: false }, { completed: true }]) {
    assert.equal(viewerRecovery({ ...input, ...change }).canReclaim, false);
  }
  const forfeited = viewerRecovery({ ...input, viewer: { active: true, forfeited: true } });
  assert.equal(forfeited.canReclaim, false);
  const html = renderToStaticMarkup(AutoplayRecovery({ busy: false, forfeited: true, error: null, onTakeControl: () => {} }));
  assert.match(html, /cannot be reclaimed/);
  assert.ok(!html.includes('Take Back Control'));
});

test('background/foreground and competing dialogs select at most one presentation', () => {
  const all = Object.fromEntries(Object.keys(flags).map(key => [key, true]));
  assert.equal(selectGameOverlay(all, false, true), null);
  assert.equal(selectGameOverlay(all, true, true), 'quit');
  assert.equal(selectGameOverlay({ ...flags, summary: true, chat: true, notice: true }, true, true), 'summary');
  assert.equal(selectGameOverlay({ ...flags, settings: true, notice: true }, true, false), 'settings');
  assert.equal(selectGameOverlay({ ...flags, notice: true }, true, false), 'notice');
  assert.equal(selectGameOverlay({ ...flags, notice: true }, true, true), null);
});

test('busy recovery is disabled and failure leaves an accessible retry button and inline error', () => {
  for (const busy of [true, false]) {
    const tree = AutoplayRecovery({ busy, forfeited: false, error: 'Connection interrupted. Try again.', onTakeControl: () => {} });
    const nodes = descendants(tree);
    assert.equal(nodes.find(node => node.props.accessibilityRole === 'button').props.disabled, busy);
    assert.ok(nodes.some(node => node.props.accessibilityRole === 'alert'));
    const button = nodes.find(node => node.props.accessibilityRole === 'button');
    assert.equal(RN.StyleSheet.flatten(button.props.style({ pressed: false })).minHeight, 44);
  }
});

test('GameScreen uses one modal host, keeps recovery in board and sheets, and gates manual controls', () => {
  const source = readFileSync(path.join(__dirname, '../src/screens/GameScreen.tsx'), 'utf8');
  assert.equal((source.match(/<Modal\s/g) || []).length, 1);
  assert.match(source, /visible=\{activeOverlay !== null\}/);
  assert.match(source, /recoveryPanel \?\? \(pendingForBottom/);
  assert.match(source, /styles\.modalRecovery[\s\S]*\{recoveryPanel\}/);
  assert.match(source, /const isHumanTurn = !viewerAutoplayActive/);
  assert.match(source, /\? !viewerAutoplayActive && isOnlinePeek/);
  assert.match(source, /hudTitle = viewerAutoplayActive \? 'Autoplay'/);
  assert.match(source, /AppState\.addEventListener\('change', next => setAppActive/);
});

function networkFixture(reply) {
  let timeout;
  const socket = { timeout: ms => { timeout = ms; return socket; }, emit: (event, payload, callback) => {
    assert.equal(event, 'game:take-control');
    assert.equal(payload.code, 'TEST');
    callback(...reply);
  } };
  const network = compile('src/services/network.ts', {
    'socket.io-client': { io: () => socket }, '../config': { SOCKET_URL: 'http://localhost' },
    '../utils/deviceIdentity': { getInstallIdSync: () => 'fixture' },
    '../utils/releaseInfo': { releaseSocketAuth: () => ({}) }, './releasePolicyEvents': {},
  });
  return { run: () => network.takeBackControl('test-only', 'TEST'), timeout: () => timeout };
}

test('take-control acknowledgement succeeds or times out so retry never stays stuck', async () => {
  const game = { viewerAutoplay: { active: false } };
  const ok = networkFixture([null, { game }]);
  assert.equal((await ok.run()).game, game);
  assert.equal(ok.timeout(), 10_000);
  await assert.rejects(networkFixture([new Error('timeout')]).run(), /Connection interrupted/);
  await assert.rejects(networkFixture([null, { error: 'A forfeited seat remains under permanent autoplay.' }]).run(), /forfeited/);
  await assert.rejects(networkFixture([null, {}]).run(), /Unable to restore/);
});
