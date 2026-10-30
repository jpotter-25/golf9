const assert = require('node:assert/strict');
const test = require('node:test');
const { StyleSheet } = require('react-native-web');
const { renderToStaticMarkup } = require('react-dom/server');
const { topBarFixture, descendants, formatCoinBalance } = require('./helpers/topBarFixture.cjs');

test('ordinary balances retain every digit and thousands separators', () => {
  for (const [coins, display] of [[0, '0'], [54, '54'], [999, '999'], [1000, '1,000'], [54321, '54,321'], [99999, '99,999']]) {
    assert.equal(formatCoinBalance(coins).display, display);
    assert.equal(formatCoinBalance(coins).exact, display);
  }
});

test('large balances compact with at most three significant digits and never round up', () => {
  for (const [coins, display] of [[100000, '100K'], [125999, '125K'], [999999, '999K'], [1000000, '1M'], [1250000, '1.25M'], [1999999, '1.99M'], [12345678, '12.3M'], [999999999, '999M'], [1000000000, '1B'], [1250000000000, '1.25T'], [Number.MAX_SAFE_INTEGER, '9Q']]) {
    const result = formatCoinBalance(coins);
    assert.equal(result.display, display);
    assert.equal(result.exact.replaceAll(',', ''), String(coins));
    const units = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 };
    assert.ok(parseFloat(result.display) * units[result.display.at(-1)] <= coins);
  }
});

test('invalid balances are unavailable, not misleading numbers', () => {
  for (const coins of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(formatCoinBalance(coins).display, '—');
    assert.equal(formatCoinBalance(coins).exact, 'unavailable');
  }
});

test('actual shared header never constrains or ellipsizes coin text and announces exact balance', () => {
  for (const coins of [54321, 1250000, Number.MAX_SAFE_INTEGER]) {
    const fixture = topBarFixture({ coins });
    const nodes = descendants(fixture.tree);
    const button = nodes.find(node => node.props.accessibilityLabel?.startsWith('Coin balance:'));
    const text = descendants(button).find(node => node.props.children === formatCoinBalance(coins).display);
    const buttonStyle = StyleSheet.flatten(button.props.style);
    const textStyle = StyleSheet.flatten(text.props.style);
    assert.equal(buttonStyle.width, undefined);
    assert.equal(buttonStyle.maxWidth, undefined);
    assert.equal(buttonStyle.flexShrink, 0);
    assert.equal(textStyle.maxWidth, undefined);
    assert.equal(text.props.numberOfLines, undefined);
    assert.equal(text.props.ellipsizeMode, undefined);
    assert.ok(button.props.accessibilityLabel.includes(formatCoinBalance(coins).exact));
    button.props.onPress();
    assert.deepEqual(fixture.navigations, ['Shop']);
    assert.ok(renderToStaticMarkup(fixture.tree).includes(formatCoinBalance(coins).display));
  }
});

test('header wraps groups instead of crushing them, including the non-lobby home button', () => {
  for (const width of [320, 375, 414, 768]) {
    for (const route of ['Lobby', 'Shop']) {
      const { tree } = topBarFixture({ width, route });
      const header = tree.props.children[0];
      assert.equal(StyleSheet.flatten(header.props.style).flexWrap, 'wrap');
      const [identity, actions] = header.props.children;
      assert.ok(StyleSheet.flatten(identity.props.style).minWidth >= 112);
      assert.equal(StyleSheet.flatten(actions.props.style).flexWrap, 'wrap');
      assert.equal(descendants(tree).some(node => node.props.accessibilityLabel === 'Go home'), route !== 'Lobby');
    }
  }
});

test('shop availability and hidden controls retain their existing behavior', () => {
  const locked = topBarFixture({ locked: ['shop'] });
  descendants(locked.tree).find(node => node.props.accessibilityLabel?.startsWith('Coin balance:')).props.onPress();
  assert.deepEqual(locked.unavailable, ['shop']);
  assert.deepEqual(locked.navigations, []);
  const hidden = topBarFixture({ hidden: ['shop', 'inbox'] });
  assert.equal(descendants(hidden.tree).some(node => node.props.accessibilityLabel?.startsWith('Coin balance:')), false);
  assert.equal(descendants(hidden.tree).some(node => node.props.accessibilityLabel === 'Open inbox'), false);
});
