# Responsive coin balance — October 30, 2026

The shared signed-in header no longer uses a 47px coin button or a 29px text cap.
The balance is content-sized, uses tabular digits, and cannot shrink or ellipsize.
Player identity and action controls wrap into separate rows when necessary.
Existing navigation, feature-availability rules, balances, and server logic are unchanged.

## Number display

- 0–99,999: exact, with grouping (for example `54,321`).
- 100,000 and higher: at most three significant digits with K/M/B/T/Q suffixes
  (`125K`, `1.25M`, `12.3M`, `1B`). Values truncate rather than round up, so
  `999,999` displays `999K`, not an unearned `1M`.
- The accessibility label always announces the exact balance; tapping still opens
  the existing shop, which displays the exact balance.
- Invalid, negative, fractional, or unsafe values display an unavailable marker,
  not a fabricated numeric balance.

## Verification

- Six new regression tests cover full/compact values, invalid inputs, actual
  header text constraints, exact accessible labels, shop navigation, wrapping,
  and feature visibility/locking. Run `npm run test:header` in `client`.
- All 25 client regression tests, lint, typecheck, dependency compatibility,
  production web export, and all 245 server tests passed.
- Run `node test/previewHeader.cjs` in `client` and open `http://127.0.0.1:4179`.
  This local-only fixture renders the actual shared component/styles using React
  Native Web with synthetic account data and placeholder icons. It does not
  connect to live accounts or add a test route to the shipped application.
- Browser measurement and screenshot checks: exact `54,321` fits without wrapping
  at 375/414px; controls wrap at 320px and on a 375px non-lobby header with Home.
  All controls and coin glyphs stay within their containers, including simulated
  200% text at 320px, `1.25M`, and a tablet with a maximum-safe-integer balance.
- Browser checks are not a physical iPhone/Android rendering test. After installing
  the new binary, verify cold launch, the Play header, Shop navigation, another
  screen with Home, enlarged system text, and a game/reconnect cycle on-device.

## Distribution

- Source commit: `80294f551486ea870e14b15ae86ad96db8069a63`.
- EAS iOS build 4: `93758566-db41-4d12-b467-c7d7c65f0aa3`, finished successfully.
- Verified artifact: `artifacts/nine-below-0.1.0-ios-build-4.ipa`, 21,220,587 bytes.
- SHA-256: `94afc359391d8bd99e4934937c4fa21478c12acf138f316f22284c71c6a8c250`.
- Static package inspection passed: correct app/build/team, ARM64 device target,
  all 50 registered native component classes, packaged frameworks and Hermes,
  preserved Apple/Google configuration, no unexpected credential/source-map
  filenames or private-key markers. Embedded bytecode contains the new header.
  These checks do not replace a device cold-launch test or Apple's validation.
- EAS submission `7c3c0cb9-0d47-41b7-981d-b4ace9e6d871` finished. Apple build
  `37072534-8d6c-4627-a73a-d36ce4c47775` is `VALID`, beta review `APPROVED`, and
  `IN_BETA_TESTING`. App Store Connect also shows build 4 as **Testing**.
- Build 4 is assigned to the existing Private Playtesters group. Its existing
  two testers, public join link, older builds, reviewer information, and access
  settings were preserved. Automatic notification is enabled; receipt on a
  tester device is not independently verified.
- The distribution request returned an uncertain result after its writes; a
  separate read-only check confirmed approval, group assignment, exact release
  notes, and the testing state. No duplicate submission was made.
- Railway deployment `1de2be37-25cb-4fec-83bd-8e28f6c22f5a` succeeded. The live
  browser bundle contains the new header; `/health` and `/health/ready` passed.

On iPhone, open **TestFlight → Nine Below → Update** and confirm **0.1.0 (4)**.
If the update has not appeared yet, refresh/reopen TestFlight. Existing build 3
does not receive this change merely by restarting the app.
Android version code 60 is unchanged; the shared fix will require a new Android
binary when released. No database migration, balance change, account reset, new
tester access, or sign-in configuration change is part of this release.
