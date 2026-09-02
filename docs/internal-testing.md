# Nine Below Internal Testing Checklist

## Latest Nine Below Google Play build
- Release date: `2026-09-02`
- Package: `com.potterwell.ninebelow`
- App version: `0.1.0`
- Android versionCode: `59`
- EAS profile: `playtest`
- EAS build ID: `4c1f57ae-37a4-4bab-9157-9d0a104d12c9`
- Source commit: `c764d520c1cb3cc183d029ba6095d09fe6003f15`
- AAB: `https://expo.dev/artifacts/eas/ovQ3vTDaBQ-8Um5h6bMdMDeTZ9yBikN3-N-DbNqEs7E.aab`
- Local verified file: `client/dist/nine-below-playtest-v59.aab`
- SHA-256: `2AD6702648299EC0444D3DF2704F76D69E73FF1779A4513B7DD2379F54165AD3`
- Play app ID: `4976320176871747708`
- Closed track ID: `4700919917437591631`
- Internal track ID: `4701595510712306572`
- Planned release: `Nine Below closed test 59`
- Release status: `AAB integrity and upload signature verified; Play closed-test submission pending`
- Tester audience: `Family/Friends` (`9` users)
- Tester opt-in URL: `https://play.google.com/apps/internaltest/4701595510712306572`
- Play app-signing SHA-1: `10:3E:57:F5:70:9D:AE:08:E4:B6:8F:B4:BC:9E:25:49:E4:A8:32:7E`
- Upload certificate SHA-1: `D7:10:CA:08:96:BA:2B:8E:25:5F:D5:DD:4B:ED:74:29:0B:CD:6D:D9`
- This is the canonical Nine Below Google Play listing and Android package.

## Responsive layout coverage
- Runtime layouts respond to live viewport width, height, safe-area insets, and player count.
- Shared authenticated screens are centered with bounded content widths on tablets, foldables, and split-screen windows.
- The game table is capped at a stable maximum width so cards and HUD controls do not stretch excessively on large displays.
- Android remains portrait-oriented by design. Landscape is not a supported layout for this release.
- Before public release, capture and visually verify real tablet and foldable screenshots rather than resizing phone screenshots.

## Build channels
- iOS TestFlight: `eas build --platform ios --profile staging`
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
