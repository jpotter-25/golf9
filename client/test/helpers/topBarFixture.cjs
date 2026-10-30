// Isolated fixture: actual shared header/layout, synthetic account and services.
// No server connection, authentication bypass, or production account mutation.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const RN = require('react-native-web');

function compile(relativePath, dependencies = {}) {
  const filename = path.join(__dirname, '../../', relativePath);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (name === 'react/jsx-runtime') return require(name);
      throw new Error(`Unmocked header dependency: ${name}`);
    },
  }, { filename });
  return exports;
}

const formatter = compile('src/utils/coinBalance.ts');
const theme = compile('src/ui/theme.ts');
const scaling = compile('src/utils/scaling.ts', { 'react-native': RN, 'react-native-safe-area-context': {} });

function topBarFixture({ coins = 54_321, width = 414, route = 'Lobby', fontScale = 1, hidden = [], locked = [] } = {}) {
  const navigations = [];
  const unavailable = [];
  const icon = ({ size, color }) => React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', style: { flexShrink: 0 }, 'aria-hidden': true },
    React.createElement('circle', { cx: 12, cy: 12, r: 8, fill: 'none', stroke: color, strokeWidth: 2 }));
  const avatar = ({ size }) => React.createElement(RN.View, { style: { width: size, height: size, flexShrink: 0, borderRadius: size / 2, borderWidth: 2, borderColor: '#67e0b0', alignItems: 'center', justifyContent: 'center' } }, React.createElement(RN.Text, { style: { color: '#f4c95d' } }, 'P'));
  const native = { ...RN, useWindowDimensions: () => ({ width, height: 896, scale: 1, fontScale }) };
  if (fontScale !== 1) {
    native.Text = ({ style, ...props }) => {
      const flat = RN.StyleSheet.flatten(style) || {};
      return React.createElement(RN.Text, { ...props, style: [style, { fontSize: (flat.fontSize || 14) * fontScale, ...(flat.lineHeight ? { lineHeight: flat.lineHeight * fontScale } : {}) }] });
    };
  }
  const components = compile('src/ui/components.tsx', {
    react: { ...React, useState: value => [value, () => {}], useEffect: () => {} },
    'react-native': native,
    'expo-linear-gradient': { LinearGradient: RN.View },
    'lucide-react-native': new Proxy({}, { get: () => icon }),
    '@react-navigation/native': { useRoute: () => ({ name: route }), useNavigation: () => ({ navigate: target => navigations.push(target) }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    '../context/AuthContext': { useAuth: () => ({ token: 'fixture-only', user: { displayName: 'Test Player', progression: { level: 11, levelProgress: 0.5 }, currency: { coins }, inventory: {} } }) },
    '../context/AvailabilityContext': { useAvailability: () => ({ entry: () => ({ state: 'live' }), isAvailable: key => !locked.includes(key), isVisible: key => !hidden.includes(key), showUnavailable: key => unavailable.push(key) }) },
    '../context/ClubRealtimeContext': { useClubRealtime: () => ({ club: { tag: 'TEST' }, clubActionCount: 0, clubChatUnread: 0 }) },
    '../services/preferences': { getGameplayPreferences: () => ({}) },
    '../components/AvatarDecorations': { ProgressAvatar: avatar },
    '../components/ClubEmblem': { ClubEmblem: icon },
    '../components/AccountControls': { AccountControls: () => null },
    '../utils/scaling': scaling,
    '../utils/coinBalance': formatter,
    './theme': theme,
  });
  const shell = components.ScreenShell({ children: null });
  const header = shell.props.children[0];
  return { tree: header.type(header.props), navigations, unavailable, components, native };
}

function descendants(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(descendants)];
}

module.exports = { topBarFixture, descendants, compile, theme, formatCoinBalance: formatter.formatCoinBalance };
