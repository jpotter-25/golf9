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

iOS build 4 is reserved for this change. Build/signature verification and Apple
processing/distribution must finish before testers can install it. Existing build
3 does not receive this change merely by restarting the app. Android version code
60 is unchanged; the shared fix will require a new Android binary when released.
