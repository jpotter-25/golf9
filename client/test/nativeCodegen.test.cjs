const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

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
  assert.ok(rnExcluded.includes(googleLibrary));
  assert.deepEqual(findDisabledLibrariesByPlatform(config, 'android'), []);
});

test('generated iOS Fabric registry omits Google while retaining every linked game UI provider', t => {
  const directory = withWorkspace(t);
  const config = readReactNativeConfig(projectRoot, directory);
  const libraries = enabledFor(discover(directory, config), config, 'ios');
  assert.equal(libraries.some(library => library.name === googleLibrary), false);
  const output = path.join(directory, 'ios-provider');
  generateRCTThirdPartyComponents(libraries, output);
  const provider = readFileSync(path.join(output, 'RCTThirdPartyComponentsProvider.mm'), 'utf8');
  assert.doesNotMatch(provider, /RNGoogleSignInButton|RNGoogleSignInButtonComponentView/);
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

test('negative control reproduces the missing-config Google class entry that crashed TestFlight build 1', t => {
  const directory = withWorkspace(t);
  const legacyConfig = {};
  const libraries = enabledFor(discover(directory, legacyConfig), legacyConfig, 'ios');
  assert.ok(libraries.some(library => library.name === googleLibrary));
  assert.ok(packageJson.expo.autolinking.ios.exclude.includes(googleLibrary));
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
