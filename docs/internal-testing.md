# Nine Below Internal Testing Checklist

## Latest Nine Below Google Play build
- Package prepared: `2026-10-30` (Play upload still pending)
- Package: `com.potterwell.ninebelow`
- App version: `0.1.0`
- Android versionCode: `60`
- EAS profile: `playtest`
- EAS build ID: `4bf8019e-7530-446e-94ab-b06109c28d03`
- Source commit: `676c63a82bed4abf3f5d87dfc3c8ad0c29c15cbb` (later server-only persistence fix deployed separately)
- AAB: `https://expo.dev/artifacts/eas/5h7FaSuZGJBCaEF7z19H5CmtJxdHeMTQh3ok-XONHis.aab`
- Local verified file: `artifacts/Nine-Below-Android-0.1.0-version-code-60.aab`
- SHA-256: `56F787406A8A7E45A5BD83C9F3A7E0C643913EA2656E4C2FA0FBEBC2B53B7F00`
- Play app ID: `4976320176871747708`
- Closed track ID: `4700919917437591631`
- Internal track ID: `4701595510712306572`
- Planned release: `Nine Below closed test 60`
- Release status: `AAB integrity and upload signature verified; Play closed-test submission pending`
- Tester audience: `Family/Friends` (`9` users)
- Tester opt-in URL: `https://play.google.com/apps/internaltest/4701595510712306572`
- Play app-signing SHA-1: `10:3E:57:F5:70:9D:AE:08:E4:B6:8F:B4:BC:9E:25:49:E4:A8:32:7E`
- Upload certificate SHA-1: `D7:10:CA:08:96:BA:2B:8E:25:5F:D5:DD:4B:ED:74:29:0B:CD:6D:D9`
- This is the canonical Nine Below Google Play listing and Android package.
- Version 60 adds Apple login on Android. Existing players should link Apple from their current account rather than create a duplicate. See [social-login rollout](mobile-social-login.md) for provider status and remaining device checks.

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
