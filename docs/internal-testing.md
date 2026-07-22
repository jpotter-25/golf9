# Nine Below Internal Testing Checklist

## Latest Nine Below Google Play build
- Release date: `2026-07-21`
- Package: `com.potterwell.ninebelow`
- App version: `0.1.0`
- Android versionCode: `45`
- EAS profile: `playtest`
- EAS build ID: `edcff206-d436-4fcb-ae0e-c48f19df8e91`
- Source commit: `a0513328ef71eba23eea6cf585027d574a14ad76`
- AAB: `https://expo.dev/artifacts/eas/2MbOQZ2zcADXX2UA4N4-EKJUIghF7lOx612ZM7YHrHI.aab`
- Play app ID: `4976320176871747708`
- Internal track ID: `4701595510712306572`
- Release: `Nine Below internal testing v45`
- Release status: `Available to internal testers`
- Tester audience: `Family/Friends` (`9` users)
- Tester opt-in URL: `https://play.google.com/apps/internaltest/4701595510712306572`
- Play app-signing SHA-1: `10:3E:57:F5:70:9D:AE:08:E4:B6:8F:B4:BC:9E:25:49:E4:A8:32:7E`
- Upload certificate SHA-1: `D7:10:CA:08:96:BA:2B:8E:25:5F:D5:DD:4B:ED:74:29:0B:CD:6D:D9`
- This is the canonical Nine Below Google Play listing and Android package.

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
