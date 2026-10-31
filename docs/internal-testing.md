# Nine Below Internal Testing Checklist

## Latest Nine Below Google Play build
- Package prepared and submitted to Google Play: `2026-10-30`
- Package: `com.potterwell.ninebelow`
- App version: `0.1.0`
- Android versionCode: `62`
- EAS profile: `playtest`
- EAS build ID: `182634bb-457c-45b1-87e0-0af0c4525a47`
- Source commit: `970cb8293ffaf5c81e2e7d450b39ee437f149f4b`
- AAB: `https://expo.dev/artifacts/eas/sfL7G5wxyXLz5TvYNSNsw7ATrnnMshc7cPrOjB9L4mA.aab`
- Local verified file: `artifacts/Nine-Below-Android-0.1.0-version-code-62.aab`
- SHA-256: `3CD57BF93D2E3C88A8EDD1C33F9637C1F32E3E6001A09BC8CF53ACA3397FFABA`
- Play app ID: `4976320176871747708`
- Closed track ID: `4700919917437591631`
- Internal track ID: `4701595510712306572`
- Release: `Nine Below closed test 62`, Play release ID `14`
- Release status: `Submitted; Changes in review, automated quick checks running`
- Scope: existing `Closed testing - Alpha` track, 100% rollout, existing country and tester settings unchanged. Production was not modified.
- Managed publishing: off (unchanged); approval will automatically publish the closed-test update. Submission is not proof of availability on testers' phones.
- Last available release observed before submission: `58 (0.1.0)`, release ID `13`.
- Previously recorded tester audience: `Family/Friends` (`9` users); no tester identities inspected or membership changes made during this submission.
- Previously recorded internal-track tester opt-in URL: `https://play.google.com/apps/internaltest/4701595510712306572` (not the Alpha closed-track link).
- Play app-signing SHA-1: `10:3E:57:F5:70:9D:AE:08:E4:B6:8F:B4:BC:9E:25:49:E4:A8:32:7E`
- Upload certificate SHA-1: `D7:10:CA:08:96:BA:2B:8E:25:5F:D5:DD:4B:ED:74:29:0B:CD:6D:D9`
- This is the canonical Nine Below Google Play listing and Android package.
- Version 62 includes immediate public drawn/revealed cards, same-club Ranked matching, queue/coin/season layout fixes, and the earlier Apple login addition on Android. Existing players should link Apple from their current account rather than create a duplicate. See [public-card verification](opening-card-visibility.md) and [social-login rollout](mobile-social-login.md) for behavior and remaining device checks.

## Responsive layout coverage
- Runtime layouts respond to live viewport width, height, safe-area insets, and player count.
- Shared authenticated screens are centered with bounded content widths on tablets, foldables, and split-screen windows.
- The game table is capped at a stable maximum width so cards and HUD controls do not stretch excessively on large displays.
- Android remains portrait-oriented by design. Landscape is not a supported layout for this release.
- Before public release, capture and visually verify real tablet and foldable screenshots rather than resizing phone screenshots.

## Build channels
- iOS TestFlight: `eas env:exec preview 'eas build --platform ios --profile testflight'` (store IPA, not the internal staging profile)
- Android internal testing APK: `eas build --platform android --profile staging`
- Production candidates: `eas build --platform all --profile production`

## Required manual coverage
- Pass-and-play: 2, 3, and 4 players; 5 and 9 rounds.
- Solo AI: 2, 3, and 4 players; 5 and 9 rounds.
- Online rooms: create, join by code, ready/unready, host start, host leave, leave room.
- Online games: 2, 3, and 4 players; reconnect mid-game; close/reopen app during room; player timeout.
- Invalid intents: out-of-turn draw/replace/discard, duplicate action IDs, invalid room code.
- Final sweep, column zeroing, and final scoring.
- iOS, Android, and web smoke tests if web distribution remains enabled.

## Store metadata requirements
- App name: Nine Below.
- Short description: Multiplayer 9-card Golf card game.
- Privacy policy URL, support URL, screenshots, age rating, and data-safety answers must be completed before public release.
