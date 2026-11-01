const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const RN = require('react-native-web');
const { compile, descendants } = require('./helpers/topBarFixture.cjs');

function fixture(fontScale = 1, imageComponent = RN.Image) {
  const native = { ...RN, Image: imageComponent, useWindowDimensions: () => ({ width: 320, height: 700, fontScale }) };
  const styles = compile('src/components/socialButtonStyles.ts', { 'react-native': native });
  const common = { react: React, 'react-native': native, './socialButtonStyles': styles };
  const buttons = compile('src/components/SocialSignInButton.tsx', {
    ...common, '../../assets/google-signin-g.png': { uri: '/google.png' },
  });
  const apple = compile('src/components/AppleSignInButton.tsx', { ...common,
    'react-native-svg': { __esModule: true, default: 'svg', Path: 'path', Rect: 'rect' },
  });
  return { ...buttons, apple: apple.AppleSignInButton, styles };
}

test('all providers have equal neutral dimensions, readable labels and separate spacing', () => {
  for (const fontScale of [1, 1.3, 2]) {
    const f = fixture(fontScale);
    const height = Math.ceil(52 * Math.min(fontScale, 1.5));
    for (const provider of ['google', 'facebook']) {
      const tree = f.SocialSignInButton({ provider, onPress() {} });
      const style = RN.StyleSheet.flatten(tree.props.style);
      assert.equal(style.height, height);
      assert.equal(style.backgroundColor, '#FFFFFF');
      assert.equal(style.borderRadius, 10);
      assert.equal(style.marginBottom, undefined);
      assert.equal(tree.props.accessibilityRole, 'button');
      const label = descendants(tree).find(n => n.type === RN.Text && String(n.props.children).startsWith('Continue'));
      assert.equal(label.props.adjustsFontSizeToFit, true);
      assert.equal(label.props.maxFontSizeMultiplier, 1.5);
    }
    const apple = f.apple({ onPress() {} });
    assert.equal(RN.StyleSheet.flatten(apple.props.style).height, height);
    assert.equal(f.styles.socialButtonStyles.group.gap, 12);
    const appleText = descendants(apple).find(n => n.type === RN.Text);
    const googleText = descendants(f.SocialSignInButton({ provider: 'google', onPress() {} }))
      .find(n => n.type === RN.Text);
    for (const property of ['fontSize', 'fontWeight', 'textAlign', 'flexShrink']) {
      assert.equal(RN.StyleSheet.flatten(appleText.props.style)[property],
        RN.StyleSheet.flatten(googleText.props.style)[property]);
    }
    assert.equal(RN.StyleSheet.flatten(appleText.props.style).fontSize, 16);
    for (const property of ['numberOfLines', 'adjustsFontSizeToFit', 'minimumFontScale', 'maxFontSizeMultiplier']) {
      assert.equal(appleText.props[property], googleText.props[property]);
    }
    const logo = descendants(apple).find(n => n.type === 'svg');
    assert.equal(logo.props.height, height);
    assert.equal(logo.props.viewBox, '0 0 31 44');
  }
});

test('all provider buttons dispatch once when enabled and never when disabled', () => {
  const f = fixture();
  for (const render of [p => f.SocialSignInButton({ ...p, provider: 'google' }),
    p => f.SocialSignInButton({ ...p, provider: 'facebook' }), f.apple]) {
    let calls = 0;
    render({ disabled: true, onPress: () => calls++ }).props.onPress();
    assert.equal(calls, 0);
    render({ disabled: false, onPress: () => calls++ }).props.onPress();
    assert.equal(calls, 1);
  }
});

test('iOS resolves the shared Apple presentation, not an auto-sized native label override', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '../src/components/AppleSignInButton.ios.tsx')), false);
});

test('Google uses the approved color asset instead of a monochrome letter', () => {
  const tree = fixture().SocialSignInButton({ provider: 'google', onPress() {} });
  const image = descendants(tree).find(n => n.type === RN.Image);
  assert.equal(image.props.source.uri, '/google.png');
  assert.equal(image.props.resizeMode, 'contain');
  assert.equal(image.props.accessible, false);
});

module.exports = { fixture };
