# Golf 9 Internal Testing Checklist

## Latest Google Play internal build
- Release date: `2026-07-11`
- Package: `us.joinup.golf_9`
- App version: `0.1.0`
- Android versionCode: `31`
- EAS profile: `playtest`
- EAS build ID: `e5aca079-a0e0-4b6f-ac7e-5c000eafc647`
- Source commit: `e34fa92da8c72cfac3ebc7bdf90e8a56d1fa7f57`
- AAB: `https://expo.dev/artifacts/eas/3k6I2uSVXkolltAuqSNjNEEppRyLa2vO-Nl_znCw9U8.aab`

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
- App name: Golf 9.
- Short description: Multiplayer 9-card Golf card game.
- Privacy policy URL, support URL, screenshots, age rating, and data-safety answers must be completed before public release.
