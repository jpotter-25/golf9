const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const {
  findCodegenEnabledLibraries,
  findDisabledLibrariesByPlatform,
  readReactNativeConfig,
} = require('react-native/scripts/codegen/generate-artifacts-executor/utils.js');
const {
  generateRCTThirdPartyComponents,
} = require('react-native/scripts/codegen/generate-artifacts-executor/generateRCTThirdPartyComponents.js');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const googleLibrary = '@react-native-google-signin/google-signin';

test('Expo resolves both iOS social-auth pods and excludes the Android-only updater', () => {
  const cli = path.join(projectRoot, 'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js');
  const resolved = JSON.parse(execFileSync(process.execPath, [cli, 'react-native-config', '--platform', 'ios', '--json'], {
    cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  for (const name of [googleLibrary, 'react-native-fbsdk-next']) {
    const podspec = resolved.dependencies[name]?.platforms?.ios?.podspecPath;
    assert.ok(podspec, name + ' must be linked into CocoaPods, not just codegen');
    assert.ok(readFileSync(podspec, 'utf8').length > 0);
  }
  assert.ok(!resolved.dependencies['expo-in-app-updates']?.platforms?.ios);
});

function withWorkspace(t) {
  const tempRoot = path.resolve(os.tmpdir());
  const directory = mkdtempSync(path.join(tempRoot, 'ninebelow-native-codegen-test-'));
  t.after(() => {
    // Only remove the exact fresh directory allocated by this test.
    assert.equal(path.dirname(directory), tempRoot);
    assert.ok(path.basename(directory).startsWith('ninebelow-native-codegen-test-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

function discover(outputDirectory, config) {
  return findCodegenEnabledLibraries(packageJson, projectRoot, outputDirectory, config);
}

function enabledFor(libraries, config, platform) {
  const disabled = findDisabledLibrariesByPlatform(config, platform);
  return libraries.filter(library => !disabled.includes(library.name));
}

test('React Native codegen and Expo exclude the same iOS-only dependencies', t => {
  const directory = withWorkspace(t);
  // Read through RN's actual fallback path, as CocoaPods codegen does when no
  // generated Android autolinking JSON is present.
  const config = readReactNativeConfig(projectRoot, directory);
  const rnExcluded = findDisabledLibrariesByPlatform(config, 'ios').sort();
  const expoExcluded = [...packageJson.expo.autolinking.ios.exclude].sort();
  assert.deepEqual(rnExcluded, expoExcluded);
  assert.deepEqual(rnExcluded, ['expo-in-app-updates']);
  assert.deepEqual(findDisabledLibrariesByPlatform(config, 'android'), []);
});

test('generated iOS Fabric registry includes the now-linked Google pod and every game UI provider', t => {
  const directory = withWorkspace(t);
  const config = readReactNativeConfig(projectRoot, directory);
  const libraries = enabledFor(discover(directory, config), config, 'ios');
  assert.equal(libraries.some(library => library.name === googleLibrary), true);
  const output = path.join(directory, 'ios-provider');
  generateRCTThirdPartyComponents(libraries, output);
  const provider = readFileSync(path.join(output, 'RCTThirdPartyComponentsProvider.mm'), 'utf8');
  assert.match(provider, /RNGoogleSignInButtonComponentView/);
  assert.ok(readFileSync(path.join(projectRoot, 'node_modules', googleLibrary, 'RNGoogleSignin.podspec'), 'utf8').includes('RNGoogleSignin'));
  for (const nativeClass of [
    'RNGestureHandlerButtonComponentView',
    'RNCSafeAreaProviderComponentView',
    'RNCSafeAreaViewComponentView',
    'RNSScreenView',
    'RNSScreenStackView',
    'RNSVGPath',
    'RNSVGSvgView',
  ]) {
    assert.ok(provider.includes(`NSClassFromString(@"${nativeClass}")`), `${nativeClass} must remain registered`);
  }
});

test('negative control detects the excluded-pod/codegen mismatch that crashed TestFlight build 1', t => {
  const directory = withWorkspace(t);
  const legacyConfig = {};
  const libraries = enabledFor(discover(directory, legacyConfig), legacyConfig, 'ios');
  assert.ok(libraries.some(library => library.name === googleLibrary));
  const legacyExpoExcluded = [...packageJson.expo.autolinking.ios.exclude, googleLibrary];
  assert.notDeepEqual(findDisabledLibrariesByPlatform(legacyConfig, 'ios').sort(), legacyExpoExcluded.sort());
  const output = path.join(directory, 'legacy-ios-provider');
  generateRCTThirdPartyComponents(libraries, output);
  const provider = readFileSync(path.join(output, 'RCTThirdPartyComponentsProvider.mm'), 'utf8');
  assert.ok(provider.includes('@"RNGoogleSignInButton": NSClassFromString(@"RNGoogleSignInButtonComponentView")'));
});

test('Android still discovers and enables the Google Sign-In codegen library', t => {
  const directory = withWorkspace(t);
  const config = readReactNativeConfig(projectRoot, directory);
  const libraries = enabledFor(discover(directory, config), config, 'android');
  const google = libraries.find(library => library.name === googleLibrary);
  assert.ok(google, 'Android Google Sign-In must not be disabled by the iOS fix');
  assert.equal(google.config.name, 'RNGoogleSignInCGen');
  assert.equal(google.config.type, 'all');
  assert.equal(google.config.android.javaPackageName, 'com.reactnativegooglesignin');
});
