const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
  : process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || '';
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';
const facebookClientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN || '';
const facebookDisplayName = process.env.EXPO_PUBLIC_FACEBOOK_DISPLAY_NAME || 'Nine Below';
const isIosBuild = process.env.EAS_BUILD_PLATFORM === 'ios' || process.env.EXPO_PUBLIC_APP_TARGET === 'ios';
// The linked Facebook Expo delegate runs at launch: never ship it without its plist configuration.
if (isIosBuild && (!facebookAppId || !facebookClientToken)) {
  throw new Error('iOS builds require EXPO_PUBLIC_FACEBOOK_APP_ID and EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN.');
}
if (isIosBuild && process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === '1' && (!googleWebClientId || !googleIosClientId)) {
  throw new Error('Social-login iOS builds require both Google Web and iOS client IDs.');
}
const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL
  || (process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'production' : 'playtest');

const plugins = [];

plugins.push('expo-secure-store');
plugins.push('expo-notifications');
plugins.push('expo-apple-authentication');
plugins.push('expo-web-browser');
plugins.push([
  'expo-build-properties',
  {
    ios: {
      // Google Sign-In's AppCheckCore Swift dependency needs these module maps.
      // Scope this to its dependencies; do not change all pods to frameworks.
      extraPods: [
        { name: 'GoogleUtilities', modular_headers: true },
        { name: 'RecaptchaInterop', modular_headers: true },
      ],
    },
    android: {
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
    },
  },
]);

if (googleWebClientId && googleIosUrlScheme) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    { iosUrlScheme: googleIosUrlScheme },
  ]);
}

if (facebookAppId && facebookClientToken) {
  plugins.push([
    'react-native-fbsdk-next',
    {
      appID: facebookAppId,
      clientToken: facebookClientToken,
      displayName: facebookDisplayName,
      scheme: `fb${facebookAppId}`,
      advertiserIDCollectionEnabled: false,
      iosUserTrackingPermission: false,
      autoLogAppEventsEnabled: false,
      isAutoInitEnabled: false,
    },
  ]);
}

module.exports = {
  expo: {
    name: 'Nine Below',
    slug: 'golf9',
    scheme: ['golf9', 'com.potterwell.ninebelow'],
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    newArchEnabled: true,
    sdkVersion: '54.0.0',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1C2E50',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.potterwell.ninebelow',
      buildNumber: '5',
      usesAppleSignIn: true,
      config: { usesNonExemptEncryption: false },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        ],
      },
    },
    android: {
      package: 'com.potterwell.ninebelow',
      versionCode: 61,
      permissions: [],
      blockedPermissions: [
        'com.google.android.gms.permission.AD_ID',
        'android.permission.ACCESS_ADSERVICES_AD_ID',
        'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
        'android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE',
        'android.permission.ACCESS_ADSERVICES_TOPICS',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#164E73',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
    },
    experiments: process.env.EXPO_PUBLIC_APP_TARGET === 'web' ? { baseUrl: '/play' } : {},
    plugins,
    extra: {
      releaseChannel,
      webBuildNumber: 1,
      eas: {
        projectId: 'b8c31c6b-71b9-497d-984c-d59a4871e84b',
      },
    },
    owner: 'nemoclown',
  },
};
