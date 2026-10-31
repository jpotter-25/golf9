const assert = require('node:assert/strict');
const test = require('node:test');
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
    'react-native-svg': { __esModule: true, default: 'svg', Path: 'path' },
  });
  const ios = compile('src/components/AppleSignInButton.ios.tsx', { ...common,
    'expo-apple-authentication': {
      AppleAuthenticationButton: 'NativeAppleButton',
      AppleAuthenticationButtonType: { CONTINUE: 'CONTINUE' },
      AppleAuthenticationButtonStyle: { WHITE: 'WHITE', BLACK: 'BLACK' },
    },
  });
  return { ...buttons, apple: apple.AppleSignInButton, ios: ios.AppleSignInButton, styles };
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
    const ios = f.ios({ onPress() {} }).props.children;
    assert.equal(ios.type, 'NativeAppleButton');
    assert.equal(ios.props.buttonStyle, 'WHITE');
    assert.equal(ios.props.style.height, height);
    assert.equal(ios.props.cornerRadius, 10);
  }
});

test('all provider buttons dispatch once when enabled and never when disabled', () => {
  const f = fixture();
  for (const render of [p => f.SocialSignInButton({ ...p, provider: 'google' }),
    p => f.SocialSignInButton({ ...p, provider: 'facebook' }), f.apple,
    p => f.ios(p).props.children]) {
    let calls = 0;
    render({ disabled: true, onPress: () => calls++ }).props.onPress();
    assert.equal(calls, 0);
    render({ disabled: false, onPress: () => calls++ }).props.onPress();
    assert.equal(calls, 1);
  }
});

test('Google uses the approved color asset instead of a monochrome letter', () => {
  const tree = fixture().SocialSignInButton({ provider: 'google', onPress() {} });
  const image = descendants(tree).find(n => n.type === RN.Image);
  assert.equal(image.props.source.uri, '/google.png');
  assert.equal(image.props.resizeMode, 'contain');
  assert.equal(image.props.accessible, false);
});

module.exports = { fixture };
