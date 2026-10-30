// Expo autolinking excludes these iOS pods, but React Native's codegen also
// discovers package dependencies independently. Keep both exclusion lists in
// sync so Fabric never registers a native component whose class is not linked.
// Google and Facebook are linked on both platforms. The updater is Android-only.
module.exports = {
  dependencies: {
    'expo-in-app-updates': { platforms: { ios: null } },
  },
};
