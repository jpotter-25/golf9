const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || '';
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';
const facebookClientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN || '';
const facebookDisplayName = process.env.EXPO_PUBLIC_FACEBOOK_DISPLAY_NAME || 'Nine Below';
const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL
  || (process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'production' : 'playtest');

const plugins = [];

plugins.push('expo-secure-store');
plugins.push('expo-notifications');
plugins.push([
  'expo-build-properties',
  {
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
      autoLogAppEventsEnabled: false,
      isAutoInitEnabled: true,
    },
  ]);
}

module.exports = {
  expo: {
    name: 'Nine Below',
    slug: 'golf9',
    scheme: 'golf9',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    newArchEnabled: true,
    sdkVersion: '54.0.0',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#080F2A',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.golf9.app',
      buildNumber: '2',
    },
    android: {
      package: 'com.potterwell.ninebelow',
      versionCode: 46,
      permissions: [],
      blockedPermissions: ['com.google.android.gms.permission.AD_ID'],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#080F2A',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
    },
    plugins,
    extra: {
      releaseChannel,
      eas: {
        projectId: 'b8c31c6b-71b9-497d-984c-d59a4871e84b',
      },
    },
    owner: 'nemoclown',
  },
};
