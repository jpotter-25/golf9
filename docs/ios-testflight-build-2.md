# Nine Below iOS 0.1.0 (2): launch-crash replacement

September 24, 2026. This is a TestFlight replacement, not a public App Store release. Android remains version code 59; the shared backend and database require no changes for this fix.

## Confirmed build 1 failure

Apple's submitted crash report matched the shipped build 1 binary UUIDs. It showed `EXC_CRASH (SIGABRT)` during `RCTThirdPartyComponentsProvider.thirdPartyFabricComponents` dictionary construction, before normal gameplay.

The iOS build excluded the Google Sign-In pod through Expo autolinking, but React Native's independent codegen still registered `RNGoogleSignInButtonComponentView`. Inspection of all 50 generated provider entries found 49 registered native classes and exactly one missing class: the Google button. The generated `NSClassFromString` returned nil, which the Objective-C dictionary could not accept.

`client/react-native.config.js` now applies the existing iOS exclusions to React Native codegen as well. Google/Facebook sign-in and the Android updater remain excluded on iOS. Android integrations remain enabled. No framework downgrade, authentication weakening, or database migration is part of this change.

## Verification

- 225 server tests pass.
- Client lint, TypeScript checks, and Expo dependency compatibility checks pass.
- Five browser tests pass.
- Four native-codegen tests pass using React Native's real discovery and provider generator: matching Expo/RN exclusions, required iOS UI providers retained, the old configuration reproduces the offending entry, and Android Google Sign-In remains enabled.
- The native-codegen suite runs in the EAS post-install hook and the local iOS build helper.
- The clean EAS macOS build completed and all four native-codegen tests passed in its post-install hook.
- Independent inspection of the finished device IPA found all 49 generated Fabric provider classes registered in the Mach-O Objective-C class list, zero missing classes, and no excluded Google-button provider references. Required device-ARM64 frameworks and the Hermes bundle are present. No recognized signing-secret/source-map filenames or PEM private-key markers were found. These checks do not replace Apple signature validation or a physical-device launch.

## Release record

| Item | Value |
| --- | --- |
| Bundle / Apple app | `com.potterwell.ninebelow` / `6814632886` |
| Version / iOS build | `0.1.0` / `2` |
| Source commit | `b7352f914e9ec19775ceb60c662a5d86b58a5882` |
| EAS build | [94540d12-eb9a-49dd-a391-d8a8607da9f2](https://expo.dev/accounts/nemoclown/projects/golf9/builds/94540d12-eb9a-49dd-a391-d8a8607da9f2) |
| Build / binary verification | Finished September 24, 2026 at 17:01 UTC; static IPA checks passed |
| Local archive | `artifacts/ios/build-2-94540d12/nine-below-0.1.0-build-2.ipa` (Git-ignored); 15,081,444 bytes |
| IPA SHA-256 | `9fc6ef6dec8145ac654764102cdfe6fefc62a28bf2800b6a6fd9328452809aef` |
| Native binary UUID | `3160139d-b18a-3435-8fdc-7c5dceca7246` |
| EAS submission | [26e55b6b-f250-4807-acc8-575fd9421e19](https://expo.dev/accounts/nemoclown/projects/golf9/submissions/26e55b6b-f250-4807-acc8-575fd9421e19) |
| Apple upload / processing | Submission finished September 24 at 17:04 UTC; Apple processing `VALID`, unexpired |
| Apple build resource | `f7d0da0c-299f-426c-b6c4-b2c0127c906c` |
| TestFlight state | Internal `READY_FOR_BETA_TESTING`; external `IN_BETA_TESTING`; beta review `APPROVED` |
| Existing group distribution | Build 2 assigned to **Private Playtesters**; owner approved keeping Public Link enabled on September 24 |
| Tester notification / instructions | Automatic notification enabled; build-2 startup-fix What to Test saved and verified |
| Physical-device launch | Pending tester confirmation |

### Approved distribution audience

On September 24 the owner explicitly approved keeping **Public Link enabled** on the existing **Private Playtesters** external group. The group is link-accessible, not email-only; its name is not an access restriction. The live preflight showed one tester and build 1 assigned. Build 2 was then assigned to that same group without changing its settings or tester accounts. Both existing build 1 and corrected build 2 remain assigned; testers must select **0.1.0 (2)** to test this fix.

Apple readback confirms build 2 is **VALID**, **APPROVED**, and **IN_BETA_TESTING**, assigned to the intended group. The startup-fix What to Test from the [copy worksheet](../store-assets/apple/testflight-copy.md) was saved and read back. Automatic tester notification remains enabled, but email receipt and physical-device launch are not verified. The operation made three scoped writes: What to Test, group assignment, and beta review submission. No group configuration, tester, reviewer credential, release-policy, or build-1 changes were made.

## Tester acceptance

After Apple makes **0.1.0 (2)** available, open TestFlight, select Nine Below, and tap **Update**. Confirm build **2** is installed; retesting build 1 does not test this fix. Do not delete an existing account or clear player data as a workaround.

1. Fully close and launch Nine Below several times; confirm the login/lobby appears without the crash prompt.
2. Sign in with an existing Nine Below display name and password, or a separately supplied game signup invite for a new account.
3. Complete a solo game and a shared match with an Android tester.
4. Background and reopen the app; check reconnection, sound, and basic navigation.
5. If it crashes, submit TestFlight crash feedback and include the installed build, device model, iOS version, and steps. Never include credentials or game invite codes in feedback.

Static registration checks and successful Apple processing do not establish a successful on-device launch. Keep physical-device verification pending until a tester confirms it. Use only the approved distribution audience; do not grant playtesters developer-console roles.
