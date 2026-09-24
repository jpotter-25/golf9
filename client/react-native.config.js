// Expo autolinking excludes these iOS pods, but React Native's codegen also
// discovers package dependencies independently. Keep both exclusion lists in
// sync so Fabric never registers a native component whose class is not linked.
// Android remains enabled; the iOS beta uses first-party account sign-in.
module.exports = {
  dependencies: {
    '@react-native-google-signin/google-signin': { platforms: { ios: null } },
    'react-native-fbsdk-next': { platforms: { ios: null } },
    'expo-in-app-updates': { platforms: { ios: null } },
  },
};
